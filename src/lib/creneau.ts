/** Créneau de passage : heure de début (date_debut) et heure de fin facultative « HH:mm » (heure de Paris). */
export const heureParis = (iso: string) =>
  new Date(iso).toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris", hour: "2-digit", minute: "2-digit" });

export const normaliserHeure = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const m = v.trim().match(/^(\d{1,2})\s*[:hH]\s*(\d{2})?$/);
  if (!m) return null;
  const h = Number(m[1]), mn = Number(m[2] ?? 0);
  if (h > 23 || mn > 59) return null;
  return `${String(h).padStart(2, "0")}:${String(mn).padStart(2, "0")}`;
};

/** « 14:00 » ou « entre 14:00 et 16:00 ». */
export function creneauTexte(dateDebut: string, fin?: string | null, court = false): string {
  const debut = heureParis(dateDebut);
  if (!fin || fin <= debut) return debut;
  return court ? `${debut}–${fin}` : `entre ${debut} et ${fin}`;
}
