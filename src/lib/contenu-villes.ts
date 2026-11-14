/**
 * Contenus locaux des pages villes (module navigateur, sans appel serveur).
 * Chaque ville riche ajoute une entrée ici : le routeur de pages villes la lit
 * automatiquement. Règle : uniquement des faits vérifiables, jamais d'invention.
 */

export type SectionVille = {
  titre: string;
  paragraphes: string[];
  points?: string[];
};

export type FaqVille = { question: string; reponse: string };

export type ContenuVille = {
  /** Titre de l'onglet et résultat Google (60 caractères environ). */
  titreSeo: string;
  /** Description du résultat Google (155 caractères environ). */
  descriptionSeo: string;
  /** Ligne au-dessus du titre principal. */
  surtitre: string;
  /** Titre principal, propre à la ville. */
  h1: string;
  /** Paragraphes d'introduction. */
  intro: string[];
  sections: SectionVille[];
  faq: FaqVille[];
  /** Slugs des pages villes voisines mises en avant. */
  voisines: string[];
};

export const CONTENU_VILLES: Record<string, ContenuVille> = {
  mesanger: {
    titreSeo: "Installation borne de recharge à Mésanger (44522)",
    descriptionSeo:
      "Pose de borne de recharge à Mésanger et dans le Pays d'Ancenis : étude à distance, devis gratuit, électricien qualifié IRVE P1 P2 P3.",
    surtitre: "Mésanger · Pays d'Ancenis · 44522",
    h1: "Installer une borne de recharge à Mésanger",
    intro: [
      "Mésanger est une commune du Pays d'Ancenis, à environ 11 km au nord d'Ancenis-Saint-Géréon et à une quarantaine de kilomètres au nord-est de Nantes. Le territoire est vaste — près de 50 km² — et l'habitat y est surtout pavillonnaire et rural : longères, maisons de bourg et pavillons récents, la plupart avec garage ou déport.",
      "Borne de l'Ouest installe des bornes de recharge pour véhicules électriques chez les particuliers, en copropriété et en entreprise à Mésanger et dans les communes voisines. L'étude se fait le plus souvent à distance, à partir de photos de votre tableau électrique, et le chantier est réalisé par un électricien qualifié IRVE P1 · P2 · P3.",
    ],
    sections: [
      {
        titre: "Un territoire de maisons individuelles, donc de bornes à poser",
        paragraphes: [
          "À Mésanger, la grande majorité des logements sont des résidences principales et près de huit ménages sur dix sont propriétaires. C'est la configuration la plus simple pour installer une borne : une wallbox murale dans le garage, ou une borne sur pied en extérieur si la voiture reste stationnée sur la parcelle.",
          "Le point qui fait vraiment varier le prix est la distance entre le tableau électrique et l'emplacement de la borne. En campagne, le tableau se trouve souvent dans la maison alors que la voiture stationne au bout de l'allée : mieux vaut le mesurer avant le devis, c'est ce qui évite les surprises.",
        ],
        points: [
          "Borne murale au garage ou borne sur pied en extérieur",
          "Câble et gaine entre le tableau et la borne, longueur chiffrée sur plan",
          "Protections dédiées posées au tableau si elles manquent",
        ],
      },
      {
        titre: "Zones d'activités, A11 : les entreprises aussi",
        paragraphes: [
          "La commune dispose de plusieurs zones d'activités et reste proche de l'échangeur de l'autoroute A11, entre Nantes et Angers. Pour une entreprise, équiper quelques places de parking permet à la fois d'accueillir des clients et de charger les véhicules de la flotte ou les voitures des salariés.",
          "Nous intervenons aussi pour les commerces, les garages, les sièges sociaux et les sites logistiques du secteur : étude des puissances disponibles, nombre de points de charge, puissance pilotée pour ne pas faire sauter l'abonnement, et dossier d'aide Advenir lorsque le site est éligible.",
        ],
      },
      {
        titre: "Ce que l'étude vérifie avant de poser",
        paragraphes: [
          "Avant toute commande, nous contrôlons la puissance souscrite, l'état du tableau, la présence des protections différentielles adaptées et la section de câble nécessaire. L'installation est réalisée selon la norme NF C 15-100, avec attestation de conformité visée par le Consuel lorsqu'elle est requise.",
          "Vous recevez ensuite un dossier clair : plans, schémas, date de mise en service et explication de l'utilisation au quotidien. La maintenance et le dépannage de bornes existantes sont proposés dans la foulée, y compris sur du matériel posé par quelqu'un d'autre.",
        ],
      },
    ],
    faq: [
      {
        question: "Faut-il un déplacement pour obtenir le devis ?",
        reponse:
          "Non dans la plupart des cas. Vous nous envoyez des photos de votre tableau électrique, l'emplacement souhaité et la distance approximative jusqu'à la borne, et nous chiffrons à distance. Un déplacement n'est demandé que si le site est atypique.",
      },
      {
        question: "Quelle puissance de borne peut-on installer chez soi ?",
        reponse:
          "En maison, on installe le plus souvent une borne monophasée de 7,4 kW ou triphasée de 11 à 22 kW. Les qualifications IRVE P1 et P2 couvrent ces puissances ; le P3 concerne la recharge rapide au-delà de 22 kW.",
      },
      {
        question: "Le crédit d'impôt et la TVA réduite s'appliquent-ils ?",
        reponse:
          "Ils peuvent s'appliquer sous conditions de revenus, de logement et de matériel, avec un installateur qualifié IRVE. Nous vérifions votre situation avant d'établir le devis et n'affichons que les aides réellement mobilisables.",
      },
      {
        question: "Combien de temps dure l'installation ?",
        reponse:
          "Une pose standard se fait en général en une demi-journée à une journée, mise en service et tests compris. Les délais dépendent de la borne choisie et de la longueur de câble à tirer.",
      },
      {
        question: "Intervenez-vous au-delà de Mésanger ?",
        reponse:
          "Oui : tout le Pays d'Ancenis, la Loire-Atlantique et le Grand Ouest sont couverts, avec des extensions étudiées au cas par cas selon la distance, le temps de trajet et la rentabilité du chantier.",
      },
    ],
    voisines: ["ancenis", "nantes", "angers"],
  },

  ancenis: {
    titreSeo: "Installation borne de recharge à Ancenis (44150)",
    descriptionSeo:
      "Bornes de recharge à Ancenis-Saint-Géréon : particuliers, copropriétés et entreprises du Pays d'Ancenis. Devis gratuit, installateur IRVE P1 P2 P3.",
    surtitre: "Ancenis-Saint-Géréon · Loire-Atlantique · 44150",
    h1: "Installer une borne de recharge à Ancenis-Saint-Géréon",
    intro: [
      "Ancenis-Saint-Géréon est une commune nouvelle née en 2019 de la fusion d'Ancenis et de Saint-Géréon, sous-préfecture de la Loire-Atlantique et siège de la communauté de communes du Pays d'Ancenis. La ville est posée sur la Loire, à la limite du Maine-et-Loire, avec son pont qui relie les deux départements, et la gare place les habitants à dix-sept minutes de Nantes et vingt-deux minutes d'Angers en TER.",
      "Cette configuration — centre-ville dense, quartiers pavillonnaires, zones d'activités et sites industriels — demande des approches différentes pour la recharge. Borne de l'Ouest équipe les maisons, les copropriétés et les parkings d'entreprise de la ville et de son bassin de vie, avec un électricien qualifié IRVE P1 · P2 · P3.",
    ],
    sections: [
      {
        titre: "En maison : wallbox au garage ou borne sur pied",
        paragraphes: [
          "Dans les pavillons et les maisons de ville avec cour ou garage, la pose est simple : une borne murale reliée au tableau, avec les protections adaptées et, si besoin, une puissance pilotée pour éviter de dépasser l'abonnement. La distance entre le tableau et la borne reste le principal facteur de prix.",
          "Pour les logements sans stationnement privé, l'installation en copropriété est souvent la bonne solution. Le droit à la prise permet à un copropriétaire d'équiper sa place à ses frais, et des installations collectives peuvent être montées pour plusieurs places à la fois.",
        ],
        points: [
          "Wallbox 7,4 kW monophasée ou 11 à 22 kW triphasée",
          "Copropriétés : droit à la prise, bornes individuelles ou collectives",
          "Aides Advenir montées avec vous quand le site est éligible",
        ],
      },
      {
        titre: "Entreprises, industrie et flottes du Pays d'Ancenis",
        paragraphes: [
          "Le tissu économique local est important : Manitou et ses fournisseurs, la logistique, la métallurgie, les entreprises de travaux publics, sans compter les commerces du centre et les sites le long de l'axe Nantes–Angers. Beaucoup de ces sociétés ont des véhicules utilitaires électriques, des véhicules de service ou des salariés qui souhaitent recharger sur le site.",
          "Nous chiffrons les parkings d'entreprise de quelques places à plusieurs points de charge, en tenant compte de la puissance disponible, de la répartition entre les véhicules et de la gestion des accès. Les aides Advenir pour personnes morales sont montées dans le dossier lorsque le site est éligible.",
        ],
      },
      {
        titre: "Commerces, tourisme et Loire à Vélo",
        paragraphes: [
          "La ville est sur le circuit de la Loire à Vélo, avec son port de plaisance, son patrimoine et ses marchés : des visiteurs s'arrêtent toute l'année. Un commerce, un hôtel ou un restaurant qui équipe une place de recharge prolonge la visite et attire une clientèle motorisée électrique de passage entre Nantes et Angers.",
          "Nous étudions ces cas avec la même méthode : emplacement, puissance, signalétique, et mise en service avec explication de l'usage. La maintenance et le dépannage restent ensuite possibles, même sur un matériel posé par un autre installateur.",
        ],
      },
    ],
    faq: [
      {
        question: "Intervenez-vous dans toute la commune nouvelle ?",
        reponse:
          "Oui, à Ancenis comme à Saint-Géréon, ainsi que dans les communes du bassin de vie : Mésanger, Couffé, Ligné, Teillé, Mouzeil et au-delà selon le projet.",
      },
      {
        question: "Peut-on équiper sa place de parking en copropriété ?",
        reponse:
          "Oui. Le droit à la prise permet à un copropriétaire d'installer une borne à ses frais sur sa place, et une installation collective peut être étudiée pour plusieurs places à la fois. Nous montons le dossier technique avec le syndic.",
      },
      {
        question: "Quelle puissance choisir pour une borne à la maison ?",
        reponse:
          "Le plus souvent 7,4 kW en monophasé ou 11 à 22 kW en triphasé. Nous vérifions la puissance souscrite et l'usage réel — recharge de nuit, deux véhicules, véhicule à batterie importante — avant de proposer un modèle.",
      },
      {
        question: "L'installation est-elle garantie et conforme ?",
        reponse:
          "L'installation suit la NF C 15-100, avec attestation de conformité Consuel quand elle est requise, et les garanties légales s'appliquent au matériel comme aux travaux. Les conditions exactes vous sont remises avec le dossier.",
      },
      {
        question: "Combien coûte une borne à Ancenis-Saint-Géréon ?",
        reponse:
          "Le prix dépend du modèle de borne et de la longueur de câble entre le tableau et la borne. Une installation de borne est proposée à partir d'un tarif d'appel affiché sur le site, et le devis définitif est établi après étude de votre site.",
      },
    ],
    voisines: ["mesanger", "nantes", "cholet"],
  },
};

export function trouverContenuVille(slug: string): ContenuVille | undefined {
  return CONTENU_VILLES[slug];
}
