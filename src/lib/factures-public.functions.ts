import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Accès client à la facture via un lien à jeton unique. Aucune
 * authentification : le jeton fait office de clé, l'accès est limité à la
 * seule facture correspondante. Chaque ouverture est comptabilisée.
 */
export const getFacturePublic = createServerFn({ method: "GET" })
  .inputValidator((data: { token: string }) => z.object({ token: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: facture, error } = await supabaseAdmin
      .from("factures")
      .select(
        "id, numero, date_emission, date_echeance, client_nom, client_email, client_telephone, client_adresse, client_cp_ville, objet, remise_pct, conditions_paiement, notes, statut, paid_at, viewed_at, view_count, numero_ticket, numero_affaire, bon_commande, autoliquidation, activite",
      )
      .eq("public_token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!facture) throw new Error("Ce lien de facture n'est plus valide.");

    const { data: items } = await supabaseAdmin
      .from("facture_items")
      .select("libelle, description, quantite, prix_unitaire, tva")
      .eq("facture_id", facture.id)
      .order("ordre", { ascending: true });

    const now = new Date().toISOString();
    await supabaseAdmin
      .from("factures")
      .update({
        viewed_at: facture.viewed_at ?? now,
        last_viewed_at: now,
        view_count: (facture.view_count ?? 0) + 1,
      })
      .eq("id", facture.id);

    return { facture, items: items ?? [] };
  });
