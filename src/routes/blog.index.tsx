import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { listerArticlesBlog } from "@/lib/blog.functions";
import { avecSurchargeSeo, formaterDateArticle, isoAvecFuseau } from "@/lib/sorank/rendu";

const URL_BLOG = "https://irvetechnologie.fr/blog";
const articlesQuery = queryOptions({ queryKey: ["blog", "articles"], queryFn: () => listerArticlesBlog() });

export const Route = createFileRoute("/blog/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(articlesQuery),
  head: avecSurchargeSeo(() => ({
    links: [{ rel: "canonical", href: URL_BLOG }],
    meta: [
      { title: "Blog bornes de recharge | Borne de l'Ouest" },
      {
        name: "description",
        content:
          "Conseils, prix et réglementation pour installer une borne de recharge à la maison, en copropriété ou en entreprise, par l'équipe IRVE de Borne de l'Ouest.",
      },
      { property: "og:title", content: "Blog bornes de recharge | Borne de l'Ouest" },
      {
        property: "og:description",
        content: "Conseils et guides pratiques sur l'installation de bornes de recharge dans le Grand Ouest.",
      },
      { property: "og:url", content: URL_BLOG },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  })),
  component: BlogIndex,
  errorComponent: () => (
    <div role="alert" className="p-10 text-center text-slate-600">
      Le blog est momentanément indisponible.
    </div>
  ),
  notFoundComponent: () => <div className="p-10 text-center">Aucun article.</div>,
});

function BlogIndex() {
  const { data: articles } = useSuspenseQuery(articlesQuery);
  return (
    <div className="public-premium min-h-screen bg-background text-foreground">
      <SiteNav />
      <main className="pt-28">
        <section className="border-b border-border">
          <div className="mx-auto max-w-5xl px-6 py-14 sm:py-20">
            <p className="text-sm font-semibold text-emerald-600">Blog</p>
            <h1 className="mt-4 text-4xl md:text-5xl font-medium tracking-tight">
              Guides et conseils pour la recharge électrique
            </h1>
            <p className="mt-6 max-w-3xl text-muted-foreground leading-relaxed">
              Prix, démarches, choix de la borne et réglementation : nos réponses claires aux questions que
              se posent les particuliers, copropriétés et professionnels.
            </p>
          </div>
        </section>
        <section className="mx-auto max-w-5xl px-6 py-12">
          {articles.length === 0 ? (
            <p className="text-muted-foreground">Les premiers articles arrivent bientôt.</p>
          ) : (
            <ul className="grid gap-6 md:grid-cols-2">
              {articles.map((a) => (
                <li key={a.slug} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <Link to="/blog/$slug" params={{ slug: a.slug }} className="group block h-full">
                    {a.featured_image_url && (
                      <img
                        src={a.featured_image_url}
                        alt={a.featured_image_alt ?? ""}
                        loading="lazy"
                        className="aspect-[16/9] w-full object-cover"
                      />
                    )}
                    <div className="p-6">
                      <time dateTime={isoAvecFuseau(a.published_at)} className="text-xs text-slate-500">
                        {formaterDateArticle(a.published_at, "fr-FR")}
                      </time>
                      <h2 className="mt-2 text-xl font-semibold text-slate-900 group-hover:text-emerald-700">{a.title}</h2>
                      {a.meta_description && <p className="mt-3 text-sm text-slate-600 line-clamp-3">{a.meta_description}</p>}
                      <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-emerald-700">
                        Lire l'article <ArrowRight className="h-4 w-4" />
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
