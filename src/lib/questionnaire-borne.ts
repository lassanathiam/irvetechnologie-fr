/**
 * Questionnaire « Votre borne à la maison » (publicité Facebook/Instagram).
 * Règle pure, utilisable dans le navigateur : zone d'intervention et niveau
 * de qualification de la demande, pour que l'équipe rappelle d'abord les
 * projets prêts.
 */

/** Départements de Bretagne et des Pays de la Loire. */
export const DEPARTEMENTS_ZONE = ["22", "29", "35", "56", "44", "49", "53", "72", "85"] as const;

export type Occupation = "proprietaire" | "locataire";
export type Vehicule = "citadine" | "suv" | "utilitaire" | "hybride" | "pas_encore";
export type Stationnement = "garage" | "allee" | "parking_exterieur";
export type Delai = "vite" | "1_3_mois" | "renseigne";
export type Niveau = "chaud" | "tiede" | "froid";

export interface ReponsesQuestionnaire {
  occupation: Occupation;
  vehicule: Vehicule;
  stationnement: Stationnement;
  /** Distance tableau → borne en mètres ; null = plus de 20 m. */
  distance_m: number | null;
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
 * Tiède : tout le reste (locataire, pas encore de voiture…).
 */
export function niveauDemande(r: ReponsesQuestionnaire): Niveau {
  if (!estDansZone(r.code_postal) || r.delai === "renseigne") return "froid";
  if (r.occupation === "proprietaire" && r.vehicule !== "pas_encore") return "chaud";
  return "tiede";
}

export const LIBELLES = {
  occupation: { proprietaire: "Propriétaire", locataire: "Locataire" },
  vehicule: {
    citadine: "Citadine",
    suv: "SUV / familiale",
    utilitaire: "Utilitaire",
    hybride: "Hybride rechargeable",
    pas_encore: "Pas encore de voiture électrique",
  },
  stationnement: { garage: "Garage", allee: "Allée / cour", parking_exterieur: "Place extérieure" },
  delai: { vite: "Dès que possible", "1_3_mois": "Dans 1 à 3 mois", renseigne: "Je me renseigne" },
  niveau: { chaud: "Prêt à installer", tiede: "À qualifier au téléphone", froid: "Renseignement / hors zone" },
} as const;

/** Résumé court enregistré dans les notes de la demande. */
export function resumeDemande(r: ReponsesQuestionnaire): string {
  const dist = r.distance_m === null ? "plus de 20 m" : `jusqu'à ${r.distance_m} m`;
  return [
    `Questionnaire maison · ${LIBELLES.niveau[niveauDemande(r)]}`,
    `${LIBELLES.occupation[r.occupation]} · ${LIBELLES.vehicule[r.vehicule]} · ${LIBELLES.stationnement[r.stationnement]}`,
    `Distance tableau–borne : ${dist} · Projet : ${LIBELLES.delai[r.delai]}`,
    estDansZone(r.code_postal) ? "Dans la zone" : "HORS ZONE (Bretagne / Pays de la Loire)",
  ].join("\n");
}
