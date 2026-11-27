/**
 * Questionnaire « Votre borne à la maison » (publicité Facebook/Instagram).
 * Règle pure, utilisable dans le navigateur : zone d'intervention et niveau
 * de qualification de la demande, pour que l'équipe rappelle d'abord les
 * projets prêts.
 */

/** Départements de Bretagne et des Pays de la Loire. */
export const DEPARTEMENTS_ZONE = ["22", "29", "35", "56", "44", "49", "53", "72", "85"] as const;

export type Occupation = "proprietaire" | "locataire";
export type Delai = "vite" | "1_3_mois" | "renseigne";
export type Niveau = "chaud" | "tiede" | "froid";

export interface ReponsesQuestionnaire {
  occupation: Occupation;
  delai: Delai;
  code_postal: string;
}

export function estDansZone(codePostal: string): boolean {
  const cp = codePostal.replace(/\s+/g, "");
  if (!/^\d{5}$/.test(cp)) return false;
  return (DEPARTEMENTS_ZONE as readonly string[]).includes(cp.slice(0, 2));
}

/**
 * Chaud : propriétaire, dans la zone, projet dans les 3 mois.
 * Froid : hors zone ou simple renseignement.
 * Tiède : tout le reste (locataire).
 */
export function niveauDemande(r: ReponsesQuestionnaire): Niveau {
  if (!estDansZone(r.code_postal) || r.delai === "renseigne") return "froid";
  if (r.occupation === "proprietaire") return "chaud";
  return "tiede";
}

export const LIBELLES = {
  occupation: { proprietaire: "Propriétaire", locataire: "Locataire" },
  delai: { vite: "Dès que possible", "1_3_mois": "Dans 1 à 3 mois", renseigne: "Je me renseigne" },
  niveau: { chaud: "Prêt à installer", tiede: "À qualifier au téléphone", froid: "Renseignement / hors zone" },
} as const;

/** Résumé court enregistré dans les notes de la demande. */
export function resumeDemande(r: ReponsesQuestionnaire): string {
  return [
    `Questionnaire maison · ${LIBELLES.niveau[niveauDemande(r)]}`,
    `${LIBELLES.occupation[r.occupation]} · Projet : ${LIBELLES.delai[r.delai]}`,
    estDansZone(r.code_postal) ? "Dans la zone" : "HORS ZONE (Bretagne / Pays de la Loire)",
  ].join("\n");
}
