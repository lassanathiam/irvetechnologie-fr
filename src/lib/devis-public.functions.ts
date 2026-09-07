import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Accès client au devis via un lien signé (jeton). Aucune authentification :
 * le jeton unique du devis fait office de clé. Lecture/écriture restreintes
 * au seul devis correspondant au jeton.
 */

const tokenSchema = z.object({ token: z.string().uuid() });

export const getDevisPublic = createServerFn({ method: "GET" })
  .inputValidator((data: { token: string }) => tokenSchema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: devis, error } = await supabaseAdmin
      .from("devis")
      .select(
        "id, numero, date_emission, date_expiration, client_nom, client_email, client_telephone, client_adresse, client_cp_ville, objet, remise_pct, acompte_pct, conditions_paiement, notes, statut, signed_at, signature_client, signataire_nom, viewed_at, view_count",
      )
      .eq("public_token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!devis) throw new Error("Ce lien de devis n'est plus valide.");

    const { data: items } = await supabaseAdmin
      .from("devis_items")
      .select("libelle, description, quantite, prix_unitaire, tva")
      .eq("devis_id", devis.id)
      .order("ordre", { ascending: true });

    const now = new Date().toISOString();
    await supabaseAdmin
      .from("devis")
      .update({
        viewed_at: devis.viewed_at ?? now,
        last_viewed_at: now,
        view_count: (devis.view_count ?? 0) + 1,
      })
      .eq("id", devis.id);

    return { devis, items: items ?? [] };
  });

export const signerDevisPublic = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    tokenSchema
      .extend({
        signataire_nom: z.string().trim().min(2).max(120),
        signature: z.string().startsWith("data:image/").max(400_000),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: devis, error } = await supabaseAdmin
      .from("devis")
      .select("id, numero, signed_at, client_nom, objet, total_ttc")
      .eq("public_token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!devis) throw new Error("Ce lien de devis n'est plus valide.");
    if (devis.signed_at) return { ok: true, already: true };

    const signedAt = new Date().toISOString();
    const { error: updateError } = await supabaseAdmin
      .from("devis")
      .update({
        signed_at: signedAt,
        signature_client: data.signature,
        signataire_nom: data.signataire_nom,
        statut: "accepte",
      })
      .eq("id", devis.id);
    if (updateError) throw new Error(updateError.message);

    // Notification interne : on prévient l'équipe dès que le client signe.
    try {
      const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
      await sendTemplateEmail("devis-signe", "", {
        idempotencyKey: `devis-signe-${devis.id}`,
        templateData: {
          numero: devis.numero,
          client_nom: devis.client_nom,
          objet: devis.objet,
          total_ttc: devis.total_ttc,
          signataire_nom: data.signataire_nom,
          signed_at: signedAt,
        },
      });
    } catch (e) {
      console.error("Notification de signature non envoyée:", e);
    }

    return { ok: true, already: false };
  });
