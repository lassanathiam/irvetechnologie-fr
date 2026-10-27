/** Une nouvelle date réactive un chantier bloqué, sans rouvrir un chantier terminé. */
export function repriseApresNouvelleDate(
  avant: { date_debut: string; statut?: string | null; termine_at?: string | null; probleme?: boolean | null },
  date: string,
  statut = avant.statut ?? "planifie",
) {
  if (new Date(avant.date_debut).getTime() === new Date(date).getTime() || avant.termine_at || ["termine", "realise", "annule"].includes(avant.statut ?? "")) return {};
  if (avant.statut !== "en_pause" && !avant.probleme) return {};
  return { statut: statut === "en_pause" ? "planifie" : statut, probleme: false, demarre_at: null };
}