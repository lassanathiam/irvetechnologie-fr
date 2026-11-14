import { describe, expect, it } from "bun:test";
import { traiterWebhookSorank, type ArticleStocke, type SorankStore } from "./webhook";
import { composerArticle, fusionnerSurcharge, type SurchargeSeo } from "./rendu";
import { construirePlanDuSite } from "./plan-du-site";
import { urlArticle } from "./pages-publiques";

const SECRET = "secret-de-test-tres-long-0123456789";

function memoire() {
  const articles = new Map<string, ArticleStocke>();
  const overrides = new Map<string, SurchargeSeo>();
  const historique: { path: string; before: SurchargeSeo | null }[] = [];
  const envois = new Map<string, { status: "processing" | "done"; code?: number; body?: unknown }>();
  let echecInsertion = false;
  const store: SorankStore = {
    async claimDelivery(key) {
      const e = envois.get(key);
      if (!e) {
        envois.set(key, { status: "processing" });
        return { kind: "claimed" };
      }
      if (e.status === "done") return { kind: "done", status: e.code!, body: e.body };
      return { kind: "busy" };
    },
    async completeDelivery(key, status, body) {
      envois.set(key, { status: "done", code: status, body });
    },
    async releaseDelivery(key) {
      if (envois.get(key)?.status === "processing") envois.delete(key);
    },
    async findArticleBySorankId(id) {
      const a = articles.get(id);
      return a ? { ...a } : null;
    },
    async findArticleBySlug(slug) {
      for (const a of articles.values()) if (a.slug === slug) return { ...a };
      return null;
    },
    async insertArticle(row) {
      if (echecInsertion) {
        echecInsertion = false;
        throw new Error("panne base");
      }
      articles.set(row.sorank_article_id, { ...row });
    },
    async updateArticle(id, patch) {
      articles.set(id, { ...articles.get(id)!, ...patch });
    },
    async getOverride(path) {
      return overrides.get(path) ?? null;
    },
    async saveOverride(path, next, before) {
      overrides.set(path, next);
      historique.push({ path, before });
    },
  };
  return { store, articles, overrides, historique, envois, panneProchaineInsertion: () => (echecInsertion = true) };
}

let horloge = new Date("2026-11-14T10:00:00Z");
const avancer = (min: number) => (horloge = new Date(horloge.getTime() + min * 60_000));

function appel(
  m: ReturnType<typeof memoire>,
  body: unknown,
  opts: { auth?: string | null; key?: string; revision?: number } = {},
) {
  const headers: Record<string, string> = { "Content-Type": "application/json", "User-Agent": "SORANK-Webhook/1.0" };
  if (opts.auth !== null) headers.Authorization = opts.auth ?? `Bearer ${SECRET}`;
  if (opts.key) headers["Idempotency-Key"] = opts.key;
  if (opts.revision !== undefined) headers["X-Sorank-Article-Revision"] = String(opts.revision);
  const req = new Request("https://irvetechnologie.fr/api/public/sorank/webhook", {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return traiterWebhookSorank(req, {
    secret: SECRET,
    store: m.store,
    now: () => horloge,
    pagesCodees: new Set(["/", "/bornes", "/a-propos"]),
  });
}

const article = (over: Record<string, unknown> = {}) => ({
  id: "art-1",
  title: "Prix d'une borne de recharge",
  slug: "prix-borne-recharge",
  meta_description: "Combien coûte une borne ?",
  content: "<h2>Le prix</h2><p>Environ 1 500 €.</p><script>alert(1)</script>",
  featured_image: { url: "https://cdn.sorank.com/hero.jpg", alt: "Borne murale", placement: "hero" },
  images: [],
  language: "fr-FR",
  ...over,
});

const publier = (over = {}) => ({
  event: "article.published",
  delivery_id: "d1",
  timestamp: "2026-11-14T09:00:00Z",
  business: { name: "Borne de l'Ouest", website: "https://irvetechnologie.fr" },
  article: article(over),
});
const maj = (over = {}) => ({ ...publier(over), event: "article.updated" });

describe("webhook Sorank", () => {
  it("refuse un secret absent ou faux (401)", async () => {
    const m = memoire();
    expect((await appel(m, { event: "webhook.test" }, { auth: null })).status).toBe(401);
    expect((await appel(m, { event: "webhook.test" }, { auth: "Bearer faux" })).status).toBe(401);
  });

  it("webhook.test ne crée rien et renvoie le JSON exact", async () => {
    const m = memoire();
    const r = await appel(m, { event: "webhook.test" });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({
      sorank_webhook_version: 2,
      capabilities: ["article.published", "article.updated", "article.audit_fix"],
    });
    expect(m.articles.size).toBe(0);
  });

  it("refuse un événement inconnu (400)", async () => {
    expect((await appel(memoire(), { event: "article.deleted" })).status).toBe(400);
  });

  it("article.published crée l'article et renvoie article_url", async () => {
    const m = memoire();
    const r = await appel(m, publier(), { key: "k1", revision: 1 });
    expect(r.status).toBe(201);
    expect(await r.json()).toEqual({
      sorank_webhook_version: 2,
      status: "published",
      article_url: "https://irvetechnologie.fr/blog/prix-borne-recharge",
    });
    const a = m.articles.get("art-1")!;
    expect(a.published_at).toBe("2026-11-14T09:00:00.000Z");
    expect(a.updated_at).toBe(a.published_at);
    expect(a.content_html).not.toContain("script");
  });

  it("un second article.published ne duplique pas et garde published_at", async () => {
    const m = memoire();
    await appel(m, publier(), { key: "k1", revision: 1 });
    avancer(60);
    const r = await appel(m, { ...publier({ title: "Nouveau titre" }), timestamp: "2026-11-20T00:00:00Z" }, { key: "k2", revision: 2 });
    expect(r.status).toBe(200);
    expect(m.articles.size).toBe(1);
    expect(m.articles.get("art-1")!.published_at).toBe("2026-11-14T09:00:00.000Z");
    expect(m.articles.get("art-1")!.title).toBe("Nouveau titre");
  });

  it("article.updated remplace le contenu, garde URL et published_at, avance updated_at", async () => {
    const m = memoire();
    await appel(m, publier(), { key: "k1", revision: 1 });
    avancer(30);
    const r = await appel(m, maj({ content: "<p>Nouveau texte</p>", slug: "autre-slug" }), { key: "k2", revision: 2 });
    expect(r.status).toBe(200);
    expect((await r.json()).article_url).toBe("https://irvetechnologie.fr/blog/prix-borne-recharge");
    const a = m.articles.get("art-1")!;
    expect(a.content_html).toBe("<p>Nouveau texte</p>");
    expect(a.slug).toBe("prix-borne-recharge");
    expect(a.published_at).toBe("2026-11-14T09:00:00.000Z");
    expect(a.updated_at).toBe(horloge.toISOString());
  });

  it("article.updated d'un article inconnu renvoie 404 sans le créer", async () => {
    const m = memoire();
    expect((await appel(m, maj(), { key: "k1", revision: 1 })).status).toBe(404);
    expect(m.articles.size).toBe(0);
  });

  it("une Idempotency-Key répétée n'est pas réappliquée et ne bouge pas updated_at", async () => {
    const m = memoire();
    await appel(m, publier(), { key: "k1", revision: 1 });
    avancer(10);
    const r1 = await appel(m, maj({ content: "<p>v2</p>" }), { key: "k2", revision: 2 });
    const apres = m.articles.get("art-1")!.updated_at;
    avancer(10);
    const r2 = await appel(m, maj({ content: "<p>v3</p>" }), { key: "k2", revision: 2 });
    expect(await r2.json()).toEqual(await r1.json());
    expect(m.articles.get("art-1")!.updated_at).toBe(apres);
    expect(m.articles.get("art-1")!.content_html).toBe("<p>v2</p>");
  });

  it("une même clé encore en cours de traitement renvoie 409", async () => {
    const m = memoire();
    m.envois.set("k9", { status: "processing" });
    expect((await appel(m, publier(), { key: "k9", revision: 1 })).status).toBe(409);
  });

  it("une nouvelle tentative après un échec est traitée à nouveau", async () => {
    const m = memoire();
    m.panneProchaineInsertion();
    expect((await appel(m, publier(), { key: "k1", revision: 1 })).status).toBe(500);
    expect(m.articles.size).toBe(0);
    expect((await appel(m, publier(), { key: "k1", revision: 1 })).status).toBe(201);
    expect(m.articles.size).toBe(1);
  });

  it("une révision plus ancienne est ignorée", async () => {
    const m = memoire();
    await appel(m, publier(), { key: "k1", revision: 5 });
    const r = await appel(m, maj({ content: "<p>ancien</p>" }), { key: "k2", revision: 3 });
    expect(r.status).toBe(200);
    expect(m.articles.get("art-1")!.content_html).not.toContain("ancien");
  });

  it("accepte featured_image: null", async () => {
    const m = memoire();
    const r = await appel(m, publier({ featured_image: null, homepage_screenshot: null }), { key: "k1", revision: 1 });
    expect(r.status).toBe(201);
    expect(m.articles.get("art-1")!.featured_image_url).toBeNull();
  });

  it("ajoute un suffixe si le slug est déjà pris", async () => {
    const m = memoire();
    await appel(m, publier(), { key: "k1" });
    const r = await appel(m, publier({ id: "art-2" }), { key: "k2" });
    const url = (await r.json()).article_url as string;
    expect(url).toStartWith("https://irvetechnologie.fr/blog/prix-borne-recharge-");
    expect(m.articles.size).toBe(2);
  });
});

const audit = (page: Record<string, unknown>, changes: Record<string, unknown>) => ({
  event: "article.audit_fix",
  delivery_id: "d",
  timestamp: "2026-11-14T12:00:00Z",
  business: { name: "Borne de l'Ouest", website: "https://irvetechnologie.fr" },
  page,
  changes,
});

describe("article.audit_fix", () => {
  it("corrige titre, description et JSON-LD d'une page codée non publiée par Sorank", async () => {
    const m = memoire();
    const r = await appel(
      m,
      audit({ url: "https://www.irvetechnologie.fr/bornes/?utm=1", slug: "bornes" }, {
        title: "Bornes de recharge au meilleur prix",
        meta_description: "Nouvelle description",
        json_ld: { "@context": "https://schema.org", "@type": "Product" },
      }),
      { key: "a1" },
    );
    expect(r.status).toBe(200);
    const s = m.overrides.get("/bornes")!;
    const head = fusionnerSurcharge(
      {
        meta: [{ title: "Ancien" }, { name: "description", content: "Ancienne" }],
        scripts: [{ type: "application/ld+json", children: "{}" }],
      },
      s,
    );
    expect(head.meta).toContainEqual({ title: "Bornes de recharge au meilleur prix" });
    expect(head.meta).toContainEqual({ name: "description", content: "Nouvelle description" });
    expect(head.scripts).toEqual([{ type: "application/ld+json", children: JSON.stringify({ "@context": "https://schema.org", "@type": "Product" }) }]);
  });

  it("refuse texte ou images sur une page codée (422) sans rien enregistrer", async () => {
    const m = memoire();
    const r = await appel(m, audit({ url: "https://irvetechnologie.fr/bornes" }, { content: "<p>x</p>" }), { key: "a1" });
    expect(r.status).toBe(422);
    expect(m.overrides.size).toBe(0);
  });

  it("n'applique que les champs présents et garde l'ancien état pour revenir en arrière", async () => {
    const m = memoire();
    await appel(m, audit({ url: "https://irvetechnologie.fr/a-propos" }, { title: "T1", meta_description: "D1" }), { key: "a1" });
    await appel(m, audit({ url: "https://irvetechnologie.fr/a-propos" }, { title: "T2" }), { key: "a2" });
    const s = m.overrides.get("/a-propos")!;
    expect(s.title).toBe("T2");
    expect(s.meta_description).toBe("D1");
    expect(m.historique[1].before?.title).toBe("T1");
  });

  it("sur un article : remplace seulement le corps, corrige l'alt d'image, avance updated_at", async () => {
    const m = memoire();
    await appel(
      m,
      publier({ content: '<p>Avant</p><img src="https://cdn.sorank.com/a.jpg" alt="vieux">' }),
      { key: "k1", revision: 1 },
    );
    avancer(15);
    const r = await appel(
      m,
      audit({ url: "https://irvetechnologie.fr/blog/prix-borne-recharge" }, {
        images: [{ src: "https://cdn.sorank.com/hero.jpg", alt: "Borne Schneider", placement: "hero" }],
      }),
      { key: "a1" },
    );
    expect(r.status).toBe(200);
    const a = m.articles.get("art-1")!;
    expect(a.updated_at).toBe(horloge.toISOString());
    expect(a.published_at).toBe("2026-11-14T09:00:00.000Z");
    const vue = composerArticle(a, m.overrides.get("/blog/prix-borne-recharge")!);
    expect(vue.imageAlt).toBe("Borne Schneider");
    expect(vue.h1).toBe("Prix d'une borne de recharge");

    await appel(
      m,
      audit({ slug: "prix-borne-recharge" }, {
        content: "<p>Corps corrigé</p><img src=\"https://cdn.sorank.com/b.jpg\" alt=\"\">",
        images: [{ src: "https://cdn.sorank.com/b.jpg", alt: "Câble 3G10", placement: "body" }],
      }),
      { key: "a2" },
    );
    const vue2 = composerArticle(m.articles.get("art-1")!, m.overrides.get("/blog/prix-borne-recharge")!);
    expect(vue2.contentHtml).toContain("Corps corrigé");
    expect(vue2.contentHtml).toContain('alt="Câble 3G10"');
    expect(vue2.contentHtml).not.toContain("Avant");
    expect(vue2.imageAlt).toBe("Borne Schneider");
  });

  it("une correction survit à un article.updated ultérieur", async () => {
    const m = memoire();
    await appel(m, publier(), { key: "k1", revision: 1 });
    await appel(m, audit({ url: "https://irvetechnologie.fr/blog/prix-borne-recharge" }, { title: "Titre SEO corrigé" }), { key: "a1" });
    await appel(m, maj({ content: "<p>v2</p>" }), { key: "k2", revision: 2 });
    const vue = composerArticle(m.articles.get("art-1")!, m.overrides.get("/blog/prix-borne-recharge")!);
    expect(vue.seoTitle).toBe("Titre SEO corrigé");
    expect(vue.contentHtml).toBe("<p>v2</p>");
  });

  it("une URL inconnue renvoie 404 et ne crée rien", async () => {
    const m = memoire();
    const r = await appel(m, audit({ url: "https://irvetechnologie.fr/page-inexistante", slug: "page-inexistante" }, { title: "X" }), { key: "a1" });
    expect(r.status).toBe(404);
    expect(m.overrides.size).toBe(0);
    const r2 = await appel(m, audit({ url: "https://autre-site.fr/bornes" }, { title: "X" }), { key: "a2" });
    expect(r2.status).toBe(404);
  });

  it("une Idempotency-Key d'audit répétée n'est pas réappliquée", async () => {
    const m = memoire();
    await appel(m, audit({ url: "https://irvetechnologie.fr/" }, { title: "Accueil 1" }), { key: "a1" });
    await appel(m, audit({ url: "https://irvetechnologie.fr/" }, { title: "Accueil 2" }), { key: "a1" });
    expect(m.overrides.get("/")!.title).toBe("Accueil 1");
    expect(m.historique.length).toBe(1);
  });
});

describe("plan du site", () => {
  it("liste l'article avec son URL canonique ; une mise à jour change lastmod/dateModified, pas datePublished", async () => {
    const m = memoire();
    await appel(m, publier(), { key: "k1", revision: 1 });
    const a1 = m.articles.get("art-1")!;
    const xml1 = construirePlanDuSite([{ loc: urlArticle(a1.slug), lastmod: a1.updated_at }]);
    expect(xml1).toContain("<loc>https://irvetechnologie.fr/blog/prix-borne-recharge</loc>");
    expect(xml1).toContain("<lastmod>2026-11-14T09:00:00+00:00</lastmod>");

    avancer(120);
    await appel(m, maj({ content: "<p>v2</p>" }), { key: "k2", revision: 2 });
    const a2 = m.articles.get("art-1")!;
    const xml2 = construirePlanDuSite([{ loc: urlArticle(a2.slug), lastmod: a2.updated_at }]);
    expect(xml2).not.toContain("<lastmod>2026-11-14T09:00:00+00:00</lastmod>");
    const vue = composerArticle(a2, null);
    expect(vue.publishedAt).toBe("2026-11-14T09:00:00.000Z");
    expect(vue.updatedAt).toBe(horloge.toISOString());
  });

  it("échappe les caractères spéciaux et retire les doublons", () => {
    const xml = construirePlanDuSite([{ loc: "https://irvetechnologie.fr/a&b" }, { loc: "https://irvetechnologie.fr/a&b" }]);
    expect(xml).toContain("<loc>https://irvetechnologie.fr/a&amp;b</loc>");
    expect(xml.match(/<url>/g)!.length).toBe(1);
  });
});
