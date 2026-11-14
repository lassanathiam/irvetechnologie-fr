import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { lireArticleBlog } from "@/lib/blog.functions";
import { formaterDateArticle, isoAvecFuseau } from "@/lib/sorank/rendu";
import { COMPANY_CONFIG } from "@/config/company";

const articleQuery = (slug: string) =>
  queryOptions({ queryKey: ["blog", "article", slug], queryFn: () => lireArticleBlog({ data: { slug } }) });

export const Route = createFileRoute("/blog/$slug")({
  loader: async ({ params, context }) => {
    const article = await context.queryClient.ensureQueryData(articleQuery(params.slug));
    if (!article) throw notFound();
    return { article, htmlLang: article.language };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Article introuvable | Borne de l'Ouest" }, { name: "robots", content: "noindex" }] };
    }
    const a = loaderData.article;
    const url = `https://irvetechnologie.fr/blog/${a.slug}`;
    const publie = isoAvecFuseau(a.publishedAt);
    const modifie = isoAvecFuseau(a.updatedAt);
    const jsonLd =
      a.jsonLdMode === "replace"
        ? a.jsonLd
        : a.jsonLdMode === "remove"
          ? null
          : {
              "@context": "https://schema.org",
              "@type": "BlogPosting",
              headline: a.h1,
              description: a.description,
              ...(a.imageUrl ? { image: a.imageUrl } : {}),
              datePublished: publie,
              dateModified: modifie,
              inLanguage: a.language,
              mainEntityOfPage: { "@type": "WebPage", "@id": url },
              author: { "@type": "Organization", name: COMPANY_CONFIG.brandName },
              publisher: { "@type": "Organization", name: COMPANY_CONFIG.brandName },
            };
    return {
      links: [{ rel: "canonical", href: url }],
      meta: [
        { title: a.seoTitle },
        { name: "description", content: a.description },
        { property: "og:title", content: a.seoTitle },
        { property: "og:description", content: a.description },
        { property: "og:url", content: url },
        { property: "og:type", content: "article" },
        { property: "article:published_time", content: publie },
        { property: "article:modified_time", content: modifie },
        ...(a.imageUrl
          ? [
              { property: "og:image", content: a.imageUrl },
              { name: "twitter:image", content: a.imageUrl },
              { name: "twitter:card", content: "summary_large_image" },
            ]
          : [{ name: "twitter:card", content: "summary" }]),
        { name: "twitter:title", content: a.seoTitle },
        { name: "twitter:description", content: a.description },
      ],
      scripts: jsonLd ? [{ type: "application/ld+json", children: JSON.stringify(jsonLd) }] : [],
    };
  },
  component: ArticlePage,
  errorComponent: () => (
    <div role="alert" className="p-10 text-center text-slate-600">
      Cet article est momentanément indisponible.
    </div>
  ),
  notFoundComponent: () => (
    <div className="public-premium min-h-screen bg-background">
      <SiteNav />
      <main className="mx-auto max-w-3xl px-6 pt-36 pb-20 text-center">
        <h1 className="text-3xl font-medium">Article introuvable</h1>
        <p className="mt-4 text-muted-foreground">Cet article n'existe pas ou a été retiré.</p>
        <Link to="/blog" className="mt-6 inline-block font-medium text-emerald-700">Voir tous les articles</Link>
      </main>
      <SiteFooter />
    </div>
  ),
});

function ArticlePage() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(articleQuery(slug));
  if (!data) return null;
  const a = data;
  const modifie = new Date(a.updatedAt).getTime() > new Date(a.publishedAt).getTime();
  return (
    <div className="public-premium min-h-screen bg-background text-foreground">
      <SiteNav />
      <main className="pt-28">
        <article className="mx-auto w-full max-w-3xl px-6 py-12 sm:py-16">
          <Link to="/blog" className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700">
            <ArrowLeft className="h-4 w-4" /> Tous les articles
          </Link>
          <h1 className="mt-6 text-3xl md:text-5xl font-medium tracking-tight text-slate-900">{a.h1}</h1>
          <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
            <span>
              Publié le <time dateTime={isoAvecFuseau(a.publishedAt)}>{formaterDateArticle(a.publishedAt, a.language)}</time>
            </span>
            {modifie && (
              <span>
                Mis à jour le <time dateTime={isoAvecFuseau(a.updatedAt)}>{formaterDateArticle(a.updatedAt, a.language)}</time>
              </span>
            )}
          </p>
          {a.imageUrl && (
            <img
              src={a.imageUrl}
              alt={a.imageAlt}
              className="mt-8 aspect-[16/9] w-full rounded-2xl object-cover"
            />
          )}
          <div className="article-contenu mt-10" dangerouslySetInnerHTML={{ __html: a.contentHtml }} />
          <div className="mt-14 rounded-2xl border border-emerald-200 bg-emerald-50 p-6">
            <p className="font-semibold text-slate-900">Un projet de borne de recharge ?</p>
            <p className="mt-2 text-sm text-slate-600">Devis gratuit, électricien qualifié IRVE, intervention dans le Grand Ouest.</p>
            <Link to="/demande" className="mt-4 inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white">
              Demander mon devis
            </Link>
          </div>
        </article>
      </main>
      <SiteFooter />
    </div>
  );
}
