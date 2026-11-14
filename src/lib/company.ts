import logoAsset from "@/assets/logo-irve.png.asset.json";
import { COMPANY_CONFIG, headOfficeLine, operatingBaseLine } from "@/config/company";

export const COMPANY = {
  raisonSociale: COMPANY_CONFIG.legalName,
  marque: COMPANY_CONFIG.brandName,
  forme: COMPANY_CONFIG.formeJuridique,
  baseline: COMPANY_CONFIG.baseline,
  /** Adresse de facturation et d'envoi : le siège. */
  adresse: COMPANY_CONFIG.headOffice.street,
  cpVille: `${COMPANY_CONFIG.headOffice.postalCode} ${COMPANY_CONFIG.headOffice.city}, FR`,
  /** Établissement et base opérationnelle, affiché sur le site. */
  adresseExploitation: operatingBaseLine,
  ligneSiege: headOfficeLine,
  email: COMPANY_CONFIG.email,
  telephone: "+33 7 68 08 43 67",
  telephoneHref: COMPANY_CONFIG.phoneHref,
  telephoneAffiche: COMPANY_CONFIG.phoneDisplay,
  horaires: COMPANY_CONFIG.openingHoursDisplay,
  /** Ancien numéro (06 … 40), retiré du site : gardé seulement pour l'écarter des imports de fiches. */
  ancienTelephone: "+33 6 33 65 78 40",
  site: "www.irvetechnologie.fr",
  siteUrl: "https://irvetechnologie.fr",
  siret: COMPANY_CONFIG.siret.replace(/\s/g, ""),
  tva: COMPANY_CONFIG.tva.replace(/\s/g, ""),
  /** Qualifications IRVE de l'entreprise, affichées sur tous les documents générés. */
  qualifications: COMPANY_CONFIG.qualifications,
  qualificationsDetail: COMPANY_CONFIG.qualificationsDetail,
};

/** Cadre légal des garanties applicables à une installation de borne de recharge (France). */
export const GARANTIES = [
  {
    titre: "Garantie légale de conformité",
    duree: "2 ans",
    texte:
      "Sur le matériel fourni, à compter de la livraison. Réparation ou remplacement sans frais si la borne ne correspond pas à l'usage attendu (Code de la consommation).",
  },
  {
    titre: "Garantie des vices cachés",
    duree: "2 ans après découverte",
    texte:
      "Pour un défaut non visible à la livraison rendant la borne inutilisable, dans la limite de 20 ans après la vente (Code civil).",
  },
  {
    titre: "Garantie constructeur de la borne",
    duree: "2 à 5 ans",
    texte:
      "Variable selon la marque et le modèle. Nous vous remettons les conditions exactes du fabricant avec votre dossier d'installation.",
  },
  {
    titre: "Garanties sur les travaux",
    duree: "1, 2 et 10 ans",
    texte:
      "Parfait achèvement 1 an, bon fonctionnement des équipements 2 ans, et responsabilité décennale lorsque l'installation est indissociable du bâtiment.",
  },
  {
    titre: "Conformité de l'installation",
    duree: "À la mise en service",
    texte:
      "Installation réalisée selon la NF C 15-100 par un installateur qualifié IRVE, avec attestation de conformité visée par le Consuel lorsqu'elle est requise.",
  },
  {
    titre: "Entretien Sérénité",
    duree: "Sur devis",
    texte:
      "Formule d'entretien annuel proposée après installation : visite de contrôle, mesures et paramétrage. Les garanties légales restent acquises sans supplément.",
  },
];

/** Logo affiché sur les documents (devis, factures, rapports). */
export const LOGO_URL: string | null = logoAsset.url;

export const euro = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

export const dateFr = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(iso),
  );
