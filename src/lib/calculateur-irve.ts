/**
 * Règles techniques du calculateur de pré-dimensionnement IRVE.
 * Table centralisée : à faire valider par un électricien qualifié IRVE
 * avant toute évolution. Résultats strictement indicatifs.
 */

export type Phase = "mono" | "tri";

export const TENSION = { mono: 230, tri: 400 } as const;
export const COS_PHI = 1; // borne de recharge : charge quasi résistive
export const RESISTIVITE_CU = 0.0225; // Ω·mm²/m (cuivre, valeur de calcul)
export const CHUTE_MAX_PCT = 5; // limite usuelle circuits terminaux
export const SECTIONS = [2.5, 4, 6, 10, 16, 25] as const;

export type RegleBorne = {
  kw: number;
  label: string;
  phase: Phase;
  courantNominal: number; // courant de charge max (A)
  disjoncteur: string;
  sectionMin: number;
};

export const REGLES_BORNES: RegleBorne[] = [
  { kw: 3.7, label: "3,7 kW", phase: "mono", courantNominal: 16, disjoncteur: "Disjoncteur 20 A courbe C (1P+N)", sectionMin: 2.5 },
  { kw: 7.4, label: "7,4 kW", phase: "mono", courantNominal: 32, disjoncteur: "Disjoncteur 40 A courbe C (1P+N)", sectionMin: 10 },
  { kw: 11, label: "11 kW", phase: "tri", courantNominal: 16, disjoncteur: "Disjoncteur 20 A courbe C (3P+N)", sectionMin: 2.5 },
  { kw: 22, label: "22 kW", phase: "tri", courantNominal: 32, disjoncteur: "Disjoncteur 40 A courbe C (3P+N)", sectionMin: 10 },
];

export const DIFFERENTIEL =
  "Interrupteur différentiel 30 mA dédié — type A avec détection 6 mA DC intégrée à la borne, sinon type B (ou type F selon fabricant)";

export const KVA_OPTIONS = ["3 kVA", "6 kVA", "9 kVA", "12 kVA", "15 kVA", "18 kVA", "24 kVA", "Autre"];

export const DISTANCES = [
  { label: "0 à 10 m", m: 10 },
  { label: "10 à 20 m", m: 20 },
  { label: "20 à 30 m", m: 30 },
  { label: "30 à 40 m", m: 40 },
  { label: "40 à 50 m", m: 50 },
  { label: "Plus de 50 m", m: 60 },
];

export function courant(kw: number, phase: Phase) {
  const p = kw * 1000;
  return phase === "mono" ? p / TENSION.mono : p / (Math.sqrt(3) * TENSION.tri * COS_PHI);
}

export function chuteTension(i: number, longueur: number, section: number, phase: Phase) {
  const b = phase === "mono" ? 2 : 1;
  const u0 = phase === "mono" ? TENSION.mono : TENSION.tri / Math.sqrt(3);
  const du = (b * RESISTIVITE_CU * longueur * i * COS_PHI) / section;
  return (du / u0) * 100;
}

export function dimensionner(regle: RegleBorne, longueur: number) {
  const i = courant(regle.kw, regle.phase);
  const iCalc = Math.max(i, regle.courantNominal);
  let section: number | null = null;
  for (const s of SECTIONS) {
    if (s < regle.sectionMin) continue;
    if (chuteTension(iCalc, longueur, s, regle.phase) <= CHUTE_MAX_PCT) {
      section = s;
      break;
    }
  }
  const s = section ?? SECTIONS[SECTIONS.length - 1];
  return {
    courant: i,
    section,
    cable: `${regle.phase === "mono" ? "3G" : "5G"}${String(s).replace(".", ",")} mm² cuivre`,
    chute: chuteTension(iCalc, longueur, s, regle.phase),
  };
}

/** kVA minimal conseillé pour faire fonctionner la borne sans gestion de charge. */
export function kvaInsuffisant(kva: string, kw: number) {
  const n = parseInt(kva, 10);
  if (!n) return false;
  return n < kw + 3;
}
