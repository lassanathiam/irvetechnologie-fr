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
    const now = new Date().toISOString();
    await supabaseAdmin.from("attachements_travaux").update({ viewed_at: attachment.viewed_at ?? now, last_viewed_at: now, view_count: Number(attachment.view_count ?? 0) + 1 }).eq("id", attachment.id);
    return { attachement: attachment, items: items ?? [] };
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
