/** Compte-rendu d'intervention TotalEnergies (B2C « Installation AT HOME »). Module sans dépendance serveur. */

export function estTotal(reseau: string | null | undefined): boolean {
  return /total/i.test(reseau ?? "");
}

export type QuestionCri = { id: string; label: string; defaut?: string; options?: string[]; titre?: boolean };

const ON = ["Oui", "Non", "Non applicable"];

export const QUESTIONS_CRI: QuestionCri[] = [
  { id: "non_conformite", label: "Je détecte une ou des non-conformités sur l'installation électrique", defaut: "NON", options: ["NON", "OUI"] },
  { id: "type_installation", label: "Type d'installation", defaut: "MONO", options: ["MONO", "TRI"] },
  { id: "commentaire_debrief", label: "Commentaire" },
  { id: "resultat_debrief", label: "Résultat de l'intervention", defaut: "Intervention OK pour la supervision" },
  { id: "cause_echec", label: "Cause de l'échec", defaut: "RAS" },
  { id: "izi_safety", label: "Feu vert sécurité sur IZI Safety effectué", defaut: "OK", options: ["OK", "NOK"] },
  { id: "support_contacte", label: "Support contacté pour validation de la Mise en service", defaut: "OUI", options: ["OUI", "NON"] },
  { id: "commentaire_support", label: "Commentaire support" },
  { id: "t_config", label: "CONFIGURATION DE LA STATION DE CHARGE", titre: true },
  { id: "config_station", label: "Configuration de la station de charge", defaut: "OK", options: ["OK", "NOK"] },
  { id: "nb_points", label: "Nombre de points de charge du pool", defaut: "1" },
  { id: "puissance_souscrite", label: "Puissance souscrite (kVA)", defaut: "9" },
  { id: "puissance_dispo", label: "Puissance disponible au niveau du TD pour les bornes (kVA)", defaut: "Puissance souscrite moins puissance max soutirée" },
  { id: "puissance_installee", label: "Puissance installée (kVA)", defaut: "7 kW" },
  { id: "dispo_inferieure", label: "La puissance disponible au niveau du TD est-elle inférieure à la puissance installée", defaut: "Oui", options: ON },
  { id: "smartcharging_mes", label: "Si oui, avez-vous réalisé le paramétrage du smartcharging lors de la MES", defaut: "Oui", options: ON },
  { id: "tore_amont", label: "Le tore de mesure est-il installé en amont de tous les appareils électriques", defaut: "Oui / SMART SENSOR" },
  { id: "power_subscription", label: "Valeur saisie dans « POWER SUBSCRIPTION » en kVA", defaut: "9" },
  { id: "smartcharging_ok", label: "L'écran de l'interface installation indique bien SMARTCHARGING OK", defaut: "Oui", options: ON },
  { id: "t_elec", label: "INSTALLATION ÉLECTRIQUE, AU NIVEAU DU TABLEAU DIVISIONNAIRE", titre: true },
  { id: "regime_neutre", label: "Régime de neutre de l'infrastructure", defaut: "TT", options: ["TT", "TN", "IT"] },
  { id: "tension_phase_terre", label: "Valeurs relevées pour les tensions phases / terre (V)", defaut: "231" },
  { id: "valeur_terre", label: "Valeur de la terre", defaut: "" },
  { id: "neutre_terre", label: "Valeur de la mesure neutre / terre", defaut: "0" },
  { id: "t_evc", label: "ALIMENTATION DE L'EV CONTROLLER", titre: true },
  { id: "reseau_3g", label: "Présence d'un réseau 3G au niveau de l'EV Controller", defaut: "Non applicable", options: ON },
  { id: "leds_evc", label: "Les LEDs de l'EV Controller s'allument correctement", defaut: "Non applicable", options: ON },
  { id: "evc_heure", label: "L'EVC est à l'heure", defaut: "Non applicable", options: ON },
  { id: "sim_3g", label: "La carte SIM est connectée au réseau 3G", defaut: "Oui", options: ON },
  { id: "watchdog", label: "Check Internet avec WatchDog", defaut: "Non applicable", options: ON },
  { id: "t_wifi", label: "COMMUNICATION WIFI", titre: true },
  { id: "wifi_frequence", label: "Fréquence du Wifi du client", defaut: "Non applicable" },
  { id: "wifi_signal", label: "Signal Wifi du client à l'emplacement de la borne", defaut: "Non applicable" },
  { id: "wifi_repeteur", label: "Si le signal est faible ou moyen, avez-vous installé un répéteur Wifi", defaut: "Non applicable", options: ON },
  { id: "t_pdr", label: "CARACTÉRISTIQUE PDR", titre: true },
  { id: "puissance_borne", label: "Puissance de la borne", defaut: "7 kW" },
  { id: "hotspot", label: "Succès connexion Hotspot Wifi émis par la borne", defaut: "Non applicable", options: ON },
  { id: "appairage", label: "Succès de l'appairage de la borne au Wifi du client", defaut: "Non applicable", options: ON },
  { id: "date_heure_borne", label: "La date et l'heure de la borne sont bien à jour", defaut: "Non applicable", options: ON },
  { id: "show_ocpp", label: "Résultat Show OCPP", defaut: "Non applicable" },
  { id: "test_simulateur", label: "Test simulateur VE", defaut: "SIMULATEUR", options: ["SIMULATEUR", "VÉHICULE"] },
  { id: "commentaire_pdr", label: "Commentaire" },
  { id: "reserves", label: "Réserves", defaut: "" },
];

export type PhotoCri = { categorie: string; label: string; obligatoire?: boolean; aide?: string };

/** Emplacements photo du PV Total, dans l'ordre du document. */
export const PHOTOS_CRI: PhotoCri[] = [
  { categorie: "total_avant", label: "Photo avant installation", obligatoire: true },
  { categorie: "total_apres", label: "Photo après installation", obligatoire: true },
  { categorie: "total_smartcharging", label: "Photo Smart charging avec câblage", obligatoire: true },
  { categorie: "total_terre", label: "Photo de la valeur de la terre", obligatoire: true },
  { categorie: "total_wifi", label: "Photo interface borne avec WiFi OK (si applicable)" },
  { categorie: "total_numero_serie", label: "Photo LISIBLE du numéro de série", obligatoire: true },
  { categorie: "total_vue_ensemble", label: "Vue d'ensemble de la borne installée et alimentée (LED vertes fixes)", obligatoire: true },
  { categorie: "total_interieur_borne", label: "Vue de l'intérieur de la borne", obligatoire: true },
  { categorie: "total_tableau_ferme", label: "Tableau général fermé", obligatoire: true },
  { categorie: "total_tableau_ouvert", label: "Tableau général ouvert", obligatoire: true },
  { categorie: "total_protections", label: "Protections installées", obligatoire: true },
  { categorie: "total_percements", label: "Percement(s)", obligatoire: true },
  { categorie: "total_tore", label: "Tore avec sens de la flèche", obligatoire: true, aide: "Flèche visible et photo NETTE : photo floue = PV refusé." },
  { categorie: "total_cheminement", label: "Cheminement du câblage", obligatoire: true },
  { categorie: "total_simulateur", label: "Borne branchée avec simulateur OK", obligatoire: true },
  { categorie: "total_vehicule", label: "Borne branchée avec la voiture (obligatoire si VE disponible)" },
  { categorie: "total_linky", label: "Linky : puissance d'abonnement et max soutiré", obligatoire: true },
  { categorie: "total_supplementaire", label: "Photo supplémentaire" },
];

export const CATEGORIES_TOTAL = PHOTOS_CRI.map((p) => p.categorie);
export const CATEGORIES_TOTAL_OBLIGATOIRES = PHOTOS_CRI.filter((p) => p.obligatoire).map((p) => p.categorie);
export const CATEGORIES_TOTAL_OPTIONNELLES = PHOTOS_CRI.filter((p) => !p.obligatoire).map((p) => p.categorie);
export const LABELS_TOTAL: Record<string, string> = Object.fromEntries(PHOTOS_CRI.map((p) => [p.categorie, `TOTAL — ${p.label}`]));

export function valeursParDefaut(): Record<string, string> {
  const v: Record<string, string> = { resultat: "OK" };
  for (const q of QUESTIONS_CRI) if (!q.titre && q.defaut !== undefined) v[q.id] = q.defaut;
  return v;
}

/** Emplacements obligatoires encore vides (ce qui ferait refuser le PV). */
export function photosManquantes(categoriesPresentes: readonly string[]): PhotoCri[] {
  const s = new Set(categoriesPresentes);
  return PHOTOS_CRI.filter((p) => p.obligatoire && !s.has(p.categorie));
}
