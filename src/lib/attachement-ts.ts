export type LigneTs = { libelle: string; description?: string | null; quantite: number; prix_unitaire: number; rendezvous_id?: string | null };

/** Un document TS contient uniquement les nouvelles lignes saisies, jamais celles du document initial. */
export function preparerLignesTs(lignes: LigneTs[]) {
  if (!lignes.length) throw new Error("Ajoutez une ligne de travaux supplémentaires.");
  return lignes.map((ligne) => ({ ...ligne, tes: true }));
}

/** Ligne TES telle qu'elle sort d'un attachement initial (base de données ou éditeur). */
export type LigneTesBase = { libelle?: string | null; description?: string | null; quantite?: number | string | null; prix_unitaire?: number | string | null; rendezvous_id?: string | null };

/** Ligne prête à être préremplie dans l'éditeur de document TS. */
export type LigneTsPre = { libelle: string; description: string; quantite: string; prix: string; rendezvous_id: string | null; tes: true };

/**
 * Reprend les lignes TES (écarts de chantier) déjà marquées sur l'attachement initial
 * pour préremplir le document TS séparé. Une ligne sans intitulé est ignorée ;
 * sans aucune ligne TES, la liste reste vide et l'éditeur démarre sur une ligne vierge.
 */
export function lignesTsDepuisTes(lignes: LigneTesBase[] | null | undefined): LigneTsPre[] {
  return (lignes ?? [])
    .filter((l) => String(l?.libelle ?? "").trim())
    .map((l) => ({
      libelle: String(l.libelle).trim(),
      description: String(l.description ?? ""),
      quantite: String(Number(l.quantite) || 1),
      prix: String(Number(l.prix_unitaire) || 0),
      rendezvous_id: l.rendezvous_id ?? null,
      tes: true as const,
    }));
}
