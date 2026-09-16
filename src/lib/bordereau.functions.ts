import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BORDEREAU_AXIANS } from "@/lib/bordereau-axians";

/** Bordereau de prix : initialisé depuis les valeurs Axians, puis modifiable dans la plateforme. */
export const listBordereau = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const read = async () =>
      context.supabase
        .from("bordereau_prestations")
        .select("id, categorie, section, libelle, unite, prix_unitaire, actif, ordre")
        .eq("donneur_ordre", "axians")
        .order("ordre");

    let { data, error } = await read();
    if (error) throw new Error(error.message);
    if (!data?.length) {
      const seed = BORDEREAU_AXIANS.map((line, index) => ({
        donneur_ordre: "axians",
        categorie: line.categorie,
        section: line.section,
        libelle: line.libelle,
        unite: line.unite,
        prix_unitaire: line.prix_unitaire,
        ordre: index + 1,
      }));
      const inserted = await context.supabase.from("bordereau_prestations").insert(seed);
      if (inserted.error) throw new Error(inserted.error.message);
      const again = await read();
      if (again.error) throw new Error(again.error.message);
      data = again.data;
    }
    return data ?? [];
  });

export const updateBordereauLigne = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        prix_unitaire: z.number().min(0).max(1_000_000).optional(),
        libelle: z.string().trim().min(1).max(300).optional(),
        unite: z.string().trim().min(1).max(12).optional(),
        actif: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { error } = await context.supabase.from("bordereau_prestations").update(patch).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createBordereauLigne = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) =>
    z
      .object({
        categorie: z.string().trim().min(1).max(120),
        section: z.string().trim().max(160).optional().nullable(),
        libelle: z.string().trim().min(1).max(300),
        unite: z.string().trim().min(1).max(12),
        prix_unitaire: z.number().min(0).max(1_000_000),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("bordereau_prestations")
      .insert({ ...data, donneur_ordre: "axians", ordre: 9999 });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const DONNEURS_DEFAUT = [
  {
    nom: "AXIANS Maintenance Infra Ouest Nantes",
    raison_sociale: "AXIANS (VINCI Energies)",
    adresse: "14 rue des Clairières",
    cp_ville: "44640 Les Sorinières",
    adresse_livraison: "AXIANS MAINTENANCE INFRA OUEST NANTES\n14 rue des Clairières\n44640 Les Sorinières",
    numero_fournisseur: "11692633",
    charge_affaires_nom: "MARTIN JEREMI",
    charge_affaires_email: "jeremi.martin@axians.com",
    charge_affaires_telephone: "0765162842",
    delai_paiement_jours: 60,
    autoliquidation: true,
    notes: "Travaux fibre sous-traités — bordereau Bouygues Telecom.",
  },
  {
    nom: "INFRATEL SERVICES",
    raison_sociale: "INFRATEL SERVICES",
    adresse: "71 rue des Hautes Pâtures – Navarque A",
    cp_ville: "92000 Nanterre",
    adresse_livraison: "AXIANS MAINTENANCE INFRA OUEST NANTES\n14 rue des Clairières\n44640 Les Sorinières",
    numero_fournisseur: "11692633",
    charge_affaires_nom: "MARTIN JEREMI",
    charge_affaires_email: "jeremi.martin@axians.com",
    charge_affaires_telephone: "0765162842",
    delai_paiement_jours: 60,
    autoliquidation: true,
    notes: "Adresse de facturation des commandes Axians / Infratel.",
  },
];

export const listDonneurs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const read = async () => context.supabase.from("donneurs_ordre").select("*").order("nom");
    let { data, error } = await read();
    if (error) throw new Error(error.message);
    if (!data?.length) {
      const inserted = await context.supabase.from("donneurs_ordre").insert(DONNEURS_DEFAUT);
      if (inserted.error) throw new Error(inserted.error.message);
      const again = await read();
      if (again.error) throw new Error(again.error.message);
      data = again.data;
    }
    return data ?? [];
  });

const donneurSchema = z.object({
  id: z.string().uuid().optional(),
  nom: z.string().trim().min(2).max(160),
  raison_sociale: z.string().trim().max(160).optional().nullable(),
  adresse: z.string().trim().max(300).optional().nullable(),
  cp_ville: z.string().trim().max(160).optional().nullable(),
  siret: z.string().trim().max(40).optional().nullable(),
  tva_intracom: z.string().trim().max(40).optional().nullable(),
  numero_fournisseur: z.string().trim().max(60).optional().nullable(),
  adresse_livraison: z.string().trim().max(400).optional().nullable(),
  charge_affaires_nom: z.string().trim().max(160).optional().nullable(),
  charge_affaires_email: z.string().trim().email().max(255).optional().nullable().or(z.literal("")),
  charge_affaires_telephone: z.string().trim().max(40).optional().nullable(),
  delai_paiement_jours: z.number().int().min(0).max(180),
  autoliquidation: z.boolean(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

export const upsertDonneur = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: unknown) => donneurSchema.parse(data))
  .handler(async ({ data, context }) => {
    const payload = { ...data, charge_affaires_email: data.charge_affaires_email || null };
    if (payload.id) {
      const { id, ...patch } = payload;
      const { error } = await context.supabase.from("donneurs_ordre").update(patch).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { id: _ignored, ...insert } = payload;
    const { data: row, error } = await context.supabase.from("donneurs_ordre").insert(insert).select("id").single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });
