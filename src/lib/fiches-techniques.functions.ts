import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { classerChantiers } from "@/lib/fiche-match";

export type FicheExtraite = {
  client_nom: string | null;
  adresse: string | null;
  cp_ville: string | null;
  puissance_borne: string | null;
  phase_installation: string | null;
  type_pose: string | null;
  metrage_m: number | null;
  repartiteur: boolean;
  resume: string | null;
};

const PROMPT = `Tu reçois une fiche technique ou un compte rendu de visite technique d'un chantier de borne de recharge.
Réponds UNIQUEMENT avec un JSON, sans texte autour :
{"client_nom":"nom du client particulier ou null","adresse":"numéro et rue ou null","cp_ville":"code postal et ville ou null","puissance_borne":"ex. 7,4 kW ou null","phase_installation":"Monophasé|Triphasé ou null","type_pose":"Murale|Sur pied ou null","metrage_m":nombre de mètres de câble prévu ou null,"repartiteur":true si la fiche prévoit la pose d'un répartiteur, coffret, tableau secondaire, sous-distributeur ou départ dans un tableau divisionnaire sinon false,"resume":"résumé utile pour le technicien en 2 à 6 lignes : tableau, protections, cheminement, accès, contraintes, matériel ; ou null"}
N'invente rien, mets null si absent.`;

const s = (v: unknown, max = 300) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

async function staff(context: { supabase: any }) {
  const { data } = await context.supabase.rpc("is_staff");
  if (!data) throw new Error("Accès réservé à l'équipe.");
}

/** Lit une fiche technique et propose les chantiers correspondants. */
export const analyserFicheTechnique = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ data_url: z.string().max(14_000_000).optional().nullable(), filename: z.string().max(200).optional().nullable(), texte: z.string().max(200_000).optional().nullable() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await staff(context);
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Service d'analyse non configuré.");
    const content: unknown[] = [{ type: "input_text", text: PROMPT }];
    if (data.texte) content.push({ type: "input_text", text: data.texte });
    if (data.data_url) {
      if (/^data:image\/(jpeg|png|webp);base64,/.test(data.data_url)) content.push({ type: "input_image", image_url: data.data_url });
      else if (data.data_url.startsWith("data:application/pdf;base64,")) content.push({ type: "input_file", filename: data.filename || "fiche.pdf", file_data: data.data_url });
      else throw new Error("Format non supporté (photo, PDF ou Excel).");
    }
    if (content.length < 2) throw new Error("Aucun fichier reçu.");
    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({ model: "openai/gpt-6-astra", stream: true, store: false, reasoning: { effort: "low", summary: "auto" }, include: ["reasoning.encrypted_content"], input: [{ role: "user", content }] }),
    });
    if (!res.ok || !res.body) {
      if (res.status === 402) throw new Error("Crédits IA épuisés : rechargez-les dans les paramètres de l'espace de travail.");
      if (res.status === 429) throw new Error("Trop de demandes, réessayez dans une minute.");
      throw new Error(`Analyse impossible (${res.status}).`);
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "", text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line.startsWith("data:")) continue;
        try {
          const ev = JSON.parse(line.slice(5).trim()) as { type?: string; delta?: string };
          if (ev.type === "response.output_text.delta" && ev.delta) text += ev.delta;
        } catch { /* trame partielle */ }
      }
    }
    const m = text.match(/\{[\s\S]*\}/);
    let o: Record<string, unknown> = {};
    try { o = m ? JSON.parse(m[0]) : {}; } catch { /* vide */ }
    const metrage = Number(o["metrage_m"]);
    const fiche: FicheExtraite = {
      client_nom: s(o["client_nom"], 160),
      adresse: s(o["adresse"]),
      cp_ville: s(o["cp_ville"], 160),
      puissance_borne: s(o["puissance_borne"], 40),
      phase_installation: s(o["phase_installation"], 40),
      type_pose: s(o["type_pose"], 80),
      metrage_m: Number.isFinite(metrage) && metrage > 0 && metrage < 10000 ? metrage : null,
      repartiteur: o["repartiteur"] === true || /r[ée]partiteur|coffret|tableau secondaire|sous[- ]distributeur|divisionnaire/i.test(String(o["resume"] ?? "")),
      resume: s(o["resume"], 2000),
    };
    const { data: rdvs } = await context.supabase
      .from("rendezvous")
      .select("id, client_nom, adresse, cp_ville, date_debut")
      .eq("archive", false)
      .order("date_debut", { ascending: false })
      .limit(500);
    return { fiche, suggestions: classerChantiers(fiche, rdvs ?? []) };
  });

/** Enregistre la fiche sur le chantier et complète les informations vides. */
export const enregistrerFicheTechnique = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      rendezvous_id: z.string().uuid(),
      nom: z.string().min(1).max(200),
      data_url: z.string().max(14_000_000),
      resume: z.string().max(2000).optional().nullable(),
      completer: z.object({
        puissance_borne: z.string().max(40).nullable().optional(),
        phase_installation: z.string().max(40).nullable().optional(),
        type_pose: z.string().max(80).nullable().optional(),
        metrage_m: z.number().nullable().optional(),
        repartiteur: z.boolean().optional(),
      }).optional(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await staff(context);
    const mm = data.data_url.match(/^data:([^;]+);base64,(.*)$/);
    if (!mm) throw new Error("Fichier illisible.");
    const mime = mm[1]!;
    const bin = atob(mm[2]!);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const ext = (data.nom.match(/\.([a-z0-9]{2,5})$/i)?.[1] ?? (mime.includes("pdf") ? "pdf" : "jpg")).toLowerCase();
    const path = `fiches/${data.rendezvous_id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await context.supabase.storage.from("documents").upload(path, bytes, { contentType: mime, upsert: false });
    if (upErr) throw new Error("Envoi de la fiche impossible.");
    const { error } = await context.supabase.from("rendezvous_fiches").insert({
      rendezvous_id: data.rendezvous_id, nom: data.nom, path, mime, resume: data.resume ?? null, created_by: context.userId,
    });
    if (error) throw new Error(error.message);

    const { data: rdv } = await context.supabase
      .from("rendezvous")
      .select("puissance_borne, phase_installation, type_pose, metrage_m, notes, retour_repartiteur")
      .eq("id", data.rendezvous_id)
      .maybeSingle();
    if (rdv) {
      const c = data.completer ?? {};
      const maj: { retour_repartiteur?: boolean; puissance_borne?: string; phase_installation?: string; type_pose?: string; metrage_m?: number; notes?: string } = {};
      if (!rdv.puissance_borne && c.puissance_borne) maj.puissance_borne = c.puissance_borne;
      if (!rdv.phase_installation && c.phase_installation) maj.phase_installation = c.phase_installation;
      if (!rdv.type_pose && c.type_pose) maj.type_pose = c.type_pose;
      if (!rdv.metrage_m && c.metrage_m) maj.metrage_m = c.metrage_m;
      if (!rdv.retour_repartiteur && (c.repartiteur || /r[ée]partiteur|coffret|tableau secondaire|sous[- ]distributeur|divisionnaire/i.test(data.resume ?? ""))) maj.retour_repartiteur = true;
      if (data.resume && !(rdv.notes ?? "").includes(data.resume.slice(0, 40))) {
        maj.notes = [rdv.notes, `Fiche technique :\n${data.resume}`].filter(Boolean).join("\n\n").slice(0, 8000);
      }
      if (Object.keys(maj).length) await context.supabase.from("rendezvous").update(maj).eq("id", data.rendezvous_id);
    }
    return { ok: true as const };
  });

export const listFichesTechniques = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ rendezvous_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("rendezvous_fiches")
      .select("id, nom, path, mime, created_at")
      .eq("rendezvous_id", data.rendezvous_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    const list = rows ?? [];
    if (!list.length) return [];
    const { data: signed } = await context.supabase.storage.from("documents").createSignedUrls(list.map((r) => r.path), 3600);
    return list.map((r, i) => ({ id: r.id, nom: r.nom, created_at: r.created_at, url: signed?.[i]?.signedUrl ?? null }));
  });
