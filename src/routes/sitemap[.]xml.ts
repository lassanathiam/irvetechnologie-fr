import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { PAGES_PUBLIQUES, SITE_URL, urlArticle } from "@/lib/sorank/pages-publiques";
import { construirePlanDuSite, type EntreePlan } from "@/lib/sorank/plan-du-site";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { createClient } = await import("@supabase/supabase-js");
        const db = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
          auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
        });

        // Articles du blog : tous, par pages de 1 000 ; un échec renvoie une erreur, jamais un plan partiel.
        const articles: { slug: string; updated_at: string }[] = [];
        for (let debut = 0; ; debut += 1000) {
          const { data, error } = await db
            .from("blog_articles")
            .select("slug, updated_at")
            .order("published_at", { ascending: false })
            .range(debut, debut + 999);
          if (error) {
            console.error("Sitemap: lecture des articles impossible", error.message);
            return new Response("Sitemap temporarily unavailable", { status: 503, headers: { "Retry-After": "60" } });
          }
          articles.push(...(data ?? []));
          if (!data || data.length < 1000) break;
        }

        const entrees: EntreePlan[] = [
          ...PAGES_PUBLIQUES.map((p) => ({ ...p, loc: `${SITE_URL}${p.path === "/" ? "" : p.path}` })),
          ...articles.map((a) => ({ loc: urlArticle(a.slug), lastmod: a.updated_at })),
        ];

        return new Response(construirePlanDuSite(entrees), {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=300",
          },
        });
      },
    },
  },
});
