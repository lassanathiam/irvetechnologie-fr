/**
 * Règles de prix de la vente directe (borne fournie et posée par IRVE Technologie).
 * Module partagé navigateur/serveur, sans dépendance : calcul du prix de revient,
 * de la marge et du prix TTC minimum. Les montants d'achat n'y sont jamais stockés.
 */

export const TVA_VENTE_PCT = 20;
export const MARGE_MINIMUM_HT = 500;
export const PALIERS_CABLE_M = [5, 10, 15, 20] as const;
export type PalierCable = (typeof PALIERS_CABLE_M)[number];
/** Au-delà de cette distance : étude personnalisée, aucun prix automatique. */
export const DISTANCE_MAX_FORFAIT_M = 20;

/** Coûts de référence saisis par l'administration (HT). `null` = à renseigner. */
export interface CoutsReference {
  protections_mono_ht: number | null;
  protections_tri_ht: number | null;
  cable_mono_m_ht: number | null;
  cable_tri_m_ht: number | null;
  fournitures_ht: number | null;
  temps_pose_h: number | null;
  minutes_par_metre_supp: number | null;
  cout_horaire_ht: number | null;
  deplacement_ht: number | null;
  publicite_par_client_ht: number | null;
}

export const COUTS_DEFAUT: CoutsReference = {
  protections_mono_ht: null,
  protections_tri_ht: null,
  cable_mono_m_ht: null,
  cable_tri_m_ht: null,
  fournitures_ht: null,
  temps_pose_h: null,
  minutes_par_metre_supp: null,
  cout_horaire_ht: null,
  deplacement_ht: null,
  /** Coût publicitaire de référence indiqué par le gérant : 30 € par client signé. */
  publicite_par_client_ht: 30,
};

export const LIBELLES_COUTS: Record<keyof CoutsReference, string> = {
  protections_mono_ht: "Protections électriques monophasé (€ HT)",
  protections_tri_ht: "Protections électriques triphasé (€ HT)",
  cable_mono_m_ht: "Câble monophasé 3G10, par mètre (€ HT)",
  cable_tri_m_ht: "Câble triphasé 5G6, par mètre (€ HT)",
  fournitures_ht: "Gaines, accessoires et consommables (€ HT)",
  temps_pose_h: "Temps de pose de base (heures)",
  minutes_par_metre_supp: "Temps en plus par mètre au-delà de 5 m (minutes)",
  cout_horaire_ht: "Coût horaire de main-d'œuvre (€ HT)",
  deplacement_ht: "Carburant, déplacement et véhicule par chantier (€ HT)",
  publicite_par_client_ht: "Publicité par client signé (€ HT)",
};

export interface AchatBorne {
  prix_achat_ht: number | null;
  remise_pct: number;
  frais_livraison_ht: number;
}

export type Phase = "mono" | "tri" | "mono_tri";

export interface OptionChiffree {
  libelle: string;
  prix_ttc: number;
  cout_ht: number | null;
}

const arrondi = (n: number) => Math.round(n * 100) / 100;

export const ttcVersHt = (ttc: number) => arrondi(ttc / (1 + TVA_VENTE_PCT / 100));
export const htVersTtc = (ht: number) => arrondi(ht * (1 + TVA_VENTE_PCT / 100));

/** Forfait correspondant à une distance tableau → borne ; `null` au-delà de 20 m (étude). */
export function palierPourDistance(distanceM: number | null | undefined): PalierCable | null {
  const d = Number(distanceM);
  if (!Number.isFinite(d) || d <= 0) return 5;
  if (d > DISTANCE_MAX_FORFAIT_M) return null;
  return PALIERS_CABLE_M.find((p) => d <= p) ?? null;
}

/** Prix net de la borne pour IRVE Technologie, ou `null` si le prix d'achat n'est pas confirmé. */
export function coutBorneNetHt(achat: AchatBorne | null | undefined): number | null {
  if (!achat || achat.prix_achat_ht == null || !(achat.prix_achat_ht > 0)) return null;
  const remise = Math.min(Math.max(achat.remise_pct || 0, 0), 100);
  return arrondi(achat.prix_achat_ht * (1 - remise / 100) + (achat.frais_livraison_ht || 0));
}

export interface DetailRevient {
  borne: number;
  protections: number;
  cable: number;
  fournitures: number;
  main_oeuvre: number;
  deplacement: number;
  publicite: number;
  options: number;
}

export interface ResultatRevient {
  /** `null` = impossible à calculer (prix d'achat de la borne non confirmé). */
  total_ht: number | null;
  detail: DetailRevient | null;
  /** Coûts de référence ou d'options encore vides : la marge est provisoire. */
  manquants: string[];
}

/** Prix de revient HT d'une installation : borne + protections + câble + pose + déplacement + pub + options. */
export function prixRevientHt(params: {
  achat: AchatBorne | null | undefined;
  couts: CoutsReference;
  phase: Phase;
  metres: number;
  options?: OptionChiffree[];
}): ResultatRevient {
  const { couts, metres } = params;
  const tri = params.phase === "tri";
  const manquants: string[] = [];
  const val = (cle: keyof CoutsReference) => {
    const v = couts[cle];
    if (v == null) {
      manquants.push(LIBELLES_COUTS[cle]);
      return 0;
    }
    return v;
  };
  const borne = coutBorneNetHt(params.achat);
  const protections = val(tri ? "protections_tri_ht" : "protections_mono_ht");
  const prixMetre = val(tri ? "cable_tri_m_ht" : "cable_mono_m_ht");
  const fournitures = val("fournitures_ht");
  const heures = val("temps_pose_h");
  const minutesSupp = val("minutes_par_metre_supp");
  const horaire = val("cout_horaire_ht");
  const deplacement = val("deplacement_ht");
  const publicite = val("publicite_par_client_ht");
  let options = 0;
  for (const o of params.options ?? []) {
    if (o.cout_ht == null) manquants.push(`Coût de l'option « ${o.libelle} »`);
    else options += o.cout_ht;
  }
  const m = Math.max(0, metres);
  const detail: DetailRevient = {
    borne: borne ?? 0,
    protections,
    cable: arrondi(m * prixMetre),
    fournitures,
    main_oeuvre: arrondi((heures + (Math.max(0, m - 5) * minutesSupp) / 60) * horaire),
    deplacement,
    publicite,
    options: arrondi(options),
  };
  if (borne == null) return { total_ht: null, detail, manquants };
  const total = Object.values(detail).reduce((s, v) => s + v, 0);
  return { total_ht: arrondi(total), detail, manquants };
}

/** Prix TTC minimum pour garder 500 € de marge : (prix de revient HT + 500 €) × 1,20. */
export function prixMinimumTtc(revientHt: number): number {
  return htVersTtc(revientHt + MARGE_MINIMUM_HT);
}

export interface AnalyseMarge {
  prix_vente_ttc: number;
  prix_vente_ht: number;
  revient_ht: number | null;
  marge_ht: number | null;
  prix_minimum_ttc: number | null;
  /** true seulement si la marge est calculable et ≥ 500 €. */
  suffisante: boolean;
  provisoire: boolean;
  manquants: string[];
}

/** Marge = prix de vente HT − total des coûts directs HT. */
export function analyserMarge(prixVenteTtc: number, revient: ResultatRevient): AnalyseMarge {
  const ht = ttcVersHt(prixVenteTtc);
  const marge = revient.total_ht == null ? null : arrondi(ht - revient.total_ht);
  return {
    prix_vente_ttc: arrondi(prixVenteTtc),
    prix_vente_ht: ht,
    revient_ht: revient.total_ht,
    marge_ht: marge,
    prix_minimum_ttc: revient.total_ht == null ? null : prixMinimumTtc(revient.total_ht),
    suffisante: marge != null && marge >= MARGE_MINIMUM_HT,
    provisoire: revient.manquants.length > 0,
    manquants: revient.manquants,
  };
}

/** Lit un objet de coûts enregistré en gardant uniquement les nombres valides. */
export function lireCouts(brut: unknown): CoutsReference {
  const src = (brut && typeof brut === "object" ? brut : {}) as Record<string, unknown>;
  const out = { ...COUTS_DEFAUT };
  for (const cle of Object.keys(COUTS_DEFAUT) as (keyof CoutsReference)[]) {
    if (!(cle in src)) continue;
    const v = src[cle];
    out[cle] = typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
  }
  return out;
}
