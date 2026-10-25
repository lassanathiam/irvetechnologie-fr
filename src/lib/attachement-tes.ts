export type LigneTes = { tes?: boolean | null; quantite: number | string; prix_unitaire: number | string };

/** Montant HT des lignes marquées TES (travaux en supplément / écarts de chantier). */
export function totalTes(items: LigneTes[]) {
  return Math.round(items.filter((i) => i.tes).reduce((s, i) => s + (Number(i.quantite) || 0) * (Number(i.prix_unitaire) || 0), 0) * 100) / 100;
}

/** Nombre de lignes marquées TES. */
export function nbTes(items: LigneTes[]) {
  return items.filter((i) => i.tes).length;
}
