export type CheckState = "ok" | "nc" | "na";

export type ChecklistItem = { key: string; label: string };
export type ChecklistSection = { key: string; title: string; items: ChecklistItem[] };

/** Points de contrôle d'une installation IRVE (mode 3 / IEC 61851). */
export const CHECKLIST: ChecklistSection[] = [
  {
    key: "prealables",
    title: "A. Préalables & documents",
    items: [
      { key: "devis", label: "Devis / bon de commande signé conforme aux travaux réalisés" },
      { key: "autorisation", label: "Autorisation propriétaire / syndic / bailleur obtenue" },
      { key: "fiche_borne", label: "Notice et fiche technique de la borne disponibles" },
      { key: "photos_avant", label: "Photos avant travaux réalisées" },
      { key: "coupure", label: "Consignation / coupure de l'installation avant intervention" },
      { key: "epi", label: "EPI portés et zone de travail sécurisée" },
    ],
  },
  {
    key: "alimentation",
    title: "B. Alimentation & protections",
    items: [
      { key: "circuit_dedie", label: "Circuit dédié à la borne, sans autre récepteur" },
      { key: "disjoncteur", label: "Disjoncteur courbe C calibré selon la puissance (16/20/32 A)" },
      { key: "differentiel", label: "Différentiel 30 mA dédié (type A + DDR-DC 6 mA ou type B)" },
      { key: "section", label: "Section des conducteurs conforme (longueur / intensité)" },
      { key: "chute_tension", label: "Chute de tension calculée < 5 %" },
      { key: "serrage", label: "Serrage au couple des connexions vérifié" },
      { key: "reperage", label: "Repérage et étiquetage du circuit au tableau" },
      { key: "tableau_etat", label: "Tableau existant en bon état / capacité suffisante" },
      { key: "aval_amont", label: "Raccordement amont (type II, coffret, GTL) conforme" },
    ],
  },
  {
    key: "cheminement",
    title: "C. Cheminement & pose",
    items: [
      { key: "mode_pose", label: "Mode de pose conforme (goulotte / IRL / TPC / chemin de câble)" },
      { key: "enfouissement", label: "Tranchée : profondeur ≥ 50 cm + grillage avertisseur" },
      { key: "fixations", label: "Fixations et supports adaptés au support" },
      { key: "traversees", label: "Traversées de parois rebouchées et étanchées" },
      { key: "protection_meca", label: "Protection mécanique des zones exposées" },
      { key: "borne_fixation", label: "Borne fixée à hauteur réglementaire (0,90 – 1,20 m)" },
      { key: "ip_ik", label: "Indices IP / IK respectés (intérieur / extérieur)" },
      { key: "esthetique", label: "Finitions et remise en état des supports" },
    ],
  },
  {
    key: "terre",
    title: "D. Terre & mesures électriques",
    items: [
      { key: "continuite", label: "Continuité du conducteur de protection (PE) vérifiée" },
      { key: "prise_terre", label: "Prise de terre existante et conforme (< 100 Ω)" },
      { key: "isolement", label: "Mesure d'isolement réalisée (≥ 0,5 MΩ)" },
      { key: "test_ddr", label: "Test de déclenchement du différentiel réalisé" },
      { key: "tension", label: "Tension et rotation des phases contrôlées" },
      { key: "absence_defaut", label: "Absence de défaut d'isolement / court-circuit" },
    ],
  },
  {
    key: "fonctions",
    title: "E. Paramétrage & fonctions de la borne",
    items: [
      { key: "puissance_param", label: "Puissance de charge paramétrée selon l'abonnement" },
      { key: "tic_linky", label: "Connexion TIC / Linky raccordée et lue par la borne" },
      { key: "delesteur", label: "Délesteur / gestion dynamique de charge opérationnel" },
      { key: "compteur", label: "Mesure d'énergie / compteur interne fonctionnel" },
      { key: "rfid", label: "Badges RFID appairés et testés" },
      { key: "reseau", label: "Connexion Wi-Fi / 4G / Ethernet établie" },
      { key: "supervision", label: "Supervision (OCPP / application) active" },
      { key: "verrouillage", label: "Verrouillage du câble / trappe fonctionnel" },
      { key: "maj", label: "Mise à jour du firmware effectuée" },
    ],
  },
  {
    key: "securite",
    title: "F. Sécurité & conformité",
    items: [
      { key: "dc6ma", label: "Détection de courant résiduel continu 6 mA présente" },
      { key: "parafoudre", label: "Protection contre les surtensions (si requise)" },
      { key: "arret_urgence", label: "Coupure d'urgence accessible et identifiée" },
      { key: "mode3", label: "Charge en mode 3, prise T2 (pas de prise domestique)" },
      { key: "pas_rallonge", label: "Aucune rallonge ni multiprise sur le circuit" },
      { key: "nfc15100", label: "Installation conforme NF C 15-100 (§ IRVE) et IEC 61851" },
    ],
  },
  {
    key: "essais",
    title: "G. Essais fonctionnels",
    items: [
      { key: "essai_vide", label: "Essai à vide / autotest de la borne concluant" },
      { key: "essai_vehicule", label: "Charge réelle avec véhicule validée" },
      { key: "arret_reprise", label: "Arrêt puis reprise de charge testés" },
      { key: "echauffement", label: "Absence d'échauffement anormal après essai" },
      { key: "remise_service", label: "Remise en service du tableau et vérification globale" },
    ],
  },
  {
    key: "livraison",
    title: "H. Fin de chantier & livraison",
    items: [
      { key: "nettoyage", label: "Chantier nettoyé et évacuation des déchets" },
      { key: "notices", label: "Notices et documents remis au client" },
      { key: "formation", label: "Prise en main / formation du client réalisée" },
      { key: "photos_apres", label: "Photos après travaux réalisées" },
      { key: "consuel", label: "Attestation de conformité / Consuel prévue ou transmise" },
      { key: "garantie", label: "Garantie 12 mois et maintenance présentées au client" },
    ],
  },
];

export type MesureField = { key: string; label: string; unit?: string; placeholder?: string };

export const MESURES: MesureField[] = [
  { key: "disjoncteur", label: "Calibre disjoncteur", unit: "A", placeholder: "32" },
  { key: "section", label: "Section câble", unit: "mm²", placeholder: "5G6" },
  { key: "longueur", label: "Longueur du câble", unit: "m", placeholder: "18" },
  { key: "terre", label: "Résistance de terre", unit: "Ω", placeholder: "42" },
  { key: "isolement", label: "Isolement mesuré", unit: "MΩ", placeholder: "> 500" },
  { key: "ddr_courant", label: "Déclenchement DDR", unit: "mA", placeholder: "22" },
  { key: "ddr_temps", label: "Temps de déclenchement", unit: "ms", placeholder: "28" },
  { key: "tension", label: "Tension mesurée", unit: "V", placeholder: "232" },
  { key: "puissance", label: "Puissance paramétrée", unit: "kW", placeholder: "7,4" },
  { key: "courant_charge", label: "Courant en charge", unit: "A", placeholder: "31" },
];

export const RAPPORT_TYPES = {
  controle: {
    label: "Rapport de contrôle",
    subtitle: "Vérification technique de l'installation",
  },
  conformite: {
    label: "Rapport de conformité d'installation",
    subtitle: "Fin de travaux — attestation de bonne exécution",
  },
} as const;

export type RapportType = keyof typeof RAPPORT_TYPES;

export const CHECK_LABEL: Record<CheckState, string> = { ok: "Conforme", nc: "Non conforme", na: "Sans objet" };
