import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { trajetDepuisBase } from "@/lib/geo";

/**
 * Espace partenaire : un lien secret par partenaire (ex. Pure Énergie).
 * Le partenaire saisit ses dossiers (client, adresse, montant, date ou
 * « rendez-vous à prendre ») et ne voit QUE ses propres dossiers.
 * Aucune authentification : le jeton du partenaire fait office de clé.
 */

const tokenSchema = z.object({ token: z.string().uuid() });

async function geocode(query: string): Promise<{ lat: number; lng: number } | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const res = await fetch(
      `https://api-adresse.data.gouv.fr/search/?limit=1&q=${encodeURIComponent(query)}`,
      { headers: { accept: "application/json" }, signal: controller.signal },
    );
    if (!res.ok) return null;
    const json = (await res.json()) as {
      features?: Array<{ geometry?: { coordinates?: [number, number] } }>;
    };
    const c = json.features?.[0]?.geometry?.coordinates;
    return c ? { lng: c[0], lat: c[1] } : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

/* ------------------------------- Côté équipe ------------------------------ */

export const listPartenaires = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("partenaires")
      .select("id, nom, token, actif, notes, couleur, created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const ids = (data ?? []).map((p) => p.id);
    const counts = new Map<string, number>();
    if (ids.length) {
      const { data: rows } = await context.supabase
        .from("rendezvous")
        .select("partenaire_id")
        .in("partenaire_id", ids)
        .limit(2000);
      for (const r of rows ?? []) {
        if (r.partenaire_id) counts.set(r.partenaire_id, (counts.get(r.partenaire_id) ?? 0) + 1);
      }
    }
    return (data ?? []).map((p) => ({ ...p, dossiers: counts.get(p.id) ?? 0 }));
  });

export const savePartenaire = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (raw: {
      id?: string | null;
      nom: string;
      actif?: boolean;
      notes?: string | null;
      couleur?: string | null;
    }) =>
      z
        .object({
          id: z.string().uuid().optional().nullable(),
          nom: z.string().trim().min(2).max(160),
          actif: z.boolean().default(true),
          notes: z.string().trim().max(1000).optional().nullable(),
          couleur: z
            .string()
            .trim()
            .regex(/^#[0-9a-fA-F]{6}$/, "Couleur invalide")
            .default("#0284c7"),
        })
        .parse(raw),
  )
  .handler(async ({ data, context }) => {
    if (data.id) {
      const { error } = await context.supabase
        .from("partenaires")
        .update({
          nom: data.nom,
          actif: data.actif,
          notes: data.notes ?? null,
          couleur: data.couleur,
        })
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      return { id: data.id };
    }
    const { data: row, error } = await context.supabase
      .from("partenaires")
      .insert({
        nom: data.nom,
        actif: data.actif,
        notes: data.notes ?? null,
        couleur: data.couleur,
        owner_user_id: context.userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id };
  });


export const deletePartenaire = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw: { id: string }) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("partenaires").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ----------------------------- Côté partenaire ---------------------------- */

async function loadPartenaire(token: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("partenaires")
    .select("id, nom, actif, owner_user_id")
    .eq("token", token)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data || !data.actif) throw new Error("Ce lien de saisie n'est plus valide.");
  return { partenaire: data, supabaseAdmin };
}

export const getEspacePartenaire = createServerFn({ method: "GET" })
  .inputValidator((data: { token: string }) => tokenSchema.parse(data))
  .handler(async ({ data }) => {
    const { partenaire, supabaseAdmin } = await loadPartenaire(data.token);
    const { data: dossiers } = await supabaseAdmin
      .from("rendezvous")
      .select(
        "id, titre, designation, client_nom, client_telephone, adresse, cp_ville, date_debut, date_a_confirmer, statut, montant_ht, notes, metrage_m, puissance_borne, phase_installation, type_pose, demarre_at, termine_at, created_at",
      )
      .eq("partenaire_id", partenaire.id)
      .order("created_at", { ascending: false })
      .limit(200);
    return { nom: partenaire.nom, dossiers: dossiers ?? [] };
  });

const dossierSchema = tokenSchema.extend({
  client_nom: z.string().trim().min(2).max(160),
  client_telephone: z.string().trim().max(40).optional().nullable(),
  client_email: z.string().trim().max(255).optional().nullable(),
  adresse: z.string().trim().min(3).max(300),
  cp_ville: z.string().trim().max(160).optional().nullable(),
  designation: z.string().trim().max(200).optional().nullable(),
  metrage_m: z.preprocess((v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }, z.number().min(0).max(10000).nullable()).optional(),
  puissance_borne: z.enum(["3,7 kW", "7,4 kW", "11 kW", "22 kW", "À définir"]).optional().nullable(),
  phase_installation: z.enum(["Monophasé", "Triphasé", "À définir"]).optional().nullable(),
  type_pose: z.enum(["Intérieure", "Extérieure", "Sur pied", "À définir"]).optional().nullable(),
  /** Date/heure souhaitée ; vide = rendez-vous à prendre. */
  date_debut: z.string().trim().max(40).optional().nullable(),
  montant_ht: z
    .preprocess((v) => {
      if (v === null || v === undefined || v === "") return 0;
      const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
      return Number.isFinite(n) ? n : 0;
    }, z.number().min(0).max(1_000_000))
    .default(0),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const creerDossierPartenaire = createServerFn({ method: "POST" })
  .inputValidator((raw: unknown) => dossierSchema.parse(raw))
  .handler(async ({ data }) => {
    const { partenaire, supabaseAdmin } = await loadPartenaire(data.token);
    if (!partenaire.owner_user_id) {
      throw new Error("Ce lien n'est pas encore configuré. Contactez Borne de l'Ouest.");
    }

    const dateSaisie = data.date_debut ? new Date(data.date_debut) : null;
    const dateValide = dateSaisie && !Number.isNaN(dateSaisie.getTime()) ? dateSaisie : null;

    const geo = await geocode([data.adresse, data.cp_ville].filter(Boolean).join(" "));
    const trajet = geo ? trajetDepuisBase(geo.lat, geo.lng) : null;

    const { data: dossier, error } = await supabaseAdmin.from("rendezvous").insert({
      user_id: partenaire.owner_user_id,
      partenaire_id: partenaire.id,
      partenaire: partenaire.nom,
      origine: "sous_traitance",
      titre: data.designation?.trim() || `Intervention ${partenaire.nom}`,
      designation: data.designation ?? null,
      metrage_m: data.metrage_m ?? null,
      puissance_borne: data.puissance_borne ?? null,
      phase_installation: data.phase_installation ?? null,
      type_pose: data.type_pose ?? null,
      type: "installation",
      statut: "planifie",
      client_nom: data.client_nom,
      client_telephone: data.client_telephone ?? null,
      client_email: data.client_email ?? null,
      adresse: data.adresse,
      cp_ville: data.cp_ville ?? null,
      date_debut: (dateValide ?? new Date()).toISOString(),
      date_a_confirmer: !dateValide,
      duree_min: 120,
      montant_ht: data.montant_ht,
      statut_facturation: "a_facturer",
      notes: data.notes ?? null,
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      distance_km: trajet?.distance_km ?? null,
      duree_trajet_min: trajet?.duree_trajet_min ?? null,
    }).select("id").single();
    if (error) throw new Error(error.message);
    return { ok: true, id: dossier.id, geocode: Boolean(geo) };
  });
