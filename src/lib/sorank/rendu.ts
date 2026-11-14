/**
 * Règles d'affichage partagées (navigateur + serveur) des articles et des corrections SEO
 * Sorank. Aucun import serveur ici.
 */

export type JsonValeur = string | number | boolean | null | JsonValeur[] | { [cle: string]: JsonValeur };

export type ImageSurcharge = {
  placement: string;
  src: string;
  new_src?: string | null;
  alt?: string | null;
};

export type SurchargeSeo = {
  title: string | null;
  h1: string | null;
  meta_description: string | null;
  content_html: string | null;
  images: ImageSurcharge[];
  json_ld: JsonValeur;
  json_ld_mode: "default" | "replace" | "remove";
};

export const SURCHARGE_VIDE: SurchargeSeo = {
  title: null,
  h1: null,
  meta_description: null,
  content_html: null,
  images: [],
  json_ld: null,
  json_ld_mode: "default",
};

const echapperAttr = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const decoder = (v: string) =>
  v.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");

function lireAttr(balise: string, nom: string): string | null {
  const m = balise.match(new RegExp(`\\s${nom}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  if (!m) return null;
  return decoder(m[2] ?? m[3] ?? m[4] ?? "");
}

function ecrireAttr(balise: string, nom: string, valeur: string): string {
  const re = new RegExp(`\\s${nom}\\s*=\\s*("[^"]*"|'[^']*'|[^\\s>]+)`, "i");
  const attr = ` ${nom}="${echapperAttr(valeur)}"`;
  if (re.test(balise)) return balise.replace(re, attr);
  return balise.replace(/^<img\b/i, `<img${attr}`);
}

/** Applique les corrections d'images (alt, nouvelle source) aux <img> dont la source correspond. */
export function reecrireImages(html: string, images: ImageSurcharge[]): string {
  const cibles = images.filter((i) => i.placement !== "hero" && i.src);
  if (cibles.length === 0) return html;
  return html.replace(/<img\b[^>]*>/gi, (balise) => {
    const src = lireAttr(balise, "src");
    const cible = src ? cibles.find((c) => c.src === src) : undefined;
    if (!cible) return balise;
    let out = balise;
    if (typeof cible.alt === "string") out = ecrireAttr(out, "alt", cible.alt);
    if (cible.new_src && /^https:\/\//i.test(cible.new_src)) out = ecrireAttr(out, "src", cible.new_src);
    return out;
  });
}

export type ArticleBase = {
  slug: string;
  title: string;
  meta_description: string;
  content_html: string;
  featured_image_url: string | null;
  featured_image_alt: string | null;
  language: string;
  published_at: string;
  updated_at: string;
};

export type ArticleAffiche = {
  slug: string;
  seoTitle: string;
  h1: string;
  description: string;
  contentHtml: string;
  imageUrl: string | null;
  imageAlt: string;
  language: string;
  publishedAt: string;
  updatedAt: string;
  jsonLdMode: SurchargeSeo["json_ld_mode"];
  /** JSON-LD de remplacement déjà sérialisé, ou null. */
  jsonLd: string | null;
};

/** Combine l'article publié et ses corrections d'audit (qui survivent aux mises à jour). */
export function composerArticle(a: ArticleBase, s: SurchargeSeo | null): ArticleAffiche {
  const sur = s ?? SURCHARGE_VIDE;
  const hero = sur.images.find(
    (i) => i.placement === "hero" && (i.src === "" || i.src === (a.featured_image_url ?? "")),
  );
  const imageUrl = hero?.new_src && /^https:\/\//i.test(hero.new_src) ? hero.new_src : a.featured_image_url;
  const imageAlt = typeof hero?.alt === "string" ? hero.alt : (a.featured_image_alt ?? "");
  return {
    slug: a.slug,
    seoTitle: sur.title ?? a.title,
    h1: sur.h1 ?? a.title,
    description: sur.meta_description ?? a.meta_description,
    contentHtml: reecrireImages(sur.content_html ?? a.content_html, sur.images),
    imageUrl: imageUrl ?? null,
    imageAlt,
    language: a.language || "fr-FR",
    publishedAt: a.published_at,
    updatedAt: a.updated_at,
    jsonLdMode: sur.json_ld_mode,
    jsonLd: sur.json_ld ? JSON.stringify(sur.json_ld) : null,
  };
}

/** Date ISO 8601 avec fuseau, identique dans la page, le JSON-LD, l'Open Graph et le plan du site. */
export function isoAvecFuseau(date: string): string {
  return new Date(date).toISOString().replace(/\.\d{3}Z$/, "+00:00");
}

export function formaterDateArticle(date: string, langue: string): string {
  return new Intl.DateTimeFormat(langue || "fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Paris",
  }).format(new Date(date));
}

type MetaEntree = Record<string, unknown>;
type ScriptEntree = Record<string, unknown>;
type HeadLike = { meta?: MetaEntree[]; links?: unknown[]; scripts?: ScriptEntree[]; [k: string]: unknown };

/** Lit la correction SEO de la page courante, chargée par la route racine. */
export function trouverSurcharge(matches: unknown): SurchargeSeo | null {
  if (!Array.isArray(matches)) return null;
  for (const m of matches) {
    const data = (m as { loaderData?: { seoSurcharge?: SurchargeSeo | null } })?.loaderData;
    if (data && "seoSurcharge" in data) return data.seoSurcharge ?? null;
  }
  return null;
}

/** Remplace titre, description et JSON-LD d'une page codée par la correction Sorank. */
export function fusionnerSurcharge<R extends HeadLike>(head: R, s: SurchargeSeo): R {
  let meta = [...(head.meta ?? [])];
  const remplacer = (cle: "name" | "property", valeur: string, contenu: string) => {
    meta = meta.filter((m) => m[cle] !== valeur);
    meta.push({ [cle]: valeur, content: contenu });
  };
  if (s.title) {
    meta = meta.filter((m) => !("title" in m));
    meta.unshift({ title: s.title });
    remplacer("property", "og:title", s.title);
    remplacer("name", "twitter:title", s.title);
  }
  if (s.meta_description) {
    remplacer("name", "description", s.meta_description);
    remplacer("property", "og:description", s.meta_description);
    remplacer("name", "twitter:description", s.meta_description);
  }
  let scripts = head.scripts;
  if (s.json_ld_mode !== "default") {
    scripts = (head.scripts ?? []).filter((sc) => sc.type !== "application/ld+json");
    if (s.json_ld_mode === "replace" && s.json_ld) {
      scripts.push({ type: "application/ld+json", children: JSON.stringify(s.json_ld) });
    }
  }
  return { ...head, meta, ...(scripts ? { scripts } : {}) };
}

/** Enveloppe le head() d'une page publique codée pour appliquer ses corrections Sorank. */
export function avecSurchargeSeo<R extends HeadLike>(fn: (ctx: any) => R) {
  return (ctx: any): R => {
    const head = fn(ctx);
    const s = trouverSurcharge(ctx?.matches);
    return s ? fusionnerSurcharge(head, s) : head;
  };
}
