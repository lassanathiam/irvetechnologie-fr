import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { normaliserStructure, modelePourPartenaire } from "./rapport-modeles";
import type { Json } from "@/integrations/supabase/types";

function siteBase() {
  return (process.env["PUBLIC_SITE_URL"]?.trim() || "https://www.irvetechnologie.fr").replace(/\/$/, "");
}

const PROMPT = `Tu reçois la photo d'une feuille de rapport d'intervention papier (borne de recharge / électricité / télécom).
Analyse-la pour permettre de remplir le document ORIGINAL sans refaire sa mise en page. Réponds UNIQUEMENT avec un objet JSON, sans texte autour :
{"titre":"...","sections":[{"titre":"...","champs":[{"id":"snake_case_unique","label":"...","type":"texte|zone|nombre|date|case|ouinon","auto":null,"placement":{"page":0,"x":0.1,"y":0.2,"w":0.25,"h":0.04}}]}],"signatures":{"technicien":{"page":0,"x":0.08,"y":0.82,"w":0.28,"h":0.1},"client":{"page":0,"x":0.62,"y":0.82,"w":0.28,"h":0.1}}}
Règles :
- Garde l'ordre, les intitulés exacts et les rubriques de la feuille.
- Une case à cocher simple = "case" ; une question Conforme/Non conforme ou Oui/Non = "ouinon" ; zone de commentaire = "zone" ; valeur mesurée = "nombre".
- "auto" vaut "client_nom", "adresse", "date", "technicien", "telephone", "entreprise" (société installatrice), "projet" (numéro/description du projet), "phase" (mono/triphasé) ou "ville" (lieu "Fait à") si le champ correspond, sinon null.
- Si c est un PDF de plusieurs pages, reprends toutes les pages.
- placement décrit la zone vide exacte à remplir, en coordonnées proportionnelles de 0 à 1 : page commence à 0, x depuis la gauche, y depuis le haut, w largeur et h hauteur.
- Repère aussi les deux zones de signature existantes. N'inclus jamais le logo comme champ.`;

/** Lecture unique de la feuille papier par l'IA pour créer le modèle. */
export const analyserFeuilleRapport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ data_url: z.string().max(12_000_000) }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: staff } = await context.supabase.rpc("is_staff");
    if (!staff) throw new Error("Accès réservé à l'équipe.");
    const estPdf = data.data_url.startsWith("data:application/pdf;base64,");
    if (!estPdf && !/^data:image\/(jpeg|png|webp);base64,/.test(data.data_url)) throw new Error("Format non supporté : photo ou PDF.");
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Service d'analyse non configuré.");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low", summary: "auto" },
        include: ["reasoning.encrypted_content"],
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: PROMPT },
              estPdf
                ? { type: "input_file", filename: "feuille.pdf", file_data: data.data_url }
                : { type: "input_image", image_url: data.data_url },
            ],
          },
        ],
      }),
    });
    if (!res.ok || !res.body) {
      if (res.status === 402) throw new Error("Crédits IA épuisés : rechargez-les dans les paramètres de l'espace de travail.");
      if (res.status === 429) throw new Error("Trop de demandes, réessayez dans une minute.");
      if (res.status === 403) throw new Error("Analyse refusée par le service IA.");
      throw new Error(`Analyse impossible (${res.status}).`);
    }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let text = "";
    let refused = false;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;
        try {
          const ev = JSON.parse(payload) as { type?: string; delta?: string };
          if (ev.type === "response.output_text.delta" && ev.delta) text += ev.delta;
          if (ev.type === "response.refusal.delta") refused = true;
        } catch {
          /* trame partielle */
        }
      }
    }
    if (refused && !text) throw new Error("Le service IA a refusé d'analyser cette photo.");
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("La feuille n'a pas pu être lue. Reprenez la photo bien à plat et nette.");
    let parsed: unknown;
    try {
      parsed = JSON.parse(m[0]);
    } catch {
      throw new Error("La feuille n'a pas pu être lue. Reprenez la photo bien à plat et nette.");
    }
    const structure = normaliserStructure(parsed);
    if (!structure.sections.length) throw new Error("Aucune rubrique détectée sur la photo.");
    return structure;
  });

const modeleSchema = z.object({
  id: z.string().uuid().optional().nullable(),
  nom: z.string().trim().min(1).max(160),
  donneur_ordre: z.string().trim().min(1).max(160),
  logo_data: z.string().max(800_000).optional().nullable(),
  email_destinataire: z.string().trim().max(255).optional().nullable(),
  structure: z.unknown(),
  actif: z.boolean().default(true),
});

export const listModelesRapport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("rapport_modeles")
      .select("*")
      .order("donneur_ordre", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const enregistrerModeleRapport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => modeleSchema.parse(i))
  .handler(async ({ data, context }) => {
    const row = {
      nom: data.nom,
      donneur_ordre: data.donneur_ordre,
      logo_data: data.logo_data || null,
      email_destinataire: data.email_destinataire || null,
      structure: normaliserStructure(data.structure) as unknown as Json,
      actif: data.actif,
    };
    const q = data.id
      ? context.supabase.from("rapport_modeles").update(row).eq("id", data.id).select("id").single()
      : context.supabase.from("rapport_modeles").insert(row).select("id").single();
    const { data: saved, error } = await q;
    if (error) throw new Error(error.message);
    return saved;
  });

export const supprimerModeleRapport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("rapport_modeles").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/** Chantier + modèle du donneur d'ordre + rapport déjà commencé. */
export const getRapportChantier = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ rendezvous_id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const [rdvQ, modQ, rempQ] = await Promise.all([
      context.supabase
        .from("rendezvous")
        .select("id, client_nom, client_telephone, client_email, adresse, cp_ville, technicien, partenaire, date_debut, designation, titre, phase_installation, termine_at")
        .eq("id", data.rendezvous_id)
        .maybeSingle(),
      context.supabase.from("rapport_modeles").select("*").eq("actif", true),
      context.supabase
        .from("rapport_remplis")
        .select("*")
        .eq("rendezvous_id", data.rendezvous_id)
        .order("created_at", { ascending: false })
        .limit(1),
    ]);
    if (rdvQ.error) throw new Error(rdvQ.error.message);
    if (!rdvQ.data) throw new Error("Chantier introuvable.");
    const modeles = modQ.data ?? [];
    const rempli = rempQ.data?.[0] ?? null;
    const modele =
      (rempli && modeles.find((m) => m.id === rempli.modele_id)) ||
      modelePourPartenaire(modeles, rdvQ.data.partenaire);
    let email_donneur: string | null = null;
    const { data: rdvP } = await context.supabase.from("rendezvous").select("partenaire_id").eq("id", data.rendezvous_id).maybeSingle();
    if (rdvP?.partenaire_id) {
      const { data: p } = await context.supabase.from("partenaires").select("email").eq("id", rdvP.partenaire_id).maybeSingle();
      email_donneur = p?.email?.trim() || null;
    }
    return { rdv: rdvQ.data, modeles, modele: modele ?? null, rempli, email_donneur };
  });

export const enregistrerRapportRempli = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        id: z.string().uuid().optional().nullable(),
        modele_id: z.string().uuid(),
        rendezvous_id: z.string().uuid(),
        valeurs: z.record(z.string(), z.union([z.string().max(4000), z.boolean(), z.null()])),
        signature_client: z.string().max(1_500_000).optional().nullable(),
        signature_technicien: z.string().max(1_500_000).optional().nullable(),
        signataire_nom: z.string().max(160).optional().nullable(),
        technicien: z.string().max(160).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const signed = Boolean(data.signature_client && data.signature_technicien);
    const row = {
      modele_id: data.modele_id,
      rendezvous_id: data.rendezvous_id,
      valeurs: data.valeurs as Json,
      signature_client: data.signature_client ?? null,
      signature_technicien: data.signature_technicien ?? null,
      signataire_nom: data.signataire_nom ?? null,
      technicien: data.technicien ?? null,
      signed_at: signed ? new Date().toISOString() : null,
    };
    const q = data.id
      ? context.supabase.from("rapport_remplis").update(row).eq("id", data.id).select("id, public_token").single()
      : context.supabase.from("rapport_remplis").insert(row).select("id, public_token").single();
    const { data: saved, error } = await q;
    if (error) throw new Error(error.message);
    return saved;
  });

/** Envoie le rapport signé au donneur d'ordre avec lien vers le rapport et les photos. */
export const envoyerRapportRempli = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid(), destinataire: z.string().trim().email().max(255) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: r, error } = await context.supabase
      .from("rapport_remplis")
      .select("id, public_token, signed_at, rendezvous_id, modele_id")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!r) throw new Error("Rapport introuvable.");
    if (!r.signed_at) throw new Error("Le rapport doit être signé par le client et le technicien.");
    const [{ data: modele }, { data: rdv }, { count }] = await Promise.all([
      context.supabase.from("rapport_modeles").select("nom, donneur_ordre").eq("id", r.modele_id).maybeSingle(),
      r.rendezvous_id
        ? context.supabase.from("rendezvous").select("client_nom, adresse, cp_ville, public_token, partenaire_id").eq("id", r.rendezvous_id).maybeSingle()
        : Promise.resolve({ data: null }),
      r.rendezvous_id
        ? context.supabase.from("rendezvous_photos").select("id", { count: "exact", head: true }).eq("rendezvous_id", r.rendezvous_id)
        : Promise.resolve({ count: 0 }),
    ]);
    const { data: partenaire } = rdv?.partenaire_id
      ? await context.supabase
          .from("partenaires")
          .select("nom, email_copie")
          .eq("id", rdv.partenaire_id)
          .maybeSingle()
      : { data: null };
    const templateData = {
      modele_nom: modele?.nom ?? "Rapport d'intervention",
      donneur_ordre: partenaire?.nom ?? modele?.donneur_ordre ?? "",
      client_nom: rdv?.client_nom ?? "",
      adresse: [rdv?.adresse, rdv?.cp_ville].filter(Boolean).join(", "),
      rapport_url: `${siteBase()}/rapport-donneur/${r.public_token}`,
      zip_url: rdv && (count ?? 0) > 0 ? `${siteBase()}/api/public/retour/${rdv.public_token}.zip` : null,
    };
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const { resoudreCopieEnsio } = await import("@/lib/copie-ensio.server");
    const copieEnsio = await resoudreCopieEnsio(context.supabase, data.destinataire, templateData.donneur_ordre);
    const res = await sendTemplateEmail("rapport-donneur", data.destinataire, {
      copieEnsio,
      idempotencyKey: `rapport-donneur-${r.id}-${data.destinataire}`,
      templateData,
    });
    if (!res.sent) throw new Error("Email non envoyé (adresse bloquée ou service indisponible).");
    const emailCopie = partenaire?.email_copie?.trim();
    if (emailCopie && emailCopie.toLowerCase() !== data.destinataire.toLowerCase() && emailCopie.toLowerCase() !== copieEnsio?.toLowerCase()) {
      const copie = await sendTemplateEmail("rapport-donneur", emailCopie, {
        idempotencyKey: `rapport-donneur-${r.id}-copie-${emailCopie}`,
        templateData,
      });
      if (!copie.sent) throw new Error("Le rapport a été envoyé au destinataire principal, mais pas à la personne en copie.");
    }
    await context.supabase
      .from("rapport_remplis")
      .update({ sent_at: new Date().toISOString(), sent_to: data.destinataire })
      .eq("id", r.id);
    return { ok: true as const };
  });

/** Consultation publique par lien privé (lecture seule). */
export const getRapportDonneurPublic = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ token: z.string().uuid() }).parse(i))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: r } = await supabaseAdmin
      .from("rapport_remplis")
      .select("id, modele_id, rendezvous_id, valeurs, signature_client, signature_technicien, signataire_nom, technicien, signed_at")
      .eq("public_token", data.token)
      .maybeSingle();
    if (!r || !r.signed_at) throw new Error("Rapport introuvable.");
    const [{ data: modele }, { data: rdv }] = await Promise.all([
      supabaseAdmin.from("rapport_modeles").select("nom, donneur_ordre, logo_data, structure").eq("id", r.modele_id).maybeSingle(),
      r.rendezvous_id
        ? supabaseAdmin.from("rendezvous").select("id, client_nom, adresse, cp_ville, public_token, termine_at, archive_at").eq("id", r.rendezvous_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    if (!modele) throw new Error("Rapport introuvable.");

    // Photos du chantier, servies par la route publique du retour de travaux,
    // dans la même fenêtre de 30 jours que le ZIP.
    const photos: { id: string; url: string; libelle: string }[] = [];
    const reference = rdv?.termine_at ?? rdv?.archive_at;
    if (rdv?.public_token && reference) {
      const dernierEnvoi = Math.max(
        new Date(rdv.termine_at ?? reference).getTime(),
        new Date(rdv.archive_at ?? reference).getTime(),
      );
      if (Date.now() <= dernierEnvoi + 30 * 24 * 60 * 60 * 1000) {
        const [{ data: liste }, { RETOUR_CATEGORIES_LABELS }] = await Promise.all([
          supabaseAdmin
            .from("rendezvous_photos")
            .select("id, categorie")
            .eq("rendezvous_id", rdv.id)
            .order("created_at", { ascending: true })
            .limit(60),
          import("@/lib/planning.functions"),
        ]);
        (liste ?? []).forEach((p, i) => {
          photos.push({
            id: p.id,
            url: `/api/public/retour/${rdv.public_token}/photo/${i + 1}`,
            libelle: RETOUR_CATEGORIES_LABELS[p.categorie] ?? p.categorie ?? "Photo",
          });
        });
      }
    }

    return {
      rapport: r,
      modele,
      client_nom: rdv?.client_nom ?? "",
      adresse: [rdv?.adresse, rdv?.cp_ville].filter(Boolean).join(", "),
      zip_url: rdv ? `/api/public/retour/${rdv.public_token}.zip` : null,
      photos,
    };
  });

/** Chantiers terminés d'un donneur d'ordre, proposés pour remplir son rapport / PV. */
export const listChantiersTerminesDonneur = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ donneur: z.string().trim().min(2).max(160) }).parse(i))
  .handler(async ({ data, context }) => {
    const mot = data.donneur.replace(/[%_,()]/g, " ").trim();
    const { data: rows, error } = await context.supabase
      .from("rendezvous")
      .select("id, client_nom, adresse, cp_ville, termine_at, date_debut, statut")
      .ilike("partenaire", `%${mot}%`)
      .not("termine_at", "is", null)
      .order("termine_at", { ascending: false })
      .limit(60);
    if (error) throw new Error(error.message);
    const ids = (rows ?? []).map((r) => r.id);
    const faits = new Set<string>();
    if (ids.length) {
      const { data: r2 } = await context.supabase.from("rapport_remplis").select("rendezvous_id, signed_at").in("rendezvous_id", ids);
      for (const r of r2 ?? []) if (r.rendezvous_id && r.signed_at) faits.add(r.rendezvous_id);
    }
    return (rows ?? []).map((r) => ({ ...r, pv_signe: faits.has(r.id) }));
  });
