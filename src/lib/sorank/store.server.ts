import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { ArticleStocke, SorankStore } from "./webhook";
import { SURCHARGE_VIDE, type ImageSurcharge, type SurchargeSeo } from "./rendu";

const COLONNES =
  "sorank_article_id, slug, title, meta_description, content_html, featured_image_url, featured_image_alt, language, revision, published_at, updated_at";

export function versSurcharge(row: Database["public"]["Tables"]["seo_page_overrides"]["Row"] | null): SurchargeSeo | null {
  if (!row) return null;
  return {
    title: row.title,
    h1: row.h1,
    meta_description: row.meta_description,
    content_html: row.content_html,
    images: Array.isArray(row.images) ? (row.images as unknown as ImageSurcharge[]) : [],
    json_ld: row.json_ld ?? null,
    json_ld_mode: (row.json_ld_mode as SurchargeSeo["json_ld_mode"]) ?? "default",
  };
}

/** Stockage Sorank sur la base du site (client administrateur, appelé après vérification du secret). */
export function creerStoreSorank(db: SupabaseClient<Database>): SorankStore {
  return {
    async claimDelivery(key, event, staleBefore) {
      const ins = await db.from("sorank_webhook_deliveries").insert({ idempotency_key: key, event });
      if (!ins.error) return { kind: "claimed" };
      if (ins.error.code !== "23505") throw new Error(ins.error.message);
      const { data, error } = await db
        .from("sorank_webhook_deliveries")
        .select("status, response_status, response_body, updated_at")
        .eq("idempotency_key", key)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return { kind: "busy" };
      if (data.status === "done") return { kind: "done", status: data.response_status ?? 200, body: data.response_body };
      if (new Date(data.updated_at) < staleBefore) {
        // Traitement interrompu (plantage) : on reprend la main.
        const { data: repris, error: e2 } = await db
          .from("sorank_webhook_deliveries")
          .update({ updated_at: new Date().toISOString() })
          .eq("idempotency_key", key)
          .eq("status", "processing")
          .eq("updated_at", data.updated_at)
          .select("idempotency_key");
        if (e2) throw new Error(e2.message);
        if (repris && repris.length > 0) return { kind: "claimed" };
      }
      return { kind: "busy" };
    },
    async completeDelivery(key, status, body) {
      const { error } = await db
        .from("sorank_webhook_deliveries")
        .update({ status: "done", response_status: status, response_body: body as never, updated_at: new Date().toISOString() })
        .eq("idempotency_key", key);
      if (error) throw new Error(error.message);
    },
    async releaseDelivery(key) {
      await db.from("sorank_webhook_deliveries").delete().eq("idempotency_key", key).eq("status", "processing");
    },
    async findArticleBySorankId(id) {
      const { data, error } = await db.from("blog_articles").select(COLONNES).eq("sorank_article_id", id).maybeSingle();
      if (error) throw new Error(error.message);
      return (data as ArticleStocke | null) ?? null;
    },
    async findArticleBySlug(slug) {
      const { data, error } = await db.from("blog_articles").select(COLONNES).eq("slug", slug).maybeSingle();
      if (error) throw new Error(error.message);
      return (data as ArticleStocke | null) ?? null;
    },
    async insertArticle(row) {
      const { error } = await db.from("blog_articles").insert(row);
      if (error) throw new Error(error.message);
    },
    async updateArticle(sorankId, patch) {
      const { error } = await db.from("blog_articles").update(patch).eq("sorank_article_id", sorankId);
      if (error) throw new Error(error.message);
    },
    async getOverride(path) {
      const { data, error } = await db.from("seo_page_overrides").select("*").eq("path", path).maybeSingle();
      if (error) throw new Error(error.message);
      return versSurcharge(data);
    },
    async saveOverride(path, next, before, key) {
      const { error } = await db.from("seo_page_overrides").upsert({
        path,
        title: next.title,
        h1: next.h1,
        meta_description: next.meta_description,
        content_html: next.content_html,
        images: next.images as never,
        json_ld: (next.json_ld ?? null) as never,
        json_ld_mode: next.json_ld_mode,
        updated_at: new Date().toISOString(),
      });
      if (error) throw new Error(error.message);
      // Sorank ne garde pas l'original : on archive l'état précédent pour pouvoir revenir en arrière.
      const h = await db.from("seo_page_override_history").insert({
        path,
        idempotency_key: key,
        before: (before ?? SURCHARGE_VIDE) as never,
        after: next as never,
      });
      if (h.error) throw new Error(h.error.message);
    },
  };
}
