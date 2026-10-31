export const ETAPES_PHOTOS = [
  {
    id: "terre", numero: 1,
    nom: "Vérification de la terre",
    couleur: "photo-terre",
    categories: ["verification_terre_avant"],
  },
  {
    id: "avant", numero: 2,
    nom: "Avant travaux",
    couleur: "photo-avant",
    categories: ["ensio_av_tableau_ferme", "ensio_av_tableau_ouvert", "avant_tableau", "emplacement_tableau", "ensio_av_emplacement_borne", "avant_emplacement", "emplacement_borne", "etat_avant_maintenance", "avant_compteur", "avant_travaux", "total_avant", "total_tableau_ferme", "total_tableau_ouvert", "total_linky"],
  },
  {
    id: "borne", numero: 3,
    nom: "Installation et raccordement de la borne",
    couleur: "photo-borne",
    categories: [
      "ensio_borne_ouverte_ensemble", "raccordement_borne", "ensio_borne_ouverte_alim", "ensio_borne_ouverte_cable_info",
      "borne_posee", "vue_ensemble", "ensio_borne_fermee_face", "ensio_borne_fermee_droite", "ensio_borne_fermee_gauche",
      "total_interieur_borne", "total_vue_ensemble", "total_apres",
    ],
  },
  {
    id: "tableau", numero: 4,
    nom: "Raccordement dans le tableau électrique",
    couleur: "photo-tableau",
    categories: [
      "tableau_electrique", "ensio_tableau_ouvert", "ensio_alim_protections", "ensio_liaison_pe", "ensio_protections_refs",
      "compteur_linky", "ensio_tore_emplacement", "ensio_tore_connexions", "ensio_tension_sortie", "ensio_tableau_ferme_etiquette", "armoire", "total_protections", "total_smartcharging", "total_tore",
    ],
  },
  {
    id: "essai", numero: 5,
    nom: "Mise en service",
    couleur: "photo-essai",
    categories: [
      "mise_en_service", "ensio_simulateur_charge", "ensio_resistance_pe", "ensio_parametrages",
      "plaque_serie", "ensio_numero_serie", "ensio_etiquette_autel", "ensio_carte_sim", "ensio_badges", "ensio_appel_supervision", "ensio_sms_supervision",
      "total_terre", "total_numero_serie", "total_simulateur", "total_vehicule", "total_wifi",
    ],
  },
  {
    id: "pv", numero: 6,
    nom: "PV de réception",
    couleur: "photo-pv",
    categories: ["pv_signe"],
  },
  {
    id: "cable", numero: 7,
    nom: "Cheminement du câble et traversée de gaine",
    couleur: "photo-cable",
    categories: ["cheminement_cable", "ensio_cheminement_cable", "ensio_gaine_traversee", "boite_derivation", "total_cheminement", "total_percements"],
  },
  {
    id: "autre", numero: 8,
    nom: "État des lieux avant départ",
    couleur: "photo-autre",
    categories: ["etat_lieux_depart", "autre"],
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