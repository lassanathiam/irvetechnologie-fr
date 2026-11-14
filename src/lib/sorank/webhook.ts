import { z } from "zod";
import { nettoyerHtmlArticle } from "./html-nettoyage";
import { estUrlDuSite, normaliserChemin, urlArticle } from "./pages-publiques";
import { SURCHARGE_VIDE, type ImageSurcharge, type SurchargeSeo } from "./rendu";

/** Contrat webhook Sorank, version 2. Logique pure : le stockage est injecté (testable). */
export const SORANK_VERSION = 2;
export const CAPACITES = ["article.published", "article.updated", "article.audit_fix"] as const;
export const TAILLE_MAX = 5 * 1024 * 1024;
const DELAI_TRAITEMENT_BLOQUE_MS = 2 * 60 * 1000;

export type ArticleStocke = {
  sorank_article_id: string;
  slug: string;
  title: string;
  meta_description: string;
  content_html: string;
  featured_image_url: string | null;
  featured_image_alt: string | null;
  language: string;
  revision: number;
  published_at: string;
  updated_at: string;
};

export type ReservationEnvoi =
  | { kind: "claimed" }
  | { kind: "done"; status: number; body: unknown }
  | { kind: "busy" };

export interface SorankStore {
  claimDelivery(key: string, event: string, staleBefore: Date): Promise<ReservationEnvoi>;
  completeDelivery(key: string, status: number, body: unknown): Promise<void>;
  releaseDelivery(key: string): Promise<void>;
  findArticleBySorankId(id: string): Promise<ArticleStocke | null>;
  findArticleBySlug(slug: string): Promise<ArticleStocke | null>;
  insertArticle(row: ArticleStocke): Promise<void>;
  updateArticle(sorankId: string, patch: Partial<ArticleStocke>): Promise<void>;
  getOverride(path: string): Promise<SurchargeSeo | null>;
  saveOverride(path: string, next: SurchargeSeo, before: SurchargeSeo | null, key: string | null): Promise<void>;
}

export type DependancesWebhook = {
  secret: string | undefined;
  store: SorankStore;
  now?: () => Date;
  /** Pages codées du site (chemins normalisés) corrigeables par l'audit. */
  pagesCodees: ReadonlySet<string>;
};

const urlHttps = z.string().trim().url().max(2048).refine((u) => /^https:\/\//i.test(u));

const imageSchema = z
  .object({ url: z.string().max(2048).nullish(), alt: z.string().max(500).nullish(), placement: z.string().max(50).nullish() })
  .passthrough();

const articleSchema = z
  .object({
    id: z.union([z.string(), z.number()]).transform(String).pipe(z.string().min(1).max(200)),
    title: z.string().trim().min(1).max(500),
    slug: z.string().trim().min(1).max(200),
    meta_description: z.string().max(2000).nullish(),
    content: z.string().max(TAILLE_MAX),
    featured_image: imageSchema.nullish(),
    images: z.array(imageSchema).max(200).nullish(),
    language: z.string().max(20).nullish(),
  })
  .passthrough();

const envoiArticleSchema = z
  .object({
    event: z.enum(["article.published", "article.updated"]),
    timestamp: z.string().max(64).nullish(),
    article: articleSchema,
  })
  .passthrough();

const auditSchema = z
  .object({
    event: z.literal("article.audit_fix"),
    page: z.object({ url: z.string().max(2048).nullish(), slug: z.string().max(300).nullish() }).passthrough(),
    changes: z
      .object({
        title: z.string().trim().min(1).max(500).optional(),
        h1: z.string().trim().min(1).max(500).optional(),
        meta_description: z.string().trim().min(1).max(2000).optional(),
        content: z.string().max(TAILLE_MAX).optional(),
        images: z
          .array(
            z
              .object({
                src: z.string().max(2048).nullish(),
                new_src: z.string().max(2048).nullish(),
                alt: z.string().max(500).nullish(),
                placement: z.string().max(50).nullish(),
              })
              .passthrough(),
          )
          .max(200)
          .optional(),
        json_ld: z.union([z.record(z.string(), z.unknown()), z.array(z.unknown()), z.null()]).optional(),
      })
      .passthrough(),
  })
  .passthrough();

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });

const erreur = (status: number, message: string) => json(status, { error: message });

function egaliteConstante(a: string, b: string): boolean {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  const longueur = Math.max(ea.length, eb.length);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < longueur; i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

export function normaliserSlug(brut: string): string {
  return brut
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120) || "article";
}

function suffixeCourt(source: string): string {
  let h = 2166136261;
  for (let i = 0; i < source.length; i++) h = Math.imul(h ^ source.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36).slice(0, 6);
}

const echapper = (v: string) =>
  v.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Corps de l'article : HTML nettoyé + images « body » absentes du texte ajoutées en fin. */
export function construireContenu(article: z.infer<typeof articleSchema>): string {
  const corps = nettoyerHtmlArticle(article.content);
  const manquantes = (article.images ?? []).filter((img) => {
    const url = img.url ?? "";
    if (!urlHttps.safeParse(url).success) return false;
    if ((img.placement ?? "body") !== "body") return false;
    return !corps.includes(url) && !corps.includes(echapper(url));
  });
  if (manquantes.length === 0) return corps;
  const figures = manquantes
    .map((img) => `<figure><img src="${echapper(img.url!)}" alt="${echapper(img.alt ?? "")}" loading="lazy"></figure>`)
    .join("");
  return nettoyerHtmlArticle(`${corps}${figures}`);
}

function lireRevision(request: Request): number | null {
  const brut = request.headers.get("x-sorank-article-revision");
  if (!brut) return null;
  const n = Number.parseInt(brut, 10);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function dateIso(valeur: string | null | undefined, repli: Date): string {
  if (valeur) {
    const d = new Date(valeur);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return repli.toISOString();
}

type Resultat = { status: number; body: unknown };

/** Point d'entrée : authentifie, valide, dédoublonne puis applique l'envoi Sorank. */
export async function traiterWebhookSorank(request: Request, deps: DependancesWebhook): Promise<Response> {
  const now = deps.now ?? (() => new Date());
  if (!deps.secret) return erreur(500, "Webhook not configured");

  const auth = request.headers.get("authorization") ?? "";
  if (!egaliteConstante(auth, `Bearer ${deps.secret}`)) return erreur(401, "Unauthorized");

  const type = request.headers.get("content-type") ?? "";
  if (!/application\/json/i.test(type)) return erreur(415, "JSON body required");
  const longueur = Number(request.headers.get("content-length") ?? "0");
  if (longueur > TAILLE_MAX) return erreur(413, "Body too large");

  const texte = await request.text();
  if (new TextEncoder().encode(texte).length > TAILLE_MAX) return erreur(413, "Body too large");

  let corps: unknown;
  try {
    corps = JSON.parse(texte);
  } catch {
    return erreur(400, "Invalid JSON");
  }
  const event = (corps as { event?: unknown })?.event;

  if (event === "webhook.test") {
    return json(200, { sorank_webhook_version: SORANK_VERSION, capabilities: [...CAPACITES] });
  }
  if (event !== "article.published" && event !== "article.updated" && event !== "article.audit_fix") {
    return erreur(400, "Unknown event");
  }

  // Validation avant toute réservation : un envoi refusé n'est jamais mémorisé.
  let executer: () => Promise<Resultat>;
  if (event === "article.audit_fix") {
    const p = auditSchema.safeParse(corps);
    if (!p.success) return erreur(400, "Invalid audit_fix payload");
    executer = () => appliquerAudit(p.data, deps, now(), request.headers.get("idempotency-key"));
  } else {
    const p = envoiArticleSchema.safeParse(corps);
    if (!p.success) return erreur(400, "Invalid article payload");
    const revision = lireRevision(request);
    executer = () =>
      event === "article.published"
        ? publierArticle(p.data, revision, deps, now())
        : mettreAJourArticle(p.data, revision, deps, now());
  }

  const cle = request.headers.get("idempotency-key")?.trim().slice(0, 300) || null;
  if (cle) {
    const reservation = await deps.store.claimDelivery(
      cle,
      event,
      new Date(now().getTime() - DELAI_TRAITEMENT_BLOQUE_MS),
    );
    if (reservation.kind === "done") return json(reservation.status, reservation.body);
    if (reservation.kind === "busy") return erreur(409, "Request with this Idempotency-Key is being processed");
  }

  try {
    const res = await executer();
    if (cle) {
      if (res.status >= 200 && res.status < 300) await deps.store.completeDelivery(cle, res.status, res.body);
      else await deps.store.releaseDelivery(cle);
    }
    return json(res.status, res.body);
  } catch (e) {
    if (cle) await deps.store.releaseDelivery(cle).catch(() => undefined);
    console.error("Sorank webhook failed:", e instanceof Error ? e.message : e);
    return erreur(500, "Temporary failure, please retry");
  }
}

function champsArticle(a: z.infer<typeof articleSchema>) {
  const image = a.featured_image?.url && urlHttps.safeParse(a.featured_image.url).success ? a.featured_image : null;
  return {
    title: a.title,
    meta_description: (a.meta_description ?? "").trim(),
    content_html: construireContenu(a),
    featured_image_url: image?.url ?? null,
    featured_image_alt: image ? (image.alt ?? "") : null,
    language: (a.language ?? "").trim() || "fr-FR",
  };
}

function aChange(avant: ArticleStocke, champs: ReturnType<typeof champsArticle>): boolean {
  return (Object.keys(champs) as (keyof typeof champs)[]).some((k) => avant[k] !== champs[k]);
}

async function publierArticle(
  data: z.infer<typeof envoiArticleSchema>,
  revision: number | null,
  deps: DependancesWebhook,
  maintenant: Date,
): Promise<Resultat> {
  const a = data.article;
  const existant = await deps.store.findArticleBySorankId(a.id);
  if (existant) {
    const reponse = { sorank_webhook_version: SORANK_VERSION, status: "published", article_url: urlArticle(existant.slug) };
    if (revision !== null && revision < existant.revision) return { status: 200, body: reponse };
    const champs = champsArticle(a);
    const change = aChange(existant, champs);
    await deps.store.updateArticle(a.id, {
      ...champs,
      revision: revision ?? existant.revision,
      ...(change ? { updated_at: maintenant.toISOString() } : {}),
    });
    return { status: 200, body: reponse };
  }

  const base = normaliserSlug(a.slug);
  let slug = base;
  for (let essai = 0; essai < 5; essai++) {
    const pris = await deps.store.findArticleBySlug(slug);
    if (!pris) break;
    slug = `${base}-${suffixeCourt(`${a.id}:${essai}`)}`;
  }
  const publie = dateIso(data.timestamp, maintenant);
  await deps.store.insertArticle({
    sorank_article_id: a.id,
    slug,
    ...champsArticle(a),
    revision: revision ?? 0,
    published_at: publie,
    updated_at: publie,
  });
  return { status: 201, body: { sorank_webhook_version: SORANK_VERSION, status: "published", article_url: urlArticle(slug) } };
}

async function mettreAJourArticle(
  data: z.infer<typeof envoiArticleSchema>,
  revision: number | null,
  deps: DependancesWebhook,
  maintenant: Date,
): Promise<Resultat> {
  const a = data.article;
  const existant = await deps.store.findArticleBySorankId(a.id);
  if (!existant) return { status: 404, body: { error: "Unknown article" } };
  const reponse = { sorank_webhook_version: SORANK_VERSION, status: "updated", article_url: urlArticle(existant.slug) };
  if (revision !== null && revision < existant.revision) return { status: 200, body: reponse };
  const champs = champsArticle(a);
  const change = aChange(existant, champs);
  await deps.store.updateArticle(a.id, {
    ...champs,
    revision: revision ?? existant.revision,
    ...(change ? { updated_at: maintenant.toISOString() } : {}),
  });
  return { status: 200, body: reponse };
}

type Cible = { kind: "article"; article: ArticleStocke; path: string } | { kind: "page"; path: string };

async function trouverCible(page: { url?: string | null; slug?: string | null }, deps: DependancesWebhook): Promise<Cible | null> {
  const essayerChemin = async (chemin: string): Promise<Cible | null> => {
    const m = chemin.match(/^\/blog\/([^/]+)$/);
    if (m) {
      const article = await deps.store.findArticleBySlug(m[1]);
      return article ? { kind: "article", article, path: `/blog/${article.slug}` } : null;
    }
    return deps.pagesCodees.has(chemin) ? { kind: "page", path: chemin } : null;
  };

  if (page.url) {
    const relative = page.url.startsWith("/");
    if (relative || estUrlDuSite(page.url)) {
      const trouve = await essayerChemin(normaliserChemin(page.url));
      if (trouve) return trouve;
    }
  }
  const slug = (page.slug ?? "").trim().replace(/^\/+|\/+$/g, "");
  if (page.slug !== undefined && page.slug !== null) {
    if (slug) {
      const article = await deps.store.findArticleBySlug(slug.toLowerCase());
      if (article) return { kind: "article", article, path: `/blog/${article.slug}` };
    }
    return essayerChemin(normaliserChemin(`/${slug}`));
  }
  return null;
}

async function appliquerAudit(
  data: z.infer<typeof auditSchema>,
  deps: DependancesWebhook,
  maintenant: Date,
  cle: string | null,
): Promise<Resultat> {
  const cible = await trouverCible(data.page, deps);
  if (!cible) return { status: 404, body: { error: "Unknown page" } };
  const c = data.changes;

  if (cible.kind === "page" && (c.h1 !== undefined || c.content !== undefined || (c.images?.length ?? 0) > 0)) {
    // Pages codées du site : seuls le titre SEO, la description et le JSON-LD sont modifiables.
    return { status: 422, body: { error: "Only title, meta_description and json_ld can be changed on this page" } };
  }

  const avant = await deps.store.getOverride(cible.path);
  const suivant: SurchargeSeo = { ...SURCHARGE_VIDE, ...(avant ?? {}), images: [...(avant?.images ?? [])] };
  if (c.title !== undefined) suivant.title = c.title;
  if (c.h1 !== undefined) suivant.h1 = c.h1;
  if (c.meta_description !== undefined) suivant.meta_description = c.meta_description;
  if (c.content !== undefined) suivant.content_html = nettoyerHtmlArticle(c.content);
  for (const img of c.images ?? []) {
    const entree: ImageSurcharge = {
      placement: img.placement ?? "body",
      src: img.src ?? "",
      new_src: img.new_src && urlHttps.safeParse(img.new_src).success ? img.new_src : null,
      alt: typeof img.alt === "string" ? img.alt : null,
    };
    if (entree.placement !== "hero" && !entree.src) continue;
    const i = suivant.images.findIndex((x) => x.placement === entree.placement && x.src === entree.src);
    if (i >= 0) suivant.images[i] = { ...suivant.images[i], ...entree, alt: entree.alt ?? suivant.images[i].alt };
    else suivant.images.push(entree);
  }
  if (c.json_ld !== undefined) {
    suivant.json_ld = c.json_ld as SurchargeSeo["json_ld"];
    suivant.json_ld_mode = c.json_ld === null ? "remove" : "replace";
  }

  const change = JSON.stringify(suivant) !== JSON.stringify({ ...SURCHARGE_VIDE, ...(avant ?? {}) });
  if (change) {
    await deps.store.saveOverride(cible.path, suivant, avant, cle);
    if (cible.kind === "article") {
      await deps.store.updateArticle(cible.article.sorank_article_id, { updated_at: maintenant.toISOString() });
    }
  }
  return {
    status: 200,
    body: {
      sorank_webhook_version: SORANK_VERSION,
      status: "updated",
      page_url: cible.kind === "article" ? urlArticle(cible.article.slug) : `https://irvetechnologie.fr${cible.path === "/" ? "/" : cible.path}`,
    },
  };
}
