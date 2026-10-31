// Regroupe les chantiers réceptionnés par mois de réception, avec leur montant.
// Module navigateur : aucune dépendance serveur, aucune requête base.

export type ChantierReceptionMontant = {
  receptionne_at: string | null;
  montant_ht?: number | string | null;
};

export type MoisReception = {
  /** Clé stable "AAAA-MM" (heure locale de l'appareil). */
  cle: string;
  /** "octobre 2026" */
  libelle: string;
  nb: number;
  total_ht: number;
};

const ARRONDI = (n: number) => Math.round(n * 100) / 100;

/** Clé "AAAA-MM" du mois de réception, dans le fuseau de l'appareil. */
export function cleMoisReception(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const mois = String(date.getMonth() + 1).padStart(2, "0");
  return `${date.getFullYear()}-${mois}`;
}

/** "2026-10" -> "octobre 2026" */
export function libelleMoisReception(cle: string): string {
  const [annee, mois] = cle.split("-");
  const date = new Date(Number(annee), Number(mois) - 1, 1, 12);
  const libelle = date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return libelle.charAt(0).toUpperCase() + libelle.slice(1);
}

/** Clés des `nbMois` derniers mois (mois courant inclus), du plus récent au plus ancien. */
export function derniersMois(nbMois: number, reference = new Date()): string[] {
  const cles: string[] = [];
  for (let i = 0; i < nbMois; i += 1) {
    const date = new Date(reference.getFullYear(), reference.getMonth() - i, 1, 12);
    cles.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`);
  }
  return cles;
}

/**
 * Months to display: every month that actually has a received chantier, plus the
 * `nbMois` most recent months (so an empty month such as August is visible at 0).
 * Sorted newest first.
 */
export function moisAAfficher(chantiers: ChantierReceptionMontant[], nbMois = 6, reference = new Date()): string[] {
  const cles = new Set<string>(derniersMois(nbMois, reference));
  for (const chantier of chantiers) {
    if (!chantier.receptionne_at) continue;
    const cle = cleMoisReception(chantier.receptionne_at);
    if (cle) cles.add(cle);
  }
  return [...cles].sort((a, b) => b.localeCompare(a));
}

/** Chantiers réceptionnés regroupés par mois, du plus récent au plus ancien. */
export function grouperReceptionParMois(
  chantiers: ChantierReceptionMontant[],
  nbMois = 6,
  reference = new Date(),
): MoisReception[] {
  const totaux = new Map<string, { nb: number; total: number }>();
  for (const chantier of chantiers) {
    if (!chantier.receptionne_at) continue;
    const cle = cleMoisReception(chantier.receptionne_at);
    if (!cle) continue;
    const actuel = totaux.get(cle) ?? { nb: 0, total: 0 };
    totaux.set(cle, { nb: actuel.nb + 1, total: actuel.total + Number(chantier.montant_ht ?? 0) });
  }
  return moisAAfficher(chantiers, nbMois, reference).map((cle) => {
    const { nb, total } = totaux.get(cle) ?? { nb: 0, total: 0 };
    return { cle, libelle: libelleMoisReception(cle), nb, total_ht: ARRONDI(total) };
  });
}

/** Montant HT cumulé des chantiers réceptionnés. */
export function totalReceptionne(chantiers: ChantierReceptionMontant[]): number {
  return ARRONDI(
    chantiers
      .filter((chantier) => chantier.receptionne_at)
      .reduce((somme, chantier) => somme + Number(chantier.montant_ht ?? 0), 0),
  );
}
