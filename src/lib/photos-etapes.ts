export const ETAPES_PHOTOS = [
  {
    id: "cable",
    nom: "Tirage de câble",
    couleur: "photo-cable",
    categories: ["cheminement_cable", "ensio_cheminement_cable", "ensio_gaine_traversee", "boite_derivation"],
  },
  {
    id: "borne",
    nom: "Pose et raccordement de la borne",
    couleur: "photo-borne",
    categories: [
      "avant_emplacement", "emplacement_borne", "ensio_av_emplacement_borne", "etat_avant_maintenance",
      "borne_posee", "ensio_borne_fermee_face", "ensio_borne_fermee_gauche", "ensio_borne_fermee_droite",
      "vue_ensemble", "ensio_borne_ouverte_ensemble", "raccordement_borne", "ensio_borne_ouverte_alim",
      "ensio_borne_ouverte_cable_info",
    ],
  },
  {
    id: "tableau",
    nom: "Tableau, protections et délestage",
    couleur: "photo-tableau",
    categories: [
      "avant_tableau", "emplacement_tableau", "ensio_av_tableau_ferme", "ensio_av_tableau_ouvert",
      "avant_compteur", "tableau_electrique", "ensio_tableau_ouvert", "ensio_alim_protections",
      "ensio_liaison_pe", "ensio_protections_refs", "compteur_linky", "ensio_tore_emplacement",
      "ensio_tore_connexions", "ensio_tableau_ferme_etiquette", "armoire",
    ],
  },
  {
    id: "essai",
    nom: "Mise en service et contrôles",
    couleur: "photo-essai",
    categories: [
      "mise_en_service", "ensio_parametrages", "ensio_simulateur_charge", "ensio_tension_sortie",
      "ensio_resistance_pe", "plaque_serie", "ensio_numero_serie", "ensio_etiquette_autel",
      "ensio_carte_sim", "ensio_badges", "ensio_appel_supervision", "ensio_sms_supervision",
    ],
  },
  {
    id: "autre",
    nom: "Autres constats",
    couleur: "photo-autre",
    categories: ["avant_travaux", "autre"],
  },
] as const;

/** Classe uniquement l'affichage : les catégories enregistrées ne changent pas. */
export function photosParEtape(categories: readonly string[]) {
  const restantes = new Set(categories);
  return ETAPES_PHOTOS.map((etape) => {
    const presentes: string[] = etape.categories.filter((categorie) => restantes.delete(categorie));
    if (etape.id === "autre") presentes.push(...restantes);
    return { ...etape, categories: presentes };
  }).filter((etape) => etape.categories.length > 0);
}