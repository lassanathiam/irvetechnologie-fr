/**
 * Source unique des coordonnées de l'entreprise (NAP : nom, adresse, téléphone).
 * Toute page publique, tout document et tout email doivent lire ces valeurs ici.
 * Règle : ne jamais inventer une valeur factuelle — une info manquante reste un TODO.
 */

export const COMPANY_CONFIG = {
  /** Raison sociale exacte. */
  legalName: "IRVE Technologie",
  /** Marque commerciale affichée en gros. */
  brandName: "Borne de l'Ouest",
  formeJuridique: "SAS",
  baseline: "Penser pour demain, installer aujourd'hui.",

  /** Identifiants officiels. */
  siret: "989 533 724 00013",
  tva: "FR89 989533724",
  qualifications: "Qualifications IRVE P1 · P2 · P3",
  qualificationsDetail:
    "Installateur qualifié IRVE P1 (≤ 22 kW sans supervision), P2 (≤ 22 kW avec supervision) et P3 (recharge rapide > 22 kW).",

  /** Contact : un seul numéro affiché partout. */
  email: "contacts@irvetechnologie.fr",
  phoneDisplay: "07 68 08 43 67",
  phoneHref: "tel:+33768084367",

  /** Adresse de facturation et d'envoi : le siège. */
  headOffice: {
    street: "60 rue François Ier",
    postalCode: "75008",
    city: "Paris",
    country: "FR",
  },

  /** Établissement et base opérationnelle : l'adresse que le site et Google doivent afficher. */
  operatingBase: {
    street: "Rue du Stade",
    postalCode: "44522",
    city: "Mésanger",
    country: "FR",
  },

  /** Horaires communiqués par l'entreprise. */
  openingHours: [
    { days: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], opens: "08:00", closes: "18:00" },
    { days: ["Saturday"], opens: "08:00", closes: "18:00" },
  ],
  openingHoursDisplay: "Du lundi au samedi, 8 h – 18 h",

  /** Zone desservie (telle qu'affichée sur le site). */
  areaServed: "Bretagne et Pays de la Loire, avec extension étudiée au-delà selon le projet",

  /**
   * TODO à compléter par l'entreprise : liens officiels (fiche Google Maps, Pappers,
   * annuaires professionnels). Aucun lien n'est inventé en attendant.
   */
  sameAs: [] as string[],
} as const;

/** "60 rue François Ier, 75008 Paris" — pour les documents. */
export const headOfficeLine = `${COMPANY_CONFIG.headOffice.street}, ${COMPANY_CONFIG.headOffice.postalCode} ${COMPANY_CONFIG.headOffice.city}`;

/** "Rue du Stade, 44522 Mésanger" — pour le site et le référencement local. */
export const operatingBaseLine = `${COMPANY_CONFIG.operatingBase.street}, ${COMPANY_CONFIG.operatingBase.postalCode} ${COMPANY_CONFIG.operatingBase.city}`;

/** Coordonnées du centre-bourg de Mésanger (47°26′02″N 1°13′49″O). */
export const operatingBaseGeo = { lat: 47.4339, lng: -1.2303 };
