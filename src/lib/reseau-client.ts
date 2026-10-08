/** Conserve le libellé commercial lu, sans le confondre avec le matériel. */
export function nomReseauClient(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.trim().slice(0, 160) || null;
}

export function precisionReseauClient(value: unknown): string {
  const nom = nomReseauClient(value);
  return nom ? `Client du donneur d’ordre : ${nom}` : "Client du donneur d’ordre : à préciser";
}