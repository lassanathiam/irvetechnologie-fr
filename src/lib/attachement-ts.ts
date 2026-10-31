export type LigneTs = { libelle: string; description?: string | null; quantite: number; prix_unitaire: number; rendezvous_id?: string | null };

/** Un document TS contient uniquement les nouvelles lignes saisies, jamais celles du document initial. */
export function preparerLignesTs(lignes: LigneTs[]) {
  if (!lignes.length) throw new Error("Ajoutez une ligne de travaux supplémentaires.");
  return lignes.map((ligne) => ({ ...ligne, tes: true }));
}