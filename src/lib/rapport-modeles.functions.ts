import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { normaliserStructure, modelePourPartenaire } from "./rapport-modeles";
import type { Json } from "@/integrations/supabase/types";

function siteBase() {
  return (process.env["PUBLIC_SITE_URL"]?.trim() || "https://www.irvetechnologie.fr").replace(/\/$/, "");
}

const PROMPT = `Tu reçois la photo d'une feuille de rapport d'intervention papier (borne de recharge / électricité / télécom).
Reproduis-la en formulaire numérique. Réponds UNIQUEMENT avec un objet JSON, sans texte autour :
{"titre": "...", "sections": [{"titre": "...", "champs": [{"id": "snake_case_unique", "label": "...", "type": "texte|zone|nombre|date|case|ouinon", "auto": null}]}]}
Règles :
- Garde l'ordre, les intitulés exacts et les rubriques de la feuille.
- Une case à cocher simple = "case" ; une question Conforme/Non conforme ou Oui/Non = "ouinon" ; zone de commentaire = "zone" ; valeur mesurée = "nombre".
- "auto" vaut "client_nom", "adresse", "date", "technicien" ou "telephone" si le champ correspond à ces infos, sinon null.
- N'inclus PAS les zones de signature ni le logo.`;

/** Lecture unique de la feuille papier par l'IA pour créer le modèle. */
export const analyserFeuilleRapport = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ data_url: z.string().max(6_000_000) }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: staff } = await context.supabase.rpc("is_staff");
    if (!staff) throw new Error("Accès réservé à l'équipe.");
    if (!/^data:image\/(jpeg|png|webp);base64,/.test(data.data_url)) throw new Error("Format d'image non supporté.");
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
              { type: "input_image", image_url: data.data_url },
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
        .select("id, client_nom, client_telephone, client_email, adresse, cp_ville, technicien, partenaire, date_debut, designation, titre")
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
    const res = await sendTemplateEmail("rapport-donneur", data.destinataire, {
      idempotencyKey: `rapport-donneur-${r.id}-${data.destinataire}`,
      templateData,
    });
    if (!res.sent) throw new Error("Email non envoyé (adresse bloquée ou service indisponible).");
    const emailCopie = partenaire?.email_copie?.trim();
    if (emailCopie && emailCopie.toLowerCase() !== data.destinataire.toLowerCase()) {
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
        ? supabaseAdmin.from("rendezvous").select("client_nom, adresse, cp_ville, public_token").eq("id", r.rendezvous_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    if (!modele) throw new Error("Rapport introuvable.");
    return {
      rapport: r,
      modele,
      client_nom: rdv?.client_nom ?? "",
      adresse: [rdv?.adresse, rdv?.cp_ville].filter(Boolean).join(", "),
      zip_url: rdv ? `/api/public/retour/${rdv.public_token}.zip` : null,
    };
  });
