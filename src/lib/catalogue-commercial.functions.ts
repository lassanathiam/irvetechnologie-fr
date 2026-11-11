import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { computeTotals, CONDITIONS_DEFAUT } from "@/lib/billing";
import {
  analyserMarge,
  lireCouts,
  palierPourDistance,
  PALIERS_CABLE_M,
  prixRevientHt,
  ttcVersHt,
  type AchatBorne,
  type AnalyseMarge,
  type CoutsReference,
  type PalierCable,
  type Phase,
} from "@/lib/tarification";

/* ------------------------------------------------------------------ */
/* Types partagés                                                      */
/* ------------------------------------------------------------------ */

export type AchatAdmin = {
  fournisseur: string | null;
  reference_fournisseur: string | null;
  prix_achat_ht: number | null;
  tva_achat_pct: number;
  remise_pct: number;
  frais_livraison_ht: number;
  disponibilite: string | null;
  justificatif_path: string | null;
  actualise_le: string | null;
};

export type ProduitCatalogue = {
  id: string;
  marque: string;
  nom_commercial: string;
  reference_constructeur: string | null;
  sku: string | null;
  reference_verifiee: boolean;
  puissance_kw: number;
  phase: Phase;
  nb_phases: number;
  connecteur: string;
  connectivite: string[];
  gestion_dynamique: boolean | null;
  compatible_tic: boolean | null;
  rfid: boolean | null;
  mid: boolean | null;
  autres_fonctions: string | null;
  garantie_ans: number | null;
  fiche_technique_url: string | null;
  site_officiel_url: string | null;
  photos: string[];
  photos_urls: string[];
  prix_public_ttc: number | null;
  notes: string | null;
  actif: boolean;
  ordre: number;
  forfaits: Partial<Record<PalierCable, number>>;
  /** Le prix d'achat est confirmé (sans révéler le montant aux non-administrateurs). */
  achat_confirme: boolean;
  /** Présent uniquement pour un administrateur. */
  achat?: AchatAdmin | null;
  /** Analyse de marge par forfait, sans option — administrateur uniquement. */
  analyses?: Partial<Record<PalierCable, AnalyseMarge>>;
};

export type OptionCatalogue = {
  id: string;
  code: string;
  libelle: string;
  description: string | null;
  prix_ttc: number | null;
  actif: boolean;
  ordre: number;
  cout_ht?: number | null;
};

export type CatalogueCommercial = {
  estAdmin: boolean;
  produits: ProduitCatalogue[];
  options: OptionCatalogue[];
  couts?: CoutsReference;
};

/* ------------------------------------------------------------------ */
/* Outils internes                                                     */
/* ------------------------------------------------------------------ */

type Ctx = { supabase: any; userId: string };

async function verifierEquipe(ctx: Ctx) {
  const { data } = await ctx.supabase.rpc("is_staff");
  if (!data) throw new Error("Accès réservé à l'équipe.");
}

async function estAdministrateur(ctx: Ctx): Promise<boolean> {
  // has_role n'est pas exécutable par les comptes connectés : is_admin() l'appelle côté base.
  const { data } = await ctx.supabase.rpc("is_admin");
  return data === true;
}

async function exigerAdmin(ctx: Ctx) {
  if (!(await estAdministrateur(ctx))) throw new Error("Réservé à l'administrateur.");
}

const num = (v: unknown): number | null => (v == null || v === "" ? null : Number(v));

function versAchat(row: any): AchatAdmin | null {
  if (!row) return null;
  return {
    fournisseur: row.fournisseur,
    reference_fournisseur: row.reference_fournisseur,
    prix_achat_ht: num(row.prix_achat_ht),
    tva_achat_pct: Number(row.tva_achat_pct ?? 20),
    remise_pct: Number(row.remise_pct ?? 0),
    frais_livraison_ht: Number(row.frais_livraison_ht ?? 0),
    disponibilite: row.disponibilite,
    justificatif_path: row.justificatif_path,
    actualise_le: row.actualise_le,
  };
}

async function chargerCouts(admin: any): Promise<CoutsReference> {
  const { data } = await admin.from("tarification_couts").select("valeurs").eq("id", 1).maybeSingle();
  return lireCouts(data?.valeurs);
}

/* ------------------------------------------------------------------ */
/* Lecture                                                             */
/* ------------------------------------------------------------------ */

export const getCatalogueCommercial = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CatalogueCommercial> => {
    await verifierEquipe(context);
    const estAdmin = await estAdministrateur(context);
    const [{ data: produits, error }, { data: forfaits }, { data: options }] = await Promise.all([
      context.supabase.from("catalogue_produits").select("*").order("ordre").order("marque"),
      context.supabase.from("catalogue_forfaits").select("produit_id, palier_m, prix_ttc"),
      context.supabase.from("catalogue_options").select("*").order("ordre"),
    ]);
    if (error) throw new Error(error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: achats } = await supabaseAdmin.from("catalogue_prix_achat").select("*");
    const achatParProduit = new Map<string, AchatAdmin>();
    for (const a of achats ?? []) {
      const v = versAchat(a);
      if (v) achatParProduit.set(a.produit_id, v);
    }
    const couts = estAdmin ? await chargerCouts(supabaseAdmin) : undefined;
    let coutsOptions = new Map<string, number | null>();
    if (estAdmin) {
      const { data } = await supabaseAdmin.from("catalogue_options_couts").select("option_id, cout_ht");
      coutsOptions = new Map((data ?? []).map((o: any) => [o.option_id, num(o.cout_ht)]));
    }

    // Photos : bucket privé, liens signés valables 12 h.
    const chemins = (produits ?? []).flatMap((p: any) => (Array.isArray(p.photos) ? p.photos : []));
    const urls = new Map<string, string>();
    if (chemins.length) {
      const { data: signes } = await context.supabase.storage
        .from("borne-photos")
        .createSignedUrls(chemins, 60 * 60 * 12);
      for (const s of signes ?? []) if (s.path && s.signedUrl) urls.set(s.path, s.signedUrl);
    }

    const liste: ProduitCatalogue[] = (produits ?? []).map((p: any) => {
      const f: Partial<Record<PalierCable, number>> = {};
      for (const row of forfaits ?? []) {
        if (row.produit_id === p.id) f[row.palier_m as PalierCable] = Number(row.prix_ttc);
      }
      const achat = achatParProduit.get(p.id) ?? null;
      const photos: string[] = Array.isArray(p.photos) ? p.photos : [];
      const produit: ProduitCatalogue = {
        id: p.id,
        marque: p.marque,
        nom_commercial: p.nom_commercial,
        reference_constructeur: p.reference_constructeur,
        sku: p.sku,
        reference_verifiee: p.reference_verifiee,
        puissance_kw: Number(p.puissance_kw),
        phase: p.phase as Phase,
        nb_phases: p.nb_phases,
        connecteur: p.connecteur,
        connectivite: p.connectivite ?? [],
        gestion_dynamique: p.gestion_dynamique,
        compatible_tic: p.compatible_tic,
        rfid: p.rfid,
        mid: p.mid,
        autres_fonctions: p.autres_fonctions,
        garantie_ans: num(p.garantie_ans),
        fiche_technique_url: p.fiche_technique_url,
        site_officiel_url: p.site_officiel_url,
        photos,
        photos_urls: photos.map((c) => urls.get(c)).filter((u): u is string => Boolean(u)),
        prix_public_ttc: num(p.prix_public_ttc),
        notes: p.notes,
        actif: p.actif,
        ordre: p.ordre,
        forfaits: f,
        achat_confirme: Boolean(achat?.prix_achat_ht && achat.prix_achat_ht > 0),
      };
      if (estAdmin && couts) {
        produit.achat = achat;
        produit.analyses = {};
        for (const palier of PALIERS_CABLE_M) {
          const prix = f[palier];
          if (prix == null) continue;
          produit.analyses[palier] = analyserMarge(
            prix,
            prixRevientHt({ achat, couts, phase: produit.phase, metres: palier }),
          );
        }
      }
      return produit;
    });

    return {
      estAdmin,
      produits: liste,
      options: (options ?? []).map((o: any) => ({
        id: o.id,
        code: o.code,
        libelle: o.libelle,
        description: o.description,
        prix_ttc: num(o.prix_ttc),
        actif: o.actif,
        ordre: o.ordre,
        ...(estAdmin ? { cout_ht: coutsOptions.get(o.id) ?? null } : {}),
      })),
      ...(estAdmin ? { couts } : {}),
    };
  });

/* ------------------------------------------------------------------ */
/* Administration                                                      */
/* ------------------------------------------------------------------ */

const urlOuVide = z
  .string()
  .trim()
  .max(500)
  .nullish()
  .transform((v) => (v ? v : null))
  .refine((v) => v == null || /^https:\/\//.test(v), "Lien https:// attendu");

const produitSchema = z.object({
  id: z.string().uuid().optional(),
  marque: z.string().trim().min(1).max(80),
  nom_commercial: z.string().trim().min(1).max(160),
  reference_constructeur: z.string().trim().max(80).nullish(),
  sku: z.string().trim().max(80).nullish(),
  reference_verifiee: z.boolean(),
  puissance_kw: z.number().min(1).max(50),
  phase: z.enum(["mono", "tri", "mono_tri"]),
  nb_phases: z.number().int().min(1).max(3),
  connecteur: z.enum(["prise_t2", "cable"]),
  connectivite: z.array(z.string().trim().max(30)).max(8),
  gestion_dynamique: z.boolean().nullable(),
  compatible_tic: z.boolean().nullable(),
  rfid: z.boolean().nullable(),
  mid: z.boolean().nullable(),
  autres_fonctions: z.string().trim().max(500).nullish(),
  garantie_ans: z.number().min(0).max(15).nullable(),
  fiche_technique_url: urlOuVide,
  site_officiel_url: urlOuVide,
  photos: z.array(z.string().max(300)).max(12),
  prix_public_ttc: z.number().min(0).max(100000).nullable(),
  notes: z.string().trim().max(1000).nullish(),
  actif: z.boolean(),
  ordre: z.number().int().min(0).max(9999),
});

export const enregistrerProduitCatalogue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => produitSchema.parse(d))
  .handler(async ({ context, data }) => {
    await exigerAdmin(context);
    const { id, ...champs } = data;
    const ligne = {
      ...champs,
      reference_constructeur: champs.reference_constructeur || null,
      sku: champs.sku || null,
      autres_fonctions: champs.autres_fonctions || null,
      notes: champs.notes || null,
    };
    if (id) {
      const { error } = await context.supabase.from("catalogue_produits").update(ligne).eq("id", id);
      if (error) throw new Error(error.message);
      return { id };
    }
    const { data: row, error } = await context.supabase
      .from("catalogue_produits")
      .insert(ligne)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: row.id as string };
  });

export const supprimerProduitCatalogue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    await exigerAdmin(context);
    const { error } = await context.supabase.from("catalogue_produits").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

const achatSchema = z.object({
  produit_id: z.string().uuid(),
  fournisseur: z.string().trim().max(120).nullish(),
  reference_fournisseur: z.string().trim().max(80).nullish(),
  prix_achat_ht: z.number().min(0).max(100000).nullable(),
  tva_achat_pct: z.number().min(0).max(30),
  remise_pct: z.number().min(0).max(100),
  frais_livraison_ht: z.number().min(0).max(10000),
  disponibilite: z.string().trim().max(120).nullish(),
  justificatif_path: z.string().max(300).nullish(),
  actualise_le: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullish(),
});

export const enregistrerAchatCatalogue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => achatSchema.parse(d))
  .handler(async ({ context, data }) => {
    await exigerAdmin(context);
    const { error } = await context.supabase.from("catalogue_prix_achat").upsert(
      {
        ...data,
        fournisseur: data.fournisseur || null,
        reference_fournisseur: data.reference_fournisseur || null,
        disponibilite: data.disponibilite || null,
        justificatif_path: data.justificatif_path || null,
        actualise_le: data.actualise_le || null,
        prix_achat_ht: data.prix_achat_ht && data.prix_achat_ht > 0 ? data.prix_achat_ht : null,
      },
      { onConflict: "produit_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

export const lienJustificatifAchat = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ path: z.string().min(1).max(300) }).parse(d))
  .handler(async ({ context, data }) => {
    await exigerAdmin(context);
    const { data: s, error } = await context.supabase.storage
      .from("achats-fournisseurs")
      .createSignedUrl(data.path, 600);
    if (error || !s) throw new Error("Justificatif introuvable.");
    return { url: s.signedUrl as string };
  });

const forfaitsSchema = z.object({
  produit_id: z.string().uuid(),
  forfaits: z.object({
    5: z.number().min(0).max(100000).nullable(),
    10: z.number().min(0).max(100000).nullable(),
    15: z.number().min(0).max(100000).nullable(),
    20: z.number().min(0).max(100000).nullable(),
  }),
});

export const enregistrerForfaitsCatalogue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => forfaitsSchema.parse(d))
  .handler(async ({ context, data }) => {
    await exigerAdmin(context);
    const aGarder = PALIERS_CABLE_M.filter((p) => (data.forfaits[p] ?? 0) > 0);
    const aRetirer = PALIERS_CABLE_M.filter((p) => !aGarder.includes(p));
    if (aGarder.length) {
      const { error } = await context.supabase.from("catalogue_forfaits").upsert(
        aGarder.map((p) => ({ produit_id: data.produit_id, palier_m: p, prix_ttc: data.forfaits[p] as number })),
        { onConflict: "produit_id,palier_m" },
      );
      if (error) throw new Error(error.message);
    }
    if (aRetirer.length) {
      const { error } = await context.supabase
        .from("catalogue_forfaits")
        .delete()
        .eq("produit_id", data.produit_id)
        .in("palier_m", aRetirer);
      if (error) throw new Error(error.message);
    }
    return { ok: true as const };
  });

const optionSchema = z.object({
  id: z.string().uuid().optional(),
  code: z.string().trim().min(2).max(40).regex(/^[a-z0-9_]+$/),
  libelle: z.string().trim().min(1).max(160),
  description: z.string().trim().max(600).nullish(),
  prix_ttc: z.number().min(0).max(100000).nullable(),
  cout_ht: z.number().min(0).max(100000).nullable(),
  actif: z.boolean(),
  ordre: z.number().int().min(0).max(9999),
});

export const enregistrerOptionCatalogue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => optionSchema.parse(d))
  .handler(async ({ context, data }) => {
    await exigerAdmin(context);
    const { id, cout_ht, ...champs } = data;
    const ligne = { ...champs, description: champs.description || null };
    let optionId = id;
    if (id) {
      const { error } = await context.supabase.from("catalogue_options").update(ligne).eq("id", id);
      if (error) throw new Error(error.message);
    } else {
      const { data: row, error } = await context.supabase
        .from("catalogue_options")
        .insert(ligne)
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      optionId = row.id as string;
    }
    const { error } = await context.supabase
      .from("catalogue_options_couts")
      .upsert({ option_id: optionId as string, cout_ht, updated_at: new Date().toISOString() }, { onConflict: "option_id" });
    if (error) throw new Error(error.message);
    return { id: optionId as string };
  });

const coutsSchema = z.object({
  protections_mono_ht: z.number().min(0).max(10000).nullable(),
  protections_tri_ht: z.number().min(0).max(10000).nullable(),
  cable_mono_m_ht: z.number().min(0).max(1000).nullable(),
  cable_tri_m_ht: z.number().min(0).max(1000).nullable(),
  fournitures_ht: z.number().min(0).max(10000).nullable(),
  temps_pose_h: z.number().min(0).max(100).nullable(),
  minutes_par_metre_supp: z.number().min(0).max(120).nullable(),
  cout_horaire_ht: z.number().min(0).max(1000).nullable(),
  deplacement_ht: z.number().min(0).max(10000).nullable(),
  publicite_par_client_ht: z.number().min(0).max(10000).nullable(),
});

export const enregistrerCoutsReference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => coutsSchema.parse(d))
  .handler(async ({ context, data }) => {
    await exigerAdmin(context);
    const { error } = await context.supabase
      .from("tarification_couts")
      .upsert({ id: 1, valeurs: data, updated_at: new Date().toISOString() }, { onConflict: "id" });
    if (error) throw new Error(error.message);
    return { ok: true as const };
  });

/* ------------------------------------------------------------------ */
/* Proposition depuis une demande client                               */
/* ------------------------------------------------------------------ */

const propositionSchema = z.object({
  produit_id: z.string().uuid(),
  distance_m: z.number().min(0).max(500),
  option_ids: z.array(z.string().uuid()).max(15).default([]),
});

export type AnalyseProposition = {
  etude: boolean;
  palier: PalierCable | null;
  achat_confirme: boolean;
  forfait_ttc: number | null;
  options_ttc: number;
  total_ttc: number | null;
  suffisante: boolean;
  /** Marge entre 490 et 499 € HT : acceptée avec un simple avertissement. */
  tolerance: boolean;
  provisoire: boolean;
  /** Montants internes — administrateur uniquement. */
  detail?: AnalyseMarge;
};

type Calcul = {
  analyse: AnalyseProposition;
  produit: any;
  options: { id: string; libelle: string; description: string | null; prix_ttc: number; cout_ht: number | null }[];
  marge: AnalyseMarge | null;
};

async function calculerProposition(ctx: Ctx, input: z.infer<typeof propositionSchema>): Promise<Calcul> {
  await verifierEquipe(ctx);
  const { data: produit, error } = await ctx.supabase
    .from("catalogue_produits")
    .select("*")
    .eq("id", input.produit_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!produit) throw new Error("Cette borne n'existe plus dans le catalogue.");

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const palier = palierPourDistance(input.distance_m);
  const [{ data: achatRow }, couts, { data: forfait }, { data: opts }, { data: optCouts }] = await Promise.all([
    supabaseAdmin.from("catalogue_prix_achat").select("*").eq("produit_id", produit.id).maybeSingle(),
    chargerCouts(supabaseAdmin),
    palier
      ? ctx.supabase
          .from("catalogue_forfaits")
          .select("prix_ttc")
          .eq("produit_id", produit.id)
          .eq("palier_m", palier)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    input.option_ids.length
      ? ctx.supabase.from("catalogue_options").select("*").in("id", input.option_ids).eq("actif", true)
      : Promise.resolve({ data: [] }),
    input.option_ids.length
      ? supabaseAdmin.from("catalogue_options_couts").select("option_id, cout_ht").in("option_id", input.option_ids)
      : Promise.resolve({ data: [] }),
  ]);
  const achat = versAchat(achatRow);
  const coutOpt = new Map((optCouts ?? []).map((o: any) => [o.option_id, num(o.cout_ht)]));
  const options = (opts ?? [])
    .filter((o: any) => o.prix_ttc != null)
    .map((o: any) => ({
      id: o.id as string,
      libelle: o.libelle as string,
      description: o.description as string | null,
      prix_ttc: Number(o.prix_ttc),
      cout_ht: coutOpt.get(o.id) ?? null,
    }));
  const optionsTtc = options.reduce((s: number, o: { prix_ttc: number }) => s + o.prix_ttc, 0);
  const forfaitTtc = forfait?.prix_ttc != null ? Number(forfait.prix_ttc) : null;
  const achatConfirme = Boolean(achat?.prix_achat_ht && achat.prix_achat_ht > 0);

  let marge: AnalyseMarge | null = null;
  if (palier && forfaitTtc != null) {
    marge = analyserMarge(
      forfaitTtc + optionsTtc,
      prixRevientHt({
        achat: achat as AchatBorne | null,
        couts,
        phase: produit.phase as Phase,
        metres: palier,
        options,
      }),
    );
  }
  const estAdmin = await estAdministrateur(ctx);
  return {
    produit,
    options,
    marge,
    analyse: {
      etude: palier == null,
      palier,
      achat_confirme: achatConfirme,
      forfait_ttc: forfaitTtc,
      options_ttc: optionsTtc,
      total_ttc: forfaitTtc != null ? forfaitTtc + optionsTtc : null,
      suffisante: Boolean(marge?.suffisante),
      tolerance: marge?.niveau === "tolerance",
      provisoire: Boolean(marge?.provisoire),
      ...(estAdmin && marge ? { detail: marge } : {}),
    },
  };
}

export const analyserPropositionCatalogue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => propositionSchema.parse(d))
  .handler(async ({ context, data }) => (await calculerProposition(context, data)).analyse);

const PHASE_TEXTE: Record<string, string> = { mono: "monophasé", tri: "triphasé", mono_tri: "mono/triphasé" };

/** Libellé client de la borne (aucun coût interne). */
export function libelleBorne(p: { marque: string; nom_commercial: string; puissance_kw: number; phase: string }) {
  const kw = String(p.puissance_kw).replace(".", ",");
  const puissance = /kW/i.test(p.nom_commercial) ? "" : ` ${kw} kW`;
  return `Borne ${p.marque} ${p.nom_commercial}${puissance} ${PHASE_TEXTE[p.phase] ?? ""}`.trim();
}

const envoiSchema = propositionSchema.extend({
  prenom: z.string().trim().max(80).nullish(),
  nom: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(255).nullish().or(z.literal("")),
  telephone: z.string().trim().max(40).nullish(),
  adresse: z.string().trim().max(300).nullish(),
  cp_ville: z.string().trim().max(160).nullish(),
  envoyer: z.boolean(),
  type_pose: z.string().trim().max(80).nullish(),
  derogation_motif: z.string().trim().max(500).nullish(),
});

export const envoyerPropositionCatalogue = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => envoiSchema.parse(d))
  .handler(async ({ context, data }) => {
    const calc = await calculerProposition(context, data);
    const { analyse, produit, options, marge } = calc;
    if (analyse.etude) throw new Error("Plus de 20 m : faites une étude personnalisée, pas de prix automatique.");
    if (!analyse.achat_confirme)
      throw new Error("Prix d'achat à confirmer : cette borne ne peut pas encore être proposée.");
    if (analyse.forfait_ttc == null || !marge)
      throw new Error(`Aucun prix n'est renseigné pour le forfait ${analyse.palier} m de cette borne.`);

    // Verrou : sous 490 € HT de marge, aucune proposition, même pour l'administrateur.
    if (!marge.suffisante)
      throw new Error(
        `Marge trop faible (${marge.marge_ht} € HT, minimum 490 €). Prix conseillé : ${marge.prix_conseille_ttc} € TTC.`,
      );
    const motif: string | null = null;

    const borne = libelleBorne(produit);
    const descriptif = [
      `Fourniture et pose de la ${borne}${produit.reference_constructeur ? ` (réf. ${produit.reference_constructeur})` : ""}`,
      "",
      `— Forfait installation jusqu'à ${analyse.palier} m de câble entre le tableau et la borne`,
      `— Création d'une ligne d'alimentation dédiée (${produit.phase === "tri" ? "5G6" : "3G10"} mm²)`,
      "— Fourniture et pose des protections électriques dédiées",
      "— Gaine / fourreau et accessoires de cheminement",
      "— Raccordement au tableau électrique",
      "— Mise en service, essais et contrôles",
      "— Rapport de fin de chantier et dossier technique",
    ].join("\n");

    const items = [
      {
        libelle: `${borne} — forfait jusqu'à ${analyse.palier} m`,
        description: descriptif,
        quantite: 1,
        prix_unitaire: ttcVersHt(analyse.forfait_ttc),
        tva: 20,
      },
      ...options.map((o) => ({
        libelle: o.libelle,
        description: o.description,
        quantite: 1,
        prix_unitaire: ttcVersHt(o.prix_ttc),
        tva: 20,
      })),
    ];
    const totals = computeTotals(items, 0);
    const emission = new Date().toISOString().slice(0, 10);
    const expiration = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
    const prefix = `D-${emission.slice(0, 4)}-`;
    const { data: dernier } = await context.supabase
      .from("devis")
      .select("numero")
      .like("numero", `${prefix}%`)
      .order("numero", { ascending: false })
      .limit(1);
    const last = dernier?.[0]?.numero ? Number(String(dernier[0].numero).slice(prefix.length)) : 277;
    const numero = `${prefix}${String((Number.isFinite(last) ? last : 277) + 1).padStart(4, "0")}`;
    const nomComplet = [data.prenom?.trim(), data.nom.trim()].filter(Boolean).join(" ");
    const objet = `Installation d'une borne de recharge — ${borne}`;

    const { data: devis, error } = await context.supabase
      .from("devis")
      .insert({
        numero,
        client_nom: nomComplet,
        client_email: data.email || null,
        client_telephone: data.telephone || null,
        client_adresse: data.adresse || null,
        client_cp_ville: data.cp_ville || null,
        objet,
        date_emission: emission,
        date_expiration: expiration,
        remise_pct: 0,
        acompte_pct: 30,
        conditions_paiement: CONDITIONS_DEFAUT,
        notes: [
          `Distance tableau → borne indiquée : ${data.distance_m} m (forfait jusqu'à ${analyse.palier} m).`,
          data.type_pose ? `Type d'installation : ${data.type_pose}.` : null,
        ]
          .filter(Boolean)
          .join("\n"),
        total_ht_brut: totals.total_ht_brut,
        total_remise: totals.total_remise,
        total_ht: totals.total_ht,
        total_tva: totals.total_tva,
        total_ttc: totals.total_ttc,
        created_by: context.userId,
      })
      .select("id, numero, public_token")
      .single();
    if (error) throw new Error(error.message);

    const { error: itemsError } = await context.supabase.from("devis_items").insert(
      items.map((item, index) => ({ devis_id: devis.id, ...item, description: item.description ?? null, ordre: index + 1 })),
    );
    if (itemsError) throw new Error(itemsError.message);

    // Copie interne de la marge au moment du devis (lecture réservée à l'administrateur).
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("devis_marges").insert({
      devis_id: devis.id,
      produit_id: produit.id,
      produit_libelle: borne,
      palier_m: analyse.palier,
      distance_m: data.distance_m,
      options: options.map((o) => ({ libelle: o.libelle, prix_ttc: o.prix_ttc, cout_ht: o.cout_ht })),
      prix_vente_ht: marge.prix_vente_ht,
      cout_revient_ht: marge.revient_ht ?? 0,
      marge_ht: marge.marge_ht ?? 0,
      couts_complets: !marge.provisoire,
      derogation_motif: motif,
      derogation_par: motif ? context.userId : null,
    });

    const base = (process.env["PUBLIC_SITE_URL"] || "https://www.irvetechnologie.fr").replace(/\/$/, "");
    const lien = `${base}/devis-client/${devis.public_token}`;
    if (!data.envoyer || !data.email) {
      return { id: devis.id as string, numero: devis.numero as string, lien, sent: false, total_ttc: totals.total_ttc };
    }

    const message =
      "Suite à votre demande, voici notre proposition d'installation de borne de recharge, réalisée par un électricien qualifié IRVE (P1/P2/P3). Nous restons disponibles pour tout ajustement.";
    const { sendTemplateEmail } = await import("@/lib/email-templates/send-email");
    const { resoudreCopieEnsio } = await import("@/lib/copie-ensio.server");
    const result = await sendTemplateEmail("devis-client", data.email, {
      copieEnsio: await resoudreCopieEnsio(context.supabase, data.email, nomComplet),
      idempotencyKey: `devis-${devis.id}`,
      replyTo: "contacts@irvetechnologie.fr",
      templateData: {
        type: "devis",
        numero: devis.numero,
        client_nom: nomComplet,
        objet,
        date_emission: emission,
        date_limite: expiration,
        message,
        lien,
        remise_pct: 0,
        total_ht_brut: totals.total_ht_brut,
        total_remise: totals.total_remise,
        total_ht: totals.total_ht,
        total_tva: totals.total_tva,
        total_ttc: totals.total_ttc,
        acompte_pct: 30,
        conditions_paiement: CONDITIONS_DEFAUT,
        items,
      },
    });
    await context.supabase.from("devis_envois").insert({
      devis_id: devis.id,
      destinataire: data.email,
      message,
      resultat: result.sent ? "envoye" : "bloque",
      created_by: context.userId,
    });
    if (result.sent) {
      await context.supabase
        .from("devis")
        .update({ sent_at: new Date().toISOString(), statut: "envoye" })
        .eq("id", devis.id);
    }
    return { id: devis.id as string, numero: devis.numero as string, lien, sent: result.sent, total_ttc: totals.total_ttc };
  });
