import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { composerArticle, type ArticleAffiche, type SurchargeSeo } from "@/lib/sorank/rendu";
import { CHEMINS_PAGES_CODEES, normaliserChemin } from "@/lib/sorank/pages-publiques";

/** Lecture publique (clé publiable, sans session) : les articles sont des pages publiques. */
async function clientPublic() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Correction SEO d'une seule page, lue côté serveur uniquement (la table n'est pas
 * lisible par les visiteurs) : jamais de liste, seulement le chemin demandé.
 */
async function lireSurchargeServeur(path: string): Promise<SurchargeSeo | null> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { versSurcharge } = await import("@/lib/sorank/store.server");
  const { data, error } = await supabaseAdmin
    .from("seo_page_overrides")
    .select("path, title, h1, meta_description, content_html, images, json_ld, json_ld_mode, updated_at")
    .eq("path", path)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return versSurcharge(data);
}

export type ArticleResume = {
  slug: string;
  title: string;
  meta_description: string;
  featured_image_url: string | null;
  featured_image_alt: string | null;
  published_at: string;
  updated_at: string;
};

export const listerArticlesBlog = createServerFn({ method: "GET" }).handler(async (): Promise<ArticleResume[]> => {
  const db = await clientPublic();
  const { data, error } = await db
    .from("blog_articles")
    .select("slug, title, meta_description, featured_image_url, featured_image_alt, published_at, updated_at")
    .order("published_at", { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data ?? []) as ArticleResume[];
});

export const lireArticleBlog = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ slug: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }): Promise<ArticleAffiche | null> => {
    const db = await clientPublic();
    const { data: article, error } = await db
      .from("blog_articles")
      .select("slug, title, meta_description, content_html, featured_image_url, featured_image_alt, language, published_at, updated_at")
      .eq("slug", data.slug.toLowerCase())
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!article) return null;
    return composerArticle(article, await lireSurchargeServeur(`/blog/${article.slug}`));
  });

/** Correction SEO d'une page codée du site (titre, description, JSON-LD), ou null. */
export const lireSurchargeSeo = createServerFn({ method: "GET" })
  .inputValidator((d: unknown) => z.object({ path: z.string().min(1).max(300) }).parse(d))
  .handler(async ({ data }): Promise<SurchargeSeo | null> => {
    // Seules les pages publiques du site peuvent être interrogées.
    const path = normaliserChemin(data.path);
    if (!CHEMINS_PAGES_CODEES.has(path)) return null;
    return lireSurchargeServeur(path);
  });
