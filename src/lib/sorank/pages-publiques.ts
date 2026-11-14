import { VILLES_ZONE } from "@/lib/zones-intervention";

/** Domaine public unique : canonical, og:url, plan du site et URL renvoyée à Sorank. */
export const SITE_URL = "https://irvetechnologie.fr";

export interface PagePublique {
  path: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

/** Pages commerciales publiques (plan du site + corrections SEO Sorank). Jamais de page privée. */
export const PAGES_PUBLIQUES: PagePublique[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/bornes", changefreq: "weekly", priority: "0.8" },
  { path: "/devis-borne-recharge", changefreq: "monthly", priority: "0.8" },
  { path: "/a-propos", changefreq: "monthly", priority: "0.6" },
  { path: "/installation-borne-recharge-nantes", changefreq: "monthly", priority: "0.8" },
  { path: "/zones-intervention", changefreq: "monthly", priority: "0.7" },
  { path: "/borne-recharge-professionnels", changefreq: "monthly", priority: "0.8" },
  ...VILLES_ZONE.map((v) => ({
    path: `/installation-borne-recharge/${v.slug}`,
    changefreq: "monthly" as const,
    priority: "0.7",
  })),
  { path: "/calculateur-irve", changefreq: "monthly", priority: "0.7" },
  { path: "/demande", changefreq: "monthly", priority: "0.8" },
  { path: "/blog", changefreq: "daily", priority: "0.7" },
];

/** Pages codées dont Sorank peut corriger le titre, la description et les données structurées. */
export const CHEMINS_PAGES_CODEES: ReadonlySet<string> = new Set(
  PAGES_PUBLIQUES.map((p) => p.path).filter((p) => p !== "/blog"),
);

/** Ramène une URL ou un chemin à un chemin canonique : sans domaine, sans « / » final ni paramètres. */
export function normaliserChemin(entree: string): string {
  let chemin = entree.trim();
  try {
    if (/^https?:\/\//i.test(chemin)) chemin = new URL(chemin).pathname;
  } catch {
    return "";
  }
  chemin = chemin.split("#")[0].split("?")[0];
  try {
    chemin = decodeURIComponent(chemin);
  } catch {
    /* chemin laissé tel quel */
  }
  if (!chemin.startsWith("/")) chemin = `/${chemin}`;
  chemin = chemin.replace(/\/{2,}/g, "/");
  if (chemin.length > 1) chemin = chemin.replace(/\/+$/, "");
  return chemin.toLowerCase();
}

/** L'URL appartient-elle à ce site (avec ou sans www) ? */
export function estUrlDuSite(url: string): boolean {
  try {
    const hote = new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    return hote === "irvetechnologie.fr";
  } catch {
    return false;
  }
}

export function urlArticle(slug: string): string {
  return `${SITE_URL}/blog/${slug}`;
}
