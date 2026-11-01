/**
 * Totaux de facturation par client, avec période.
 *
 * Module navigateur (aucun appel base de données) : il sert à la fois à la page
 * Factures et aux contrôles. Une facture « annulée » n'entre jamais dans un total.
 */

export type PeriodeCle = "tout" | "mois_courant" | "mois_precedent" | "personnalise";

export type Periode = {
  /** Premier jour inclus (YYYY-MM-DD) ou null = sans borne basse. */
  du: string | null;
  /** Dernier jour inclus (YYYY-MM-DD) ou null = sans borne haute. */
  au: string | null;
  /** Libellé lisible affiché à l'écran, ex. « Octobre 2026 ». */
  libelle: string;
};

export type FacturePourTotal = {
  id: string;
  numero: string;
  client_nom: string | null;
  objet: string | null;
  statut: string;
  total_ht: number | string;
  total_ttc: number | string;
  date_emission: string;
  paid_at?: string | null;
};

export type TotalClient = {
  nom: string;
  nb: number;
  ht: number;
  ttc: number;
  nbPayees: number;
  htPaye: number;
  ttcPaye: number;
  factures: FacturePourTotal[];
};

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** « 2026-10-01 » -> « octobre 2026 » avec majuscule initiale. */
const moisLong = (ymdStr: string) => {
  const [a, m] = ymdStr.split("-");
  const d = new Date(Number(a), Number(m) - 1, 1);
  const s = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/**
 * Période correspondant à un choix de l'écran.
 * `aujourdhui` permet de tester la règle sans dépendre de la date réelle.
 */
export function periodeDepuisCle(
  cle: PeriodeCle,
  aujourdhui: Date = new Date(),
  duPerso?: string | null,
  auPerso?: string | null,
): Periode {
  if (cle === "tout") return { du: null, au: null, libelle: "Depuis le début" };
  if (cle === "mois_courant") {
    const du = ymd(new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 1));
    const au = ymd(new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() + 1, 0));
    return { du, au, libelle: moisLong(du) };
  }
  if (cle === "mois_precedent") {
    const du = ymd(new Date(aujourdhui.getFullYear(), aujourdhui.getMonth() - 1, 1));
    const au = ymd(new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), 0));
    return { du, au, libelle: moisLong(du) };
  }
  const du = duPerso?.trim() || null;
  const au = auPerso?.trim() || null;
  const libelle =
    du && au ? `Du ${du} au ${au}` : du ? `À partir du ${du}` : au ? `Jusqu'au ${au}` : "Depuis le début";
  return { du, au, libelle };
}

/** Une facture est dans la période si sa date d'émission est comprise entre les deux bornes. */
export function dansPeriode(dateEmission: string, periode: Periode): boolean {
  const d = String(dateEmission ?? "").slice(0, 10);
  if (!d) return false;
  if (periode.du && d < periode.du) return false;
  if (periode.au && d > periode.au) return false;
  return true;
}

/** Total d'une facture (HT ou TTC), quelle que soit la façon dont la base l'a renvoyé. */
const montant = (f: FacturePourTotal, champ: "total_ht" | "total_ttc") => Number(f[champ] ?? 0) || 0;

/**
 * Regroupe les factures par client et additionne leurs montants.
 * Les factures annulées sont écartées ; les autres sont toutes comptées,
 * y compris les brouillons (un brouillon reste une facture émise).
 */
export function totauxParClient(
  factures: FacturePourTotal[],
  periode: Periode,
): TotalClient[] {
  const map = new Map<string, TotalClient>();
  for (const f of factures) {
    if (f.statut === "annulee") continue;
    if (!dansPeriode(f.date_emission, periode)) continue;
    const nom = String(f.client_nom ?? "").trim() || "Client non renseigné";
    let t = map.get(nom);
    if (!t) {
      t = { nom, nb: 0, ht: 0, ttc: 0, nbPayees: 0, htPaye: 0, ttcPaye: 0, factures: [] };
      map.set(nom, t);
    }
    const ht = montant(f, "total_ht");
    const ttc = montant(f, "total_ttc");
    t.nb += 1;
    t.ht += ht;
    t.ttc += ttc;
    t.factures.push(f);
    if (f.statut === "payee") {
      t.nbPayees += 1;
      t.htPaye += ht;
      t.ttcPaye += ttc;
    }
  }
  for (const t of map.values()) {
    t.factures.sort((a, b) =>
      String(b.date_emission).slice(0, 10).localeCompare(String(a.date_emission).slice(0, 10)) ||
      String(b.numero).localeCompare(String(a.numero)),
    );
  }
  return [...map.values()].sort((a, b) => b.ttc - a.ttc || a.nom.localeCompare(b.nom));
}

/** Libellé de la période au format court utilisé dans les messages, ex. « octobre 2026 ». */
export function libellePeriodeCourt(periode: Periode): string {
  if (periode.du && periode.au && periode.du.slice(0, 7) === periode.au.slice(0, 7)) {
    return moisLong(periode.du).toLowerCase();
  }
  return periode.libelle.toLowerCase();
}
