import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/**
 * Accès client au devis via un lien signé (jeton). Aucune authentification :
 * le jeton unique du devis fait office de clé. Lecture/écriture restreintes
 * au seul devis correspondant au jeton.
 */

const tokenSchema = z.object({ token: z.string().uuid() });

function datePlanificationDepuisDevis(dateExpiration: string | null | undefined) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const fallback = today.toISOString().slice(0, 10);
  const base = dateExpiration && /^\d{4}-\d{2}-\d{2}$/.test(dateExpiration) ? dateExpiration : fallback;
  const d = new Date(`${base}T09:00:00`);
  if (Number.isNaN(d.getTime()) || d.getTime() < today.getTime()) {
    return `${fallback}T09:00:00.000Z`;
  }
  return d.toISOString();
}

function extraireDetail(prefixe: string, notes: string | null | undefined): string | null {
  if (!notes) return null;
  const row = notes
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l.toLowerCase().startsWith(prefixe.toLowerCase()));
  if (!row) return null;
  const value = row.split(":").slice(1).join(":").trim();
  return value || null;
}

async function fallbackOwnerUserId(supabaseAdmin: any): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin")
    .limit(1)
    .maybeSingle();
  return data?.user_id ?? null;
}

async function assurerRendezVousDepuisDevis(
  supabaseAdmin: any,
  devis: {
    id: string;
    numero: string;
    client_nom: string | null;
    client_email: string | null;
    client_telephone: string | null;
    client_adresse: string | null;
    client_cp_ville: string | null;
    objet: string | null;
    notes: string | null;
    total_ht: number | null;
    total_tva: number | null;
    date_expiration: string | null;
    created_by: string | null;
    rendezvous_id: string | null;
  },
) {
  if (devis.rendezvous_id) {
    const { data: rdv } = await supabaseAdmin
      .from("rendezvous")
      .select("id, statut")
      .eq("id", devis.rendezvous_id)
      .maybeSingle();
    if (rdv && rdv.statut === "planifie") {
      await supabaseAdmin
        .from("rendezvous")
        .update({ statut: "confirme" })
        .eq("id", rdv.id);
    }
    return devis.rendezvous_id;
  }

  const ownerUserId = devis.created_by ?? (await fallbackOwnerUserId(supabaseAdmin));
  if (!ownerUserId) return null;
  const puissance = extraireDetail("Puissance borne", devis.notes);
  const phase = extraireDetail("Alimentation", devis.notes);
  const typeInstallation = extraireDetail("Installation", devis.notes);
  const typePose =
    typeInstallation && /mur/i.test(typeInstallation)
      ? "Murale"
      : typeInstallation && /sol|pied|borne/i.test(typeInstallation)
        ? "Sur pied"
        : null;

  const totalHt = Number(devis.total_ht ?? 0);
  const totalTva = Number(devis.total_tva ?? 0);
  const tvaPct = totalHt > 0 ? Math.max(0, Math.min(30, Math.round((totalTva / totalHt) * 10000) / 100)) : 20;

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("rendezvous")
    .insert({
      user_id: ownerUserId,
      titre: `Devis ${devis.numero} accepté`,
      type: "installation",
      statut: "confirme",
      client_nom: devis.client_nom ?? "Client",
      client_telephone: devis.client_telephone ?? null,
      client_email: devis.client_email ?? null,
      adresse: devis.client_adresse?.trim() || "Adresse à confirmer",
      cp_ville: devis.client_cp_ville ?? null,
      date_debut: datePlanificationDepuisDevis(devis.date_expiration),
      duree_min: 120,
      notes: [
        `Créé automatiquement depuis le devis ${devis.numero} accepté en ligne.`,
        devis.notes?.trim() ? `Notes devis : ${devis.notes}` : null,
      ]
        .filter(Boolean)
        .join("\n"),
      origine: "direct",
      partenaire: null,
      montant_ht: totalHt,
      tva_pct: tvaPct,
      statut_facturation: "a_facturer",
      designation: devis.objet ?? null,
      puissance_borne: puissance,
      phase_installation: phase,
      type_pose: typePose,
      date_a_confirmer: true,
    })
    .select("id")
    .single();
  if (insertError) return null;

  await supabaseAdmin.from("devis").update({ rendezvous_id: inserted.id }).eq("id", devis.id);
  return inserted.id as string;
}

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
      .select("id, numero, signed_at, client_nom, client_email, client_telephone, client_adresse, client_cp_ville, objet, notes, total_ht, total_tva, date_expiration, created_by, rendezvous_id")
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
    await assurerRendezVousDepuisDevis(supabaseAdmin, devis);

    return { ok: true, already: false };
  });

export const accepterDevisPublic = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    tokenSchema
      .extend({
        signataire_nom: z.string().trim().min(2).max(120),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: devis, error } = await supabaseAdmin
      .from("devis")
      .select("id, numero, signed_at, client_nom, client_email, client_telephone, client_adresse, client_cp_ville, objet, notes, total_ht, total_tva, date_expiration, created_by, rendezvous_id")
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
        signataire_nom: data.signataire_nom,
        statut: "accepte",
      })
      .eq("id", devis.id);
    if (updateError) throw new Error(updateError.message);
    await assurerRendezVousDepuisDevis(supabaseAdmin, devis);

    return { ok: true, already: false };
  });
