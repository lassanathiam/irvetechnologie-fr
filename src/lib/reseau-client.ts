/** Donneurs d'ordre principaux (rang 1) pour lesquels ENSIO sous-traite. */
const CONNUS: Array<[RegExp, string]> = [
  [/\bbump\b/i, "BUMP"],
  [/\b(50\s?five|fifty\s?five)\b/i, "50FIVE"],
  [/\bamara\b/i, "AMARA"],
  [/\bcap\s?bornes?\b/i, "CAP BORNES"],
  [/\btotal\s?(energies?|énergies?)?\b/i, "TOTALENERGIES"],
  [/\bdkv\b/i, "DKV"],
];

/** Retrouve le donneur d'ordre principal dans un texte (désignation, titre, notes). */
export function detecterReseauClient(...textes: Array<string | null | undefined>): string | null {
  const t = textes.filter(Boolean).join(" ");
  for (const [re, nom] of CONNUS) if (re.test(t)) return nom;
  return null;
}

/** Conserve le libellé commercial lu, sans le confondre avec le matériel. */
export function nomReseauClient(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const v = value.trim().slice(0, 160);
  if (!v) return null;
  return detecterReseauClient(v) ?? v;
}

export function precisionReseauClient(value: unknown): string {
  const nom = nomReseauClient(value);
  return nom ? `Client : ${nom}` : "Client : à préciser";
}

/** DKV : la borne est livrée directement chez le client, pas de retrait chez ENSIO. */
export const NOTE_LIVRAISON_DKV = "Borne livrée chez le client — pas de retrait chez ENSIO";
export function estLivraisonDirecte(value: unknown): boolean {
  return nomReseauClient(value) === "DKV";
}
