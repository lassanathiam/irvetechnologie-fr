import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tokenSchema = z.object({ token: z.string().uuid() });

/** Fiche rendez-vous vue par le client via son lien privé (aucune donnée financière). */
export const getRdvPublic = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => tokenSchema.parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rdv, error } = await supabaseAdmin
      .from("rendezvous")
      .select(
        "id, client_nom, titre, designation, adresse, cp_ville, date_debut, duree_min, statut, rdv_propose_at, rdv_confirme_at, rdv_refuse_at, rdv_client_message",
      )
      .eq("public_token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!rdv) throw new Error("Ce lien de rendez-vous n'est plus valide.");
    return {
      client_nom: rdv.client_nom,
      objet: rdv.designation || rdv.titre,
      adresse: rdv.adresse,
      cp_ville: rdv.cp_ville,
      date_debut: rdv.date_debut,
      duree_min: rdv.duree_min,
      annule: rdv.statut === "annule",
      confirme_at: rdv.rdv_confirme_at,
      refuse_at: rdv.rdv_refuse_at,
      message: rdv.rdv_client_message,
    };
  });

/** Le client confirme le créneau proposé. */
export const confirmerRdvPublic = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => tokenSchema.parse(raw))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { creerNotification } = await import("@/lib/notifications.server");

    const { data: rdv } = await supabaseAdmin
      .from("rendezvous")
      .select("id, client_nom, date_debut, adresse, cp_ville, rdv_confirme_at")
      .eq("public_token", data.token)
      .maybeSingle();
    if (!rdv) throw new Error("Ce lien de rendez-vous n'est plus valide.");
    if (rdv.rdv_confirme_at) return { ok: true as const, already: true };

    const maintenant = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("rendezvous")
      .update({
        rdv_confirme_at: maintenant,
        rdv_refuse_at: null,
        statut: "confirme",
        date_a_confirmer: false,
      })
      .eq("id", rdv.id);
    if (error) throw new Error(error.message);

    const quand = new Date(rdv.date_debut).toLocaleString("fr-FR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    });
    await creerNotification(supabaseAdmin, {
      type: "rdv_confirme",
      titre: `${rdv.client_nom} a confirmé son rendez-vous`,
      message: `${quand} — ${[rdv.adresse, rdv.cp_ville].filter(Boolean).join(", ")}`,
      lien: "/planning",
      meta: { rendezvous_id: rdv.id },
    });

    return { ok: true as const, already: false };
  });

/** Le client refuse le créneau et indique ses disponibilités. */
export const refuserRdvPublic = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) =>
    tokenSchema.extend({ message: z.string().trim().max(600).optional() }).parse(raw),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { creerNotification } = await import("@/lib/notifications.server");

    const { data: rdv } = await supabaseAdmin
      .from("rendezvous")
      .select("id, client_nom, date_debut")
      .eq("public_token", data.token)
      .maybeSingle();
    if (!rdv) throw new Error("Ce lien de rendez-vous n'est plus valide.");

    const { error } = await supabaseAdmin
      .from("rendezvous")
      .update({
        rdv_refuse_at: new Date().toISOString(),
        rdv_confirme_at: null,
        rdv_client_message: data.message ?? null,
        date_a_confirmer: true,
      })
      .eq("id", rdv.id);
    if (error) throw new Error(error.message);

    await creerNotification(supabaseAdmin, {
      type: "rdv_refuse",
      titre: `${rdv.client_nom} demande un autre créneau`,
      message: data.message?.trim() || "Aucune précision indiquée.",
      lien: "/planning",
      meta: { rendezvous_id: rdv.id },
    });

    return { ok: true as const };
  });
