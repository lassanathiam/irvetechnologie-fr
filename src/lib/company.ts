export const COMPANY = {
  raisonSociale: "IRVE Technologie",
  forme: "SAS",
  baseline: "Penser pour demain, installer aujourd'hui.",
  adresse: "60 rue François 1er",
  cpVille: "75008 Paris, FR",
  email: "contacts@irvetechnologie.fr",
  telephone: "+33 7 68 08 43 67",
  site: "www.irvetechnologie.fr",
  siret: "98953372400013",
  tva: "FR89989533724",
};

/** Logo affiché sur les devis. Remplacer par l'URL du logo fourni. */
export const LOGO_URL: string | null = null;

export const euro = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

export const dateFr = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }).format(
    new Date(iso),
  );
