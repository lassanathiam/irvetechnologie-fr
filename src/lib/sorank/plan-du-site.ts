import { isoAvecFuseau } from "./rendu";

export type EntreePlan = { loc: string; lastmod?: string; changefreq?: string; priority?: string };

const echapperXml = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

/** Plan du site sitemaps.org : URLs uniques, échappées, lastmod ISO 8601 avec fuseau. */
export function construirePlanDuSite(entrees: EntreePlan[]): string {
  const vues = new Set<string>();
  const urls: string[] = [];
  for (const e of entrees) {
    if (vues.has(e.loc)) continue;
    vues.add(e.loc);
    urls.push(
      [
        "  <url>",
        `    <loc>${echapperXml(e.loc)}</loc>`,
        e.lastmod ? `    <lastmod>${isoAvecFuseau(e.lastmod)}</lastmod>` : null,
        e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
        e.priority ? `    <priority>${e.priority}</priority>` : null,
        "  </url>",
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}
