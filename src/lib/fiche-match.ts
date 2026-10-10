/** Rapprochement d'une fiche technique avec un chantier existant (nom du client, adresse, ville). */
export type ChantierCandidat = { id: string; client_nom: string; adresse: string | null; cp_ville: string | null; date_debut: string };

const norm = (s: string | null | undefined) =>
  (s ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((m) => m.length > 1);

const MOTS_VIDES = new Set(["rue", "de", "du", "la", "le", "les", "des", "avenue", "chemin", "impasse", "allee", "route", "place", "bd", "boulevard", "mr", "mme", "m"]);

function recouvrement(a: string[], b: string[]) {
  const sb = new Set(b.filter((m) => !MOTS_VIDES.has(m)));
  const utiles = a.filter((m) => !MOTS_VIDES.has(m));
  if (!utiles.length || !sb.size) return 0;
  return utiles.filter((m) => sb.has(m)).length / utiles.length;
}

/** Score de 0 à 100. */
export function scoreFiche(fiche: { client_nom?: string | null; adresse?: string | null; cp_ville?: string | null }, c: ChantierCandidat) {
  const nom = recouvrement(norm(fiche.client_nom), norm(c.client_nom));
  const adr = recouvrement(norm(fiche.adresse), norm(c.adresse));
  const cpF = (fiche.cp_ville ?? "").match(/\d{5}/)?.[0];
  const cpC = (c.cp_ville ?? "").match(/\d{5}/)?.[0];
  const cp = cpF && cpC ? (cpF === cpC ? 1 : 0) : 0;
  return Math.round(nom * 60 + adr * 25 + cp * 15);
}

export const SEUIL_SUR = 60;

export function classerChantiers(fiche: Parameters<typeof scoreFiche>[0], chantiers: ChantierCandidat[]) {
  return chantiers
    .map((c) => ({ id: c.id, score: scoreFiche(fiche, c) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}
