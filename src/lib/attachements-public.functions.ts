import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tokenSchema = z.object({ token: z.string().uuid() });

export const getAttachementPublic = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => tokenSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: attachment, error } = await supabaseAdmin.from("attachements_travaux").select("*").eq("public_token", data.token).maybeSingle();
    if (error) throw new Error(error.message);
    if (!attachment) throw new Error("Ce lien d’attachement n’est plus valide.");
    const { data: items, error: lineError } = await supabaseAdmin.from("attachement_items").select("*").eq("attachement_id", attachment.id).order("ordre");
    if (lineError) throw new Error(lineError.message);
    const { data: propositions } = await supabaseAdmin
      .from("attachement_propositions")
      .select("id, signataire_nom, commentaire, total_ht, statut, lignes, created_at, traite_at")
      .eq("attachement_id", attachment.id)
      .order("created_at", { ascending: false })
      .limit(1);
    const now = new Date().toISOString();
    await supabaseAdmin.from("attachements_travaux").update({ viewed_at: attachment.viewed_at ?? now, last_viewed_at: now, view_count: Number(attachment.view_count ?? 0) + 1 }).eq("id", attachment.id);
    return { attachement: attachment, items: items ?? [], proposition: propositions?.[0] ?? null };
  });

export const repondreAttachementPublic = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => tokenSchema.extend({ decision: z.enum(["accepte", "refuse"]), signataire_nom: z.string().trim().min(2).max(120) }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: attachment, error } = await supabaseAdmin.from("attachements_travaux").select("id, numero, numero_ticket, client_nom, validation_requise, statut, total_ht").eq("public_token", data.token).maybeSingle();
    if (error) throw new Error(error.message);
    if (!attachment) throw new Error("Ce lien d’attachement n’est plus valide.");
    if (!attachment.validation_requise) throw new Error("Cet attachement ne demande pas de validation en ligne.");
    if (["accepte", "refuse", "facture"].includes(attachment.statut)) return { ok: true, already: true };
    const now = new Date().toISOString();
    const update = data.decision === "accepte"
      ? { statut: "accepte", accepted_at: now, refused_at: null, signataire_nom: data.signataire_nom }
      : { statut: "refuse", refused_at: now, accepted_at: null, signataire_nom: data.signataire_nom };
    const result = await supabaseAdmin.from("attachements_travaux").update(update).eq("id", attachment.id);
    if (result.error) throw new Error(result.error.message);
    const { creerNotification } = await import("@/lib/notifications.server");
    await creerNotification(supabaseAdmin, {
      type: "attachement_reponse",
      titre: `Attachement ${attachment.numero} ${data.decision} — ticket ${attachment.numero_ticket}`,
      message: `${data.signataire_nom} a ${data.decision === "accepte" ? "accepté" : "refusé"} l’attachement de ${attachment.client_nom}.`,
      lien: `/attachements/${attachment.id}`,
      montant: Number(attachment.total_ht),
      meta: { attachement_id: attachment.id },
    });
    return { ok: true, already: false };
  });

const propositionLigneSchema = z.object({
  libelle: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).optional().nullable(),
  quantite: z.number().positive().max(100000),
  prix_unitaire: z.number().min(0).max(1_000_000),
});

export const proposerValorisationPublic = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => tokenSchema.extend({
    signataire_nom: z.string().trim().min(2).max(120),
    commentaire: z.string().trim().min(3).max(2000),
    lignes: z.array(propositionLigneSchema).min(1).max(100),
  }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: attachment, error } = await supabaseAdmin
      .from("attachements_travaux")
      .select("id, numero, numero_ticket, client_nom, statut, total_ht, facture_id, proposition_autorisee")
      .eq("public_token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!attachment) throw new Error("Ce lien d’attachement n’est plus valide.");
    if (!attachment.proposition_autorisee) throw new Error("Cet attachement n’accepte pas de proposition de valorisation.");
    if (attachment.facture_id || ["accepte", "facture"].includes(attachment.statut)) throw new Error("Cet attachement est déjà validé : contactez IRVE Technologie.");
    const pending = await supabaseAdmin.from("attachement_propositions").select("id").eq("attachement_id", attachment.id).eq("statut", "en_attente").limit(1);
    if (pending.data?.length) throw new Error("Une proposition est déjà en attente de validation.");
    const total = data.lignes.reduce((sum, l) => sum + l.quantite * l.prix_unitaire, 0);
    const inserted = await supabaseAdmin.from("attachement_propositions").insert({
      attachement_id: attachment.id,
      signataire_nom: data.signataire_nom,
      commentaire: data.commentaire,
      total_ht: total,
      statut: "en_attente",
      lignes: data.lignes.map((l) => ({ ...l, description: l.description ?? null })),
    });
    if (inserted.error) throw new Error(inserted.error.message);
    await supabaseAdmin.from("attachements_travaux").update({ statut: "propose" }).eq("id", attachment.id);
    const ecart = total - Number(attachment.total_ht ?? 0);
    const { creerNotification } = await import("@/lib/notifications.server");
    await creerNotification(supabaseAdmin, {
      type: "attachement_proposition",
      titre: `Valorisation proposée — attachement ${attachment.numero} (ticket ${attachment.numero_ticket})`,
      message: `${data.signataire_nom} propose ${total.toFixed(2)} € HT (écart ${ecart >= 0 ? "+" : ""}${ecart.toFixed(2)} €) pour ${attachment.client_nom}.`,
      lien: `/attachements/${attachment.id}`,
      montant: total,
      meta: { attachement_id: attachment.id },
    });
    return { ok: true, total_ht: total };
  });
