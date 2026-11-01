/**
 * Une nouvelle date réactive un chantier bloqué.
 * Un chantier terminé mais NON facturé, replanifié à une date future (retour sur place,
 * ex. délestage à poser), redevient planifié ; sa facturation n'est jamais modifiée.
 */
export function repriseApresNouvelleDate(
  avant: {
    date_debut: string;
    statut?: string | null;
    termine_at?: string | null;
    probleme?: boolean | null;
    statut_facturation?: string | null;
  },
  date: string,
  statut = avant.statut ?? "planifie",
  maintenant = Date.now(),
) {
  if (new Date(avant.date_debut).getTime() === new Date(date).getTime() || avant.statut === "annule") return {};
  const termine = Boolean(avant.termine_at) || ["termine", "realise"].includes(avant.statut ?? "");
  if (termine) {
    const facture = ["facture", "paye"].includes(avant.statut_facturation ?? "");
    if (facture || new Date(date).getTime() <= maintenant) return {};
    const s = ["termine", "realise", "en_pause", "en_cours"].includes(statut) ? "planifie" : statut;
    return { statut: s, probleme: false, demarre_at: null, termine_at: null, archive: false };
  }
  if (avant.statut !== "en_pause" && !avant.probleme) return {};
  return { statut: statut === "en_pause" ? "planifie" : statut, probleme: false, demarre_at: null };
}
