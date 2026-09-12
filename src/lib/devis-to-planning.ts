export function datePlanificationDepuisDevis(dateExpiration: string | null | undefined) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const fallback = today.toISOString().slice(0, 10);
  const base = dateExpiration && /^\d{4}-\d{2}-\d{2}$/.test(dateExpiration) ? dateExpiration : fallback;
  const d = new Date(`${base}T09:00:00`);
  if (Number.isNaN(d.getTime()) || d.getTime() < today.getTime()) {
    return `${fallback}T09:00:00.000Z`;
  }
  return d.toISOString();
}
