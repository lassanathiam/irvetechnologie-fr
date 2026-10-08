/** Les rappels internes ne passent jamais par cette règle documentaire. */
export function concerneEnsio(email: string, identite?: string | null): boolean {
  return /@ensio\.eu$/i.test(email.trim()) || /\bensio\b/i.test(identite ?? "");
}

export function copieDistincte(principal: string, copie?: string | null): string | null {
  const adresse = copie?.trim();
  return adresse && adresse.toLowerCase() !== principal.trim().toLowerCase() ? adresse : null;
}