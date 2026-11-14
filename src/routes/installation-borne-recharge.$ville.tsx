import { avecSurchargeSeo } from "@/lib/sorank/rendu";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowRight, Building2, CheckCircle2, Home, Phone } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { getTarifsSitePublic, TARIFS_SITE_DEFAUT } from "@/lib/tarifs-site.functions";
import { trouverVille, VILLES_ZONE } from "@/lib/zones-intervention";
import { trouverContenuVille } from "@/lib/contenu-villes";
import { COMPANY_CONFIG, operatingBaseLine } from "@/config/company";

const BASE = "https://irvetechnologie.fr";

/** Une page ville peut être mise en avant alors qu'elle a sa propre route (ex. Nantes). */
function lienVoisine(slug: string) {
  if (slug === "nantes") {
    return { slug, nom: "Nantes", href: `${BASE}/installation-borne-recharge-nantes` };
  }
  const v = trouverVille(slug);
  if (!v) return null;
  return { slug, nom: v.nom, href: `${BASE}/installation-borne-recharge/${v.slug}` };
}

export const Route = createFileRoute("/installation-borne-recharge/$ville")({
  loader: async ({ params }) => {
    const ville = trouverVille(params.ville);
    if (!ville) throw notFound();
    let tarifs = TARIFS_SITE_DEFAUT;
    try {
      tarifs = await getTarifsSitePublic();
    } catch {
      /* tarifs par défaut */
    }
    return { ville, tarifs, contenu: trouverContenuVille(params.ville) };
  },
  head: avecSurchargeSeo(({ loaderData }) => {
    if (!loaderData) return { meta: [{ title: "Ville introuvable | Borne de l'Ouest" }] };
    const v = loaderData.ville;
    const c = loaderData.contenu;
    const url = `${BASE}/installation-borne-recharge/${v.slug}`;
    const titre = c?.titreSeo
      ? `${c.titreSeo} | Borne de l'Ouest`
      : `Installation borne de recharge à ${v.nom} (${v.numero}) | Borne de l'Ouest`;
    const desc =
      c?.descriptionSeo ??
      `Installateur de borne de recharge à ${v.nom} et en ${v.departement} : particuliers, copropriétés et entreprises. Devis gratuit, électricien qualifié IRVE P1 P2 P3.`;
    return {
      links: [{ rel: "canonical", href: url }],
      meta: [
        { title: titre },
        { name: "description", content: desc },
        { property: "og:title", content: titre },
        { property: "og:description", content: desc },
        { property: "og:url", content: url },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Service",
            serviceType: "Installation de borne de recharge pour véhicule électrique",
            name: `Installation de borne de recharge à ${v.nom}`,
            description: desc,
            provider: {
              "@type": "Electrician",
              name: COMPANY_CONFIG.brandName,
              legalName: COMPANY_CONFIG.legalName,
              url: BASE,
              telephone: "+33768084367",
              address: {
                "@type": "PostalAddress",
                streetAddress: COMPANY_CONFIG.operatingBase.street,
                postalCode: COMPANY_CONFIG.operatingBase.postalCode,
                addressLocality: COMPANY_CONFIG.operatingBase.city,
                addressRegion: "Pays de la Loire",
                addressCountry: "FR",
              },
            },
            areaServed: [
              { "@type": "City", name: v.nom },
              ...v.communes.map((c2) => ({ "@type": "City", name: c2 })),
            ],
            url,
          }),
        },
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              { "@type": "ListItem", position: 1, name: "Accueil", item: BASE },
              {
                "@type": "ListItem",
                position: 2,
                name: "Zones d'intervention",
                item: `${BASE}/zones-intervention`,
              },
              { "@type": "ListItem", position: 3, name: v.nom, item: url },
            ],
          }),
        },
      ],
    };
  }),
  component: PageVille,
  notFoundComponent: () => (
    <div className="public-premium min-h-screen bg-background text-foreground">
      <SiteNav />
      <main className="pt-28 mx-auto max-w-3xl px-6 py-20 text-center">
        <h1 className="text-3xl font-medium">Ville non trouvée</h1>
        <Link to="/zones-intervention" className="mt-6 inline-block text-primary underline">Voir nos zones d&apos;intervention</Link>
      </main>
      <SiteFooter />
    </div>
  ),
});

function PageVille() {
  const { ville: v, tarifs: t, contenu: c } = Route.useLoaderData();
  const eur = (n: number) => `${n.toLocaleString("fr-FR")} €`;
  const voisines = (c?.voisines ?? [])
    .map((s) => lienVoisine(s))
    .filter((x): x is { slug: string; href: string; nom: string } => Boolean(x));
  const voisinesDefaut = VILLES_ZONE.filter(
    (x) => x.region === v.region && x.slug !== v.slug && !c?.voisines.includes(x.slug),
  ).slice(0, 6);

  return (
    <div className="public-premium min-h-screen bg-background text-foreground">
      <SiteNav />
      <main className="pt-28">
        <section className="border-b border-border">
          <div className="mx-auto max-w-5xl px-6 py-14 sm:py-20">
            <p className="text-primary font-medium">{c?.surtitre ?? `${v.nom} · ${v.departement} (${v.numero})`}</p>
            <h1 className="mt-4 text-4xl md:text-5xl font-medium tracking-tight">
              {c?.h1 ?? `Installation de borne de recharge à ${v.nom}`}
            </h1>
            {(c?.intro ?? [
              `Borne de l'Ouest installe et entretient des bornes de recharge pour voitures électriques à ${v.nom} et aux alentours (${v.communes.join(", ")}). Particuliers, copropriétés, entreprises et commerces : un électricien qualifié IRVE P1 · P2 · P3 étudie votre projet et vous remet un devis clair.`,
            ]).map((p) => (
              <p key={p} className="mt-6 max-w-3xl text-muted-foreground leading-relaxed">
                {p}
              </p>
            ))}
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/demande" search={{ profil: "particulier" }} className="inline-flex items-center gap-2 rounded-md px-5 py-3 bg-primary text-primary-foreground hover:opacity-90 transition">
                <Home className="h-4 w-4" /> Devis particulier gratuit
              </Link>
              <Link to="/demande" search={{ profil: "professionnel" }} className="inline-flex items-center gap-2 rounded-md px-5 py-3 border border-border bg-card hover:border-primary transition">
                <Building2 className="h-4 w-4" /> Devis professionnel
              </Link>
              <a href={COMPANY_CONFIG.phoneHref} className="inline-flex items-center gap-2 rounded-md px-5 py-3 border border-border bg-card hover:border-primary transition">
                <Phone className="h-4 w-4" /> {COMPANY_CONFIG.phoneDisplay}
              </a>
            </div>
          </div>
        </section>

        {c?.sections.map((s) => (
          <section key={s.titre} className="border-b border-border">
            <div className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
              <h2 className="text-3xl font-medium">{s.titre}</h2>
              {s.paragraphes.map((p) => (
                <p key={p} className="mt-5 max-w-3xl text-muted-foreground leading-relaxed">
                  {p}
                </p>
              ))}
              {s.points && (
                <ul className="mt-6 grid gap-3 sm:grid-cols-3">
                  {s.points.map((p) => (
                    <li key={p} className="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                      <span className="mt-2 block">{p}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        ))}

        <section className="border-b border-border">
          <div className="mx-auto max-w-5xl px-6 py-12 sm:py-16 grid gap-6 lg:grid-cols-2">
            <article className="rounded-xl border border-border bg-card p-6 sm:p-8">
              <h2 className="text-2xl font-medium">Pour les particuliers</h2>
              <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                {[
                  `Maison ou appartement à ${v.nom} : borne murale ou sur pied, au garage ou en extérieur.`,
                  "Étude à distance grâce aux photos de votre tableau : souvent pas de déplacement d'étude.",
                  "Crédit d'impôt et TVA réduite possibles (sous conditions), avec un installateur qualifié IRVE.",
                ].map((p) => (
                  <li key={p} className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />{p}</li>
                ))}
              </ul>
            </article>
            <article className="rounded-xl border border-border bg-card p-6 sm:p-8">
              <h2 className="text-2xl font-medium">Pour les professionnels</h2>
              <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                {[
                  `Syndics et copropriétés en ${v.departement} : droit à la prise, bornes individuelles ou collectives.`,
                  "Entreprises avec parking, flottes, hôtels, restaurants, commerces, garages et concessions.",
                  "Montage du dossier d'aide Advenir quand votre site est éligible.",
                ].map((p) => (
                  <li key={p} className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />{p}</li>
                ))}
              </ul>
              <Link to="/borne-recharge-professionnels" className="mt-5 inline-flex items-center gap-1 text-sm text-primary underline">
                Solutions pour les professionnels <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </article>
          </div>
        </section>

        <section className="border-b border-border">
          <div className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
            <h2 className="text-3xl font-medium">Tarifs à {v.nom}</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {([
                ["Installation de borne", t.installation_ttc, "Pose standard, mise en service comprise"],
                ["Maintenance", t.maintenance_ttc, "Contrôle et entretien de votre borne"],
                ["Dépannage", t.depannage_ttc, "Intervention sur borne existante"],
              ] as const).map(([nom, prix, detail]) => (
                <article key={nom} className="rounded-xl border border-border bg-card p-6">
                  <h3 className="font-medium">{nom}</h3>
                  <p className="mt-3 text-3xl font-semibold text-primary">à partir de {eur(prix)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">TTC · {detail}</p>
                </article>
              ))}
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              Le prix final dépend de la borne et de la distance entre le tableau et la borne. Estimez votre projet avec
              notre <Link to="/calculateur-irve" className="text-primary underline">calculateur</Link>.
            </p>
          </div>
        </section>

        {c?.faq && c.faq.length > 0 && (
          <section className="border-b border-border">
            <div className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
              <h2 className="text-3xl font-medium">Vos questions sur la recharge à {v.nom}</h2>
              <div className="mt-8 space-y-4">
                {c.faq.map((f) => (
                  <article key={f.question} className="rounded-xl border border-border bg-card p-5 sm:p-6">
                    <h3 className="font-medium text-foreground">{f.question}</h3>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{f.reponse}</p>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        <section className="border-b border-border">
          <div className="mx-auto max-w-5xl px-6 py-12">
            <h2 className="text-xl font-medium">Nous intervenons aussi à</h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {voisines.map((x) =>
                trouverVille(x.slug) ? (
                  <Link key={x.href} to="/installation-borne-recharge/$ville" params={{ ville: x.slug }} className="rounded-full border border-border px-3 py-1.5 text-sm hover:border-primary">
                    {x.nom}
                  </Link>
                ) : (
                  <a key={x.href} href={x.href} className="rounded-full border border-border px-3 py-1.5 text-sm hover:border-primary">
                    {x.nom}
                  </a>
                ),
              )}
              {voisinesDefaut.map((x) => (
                <Link key={x.slug} to="/installation-borne-recharge/$ville" params={{ ville: x.slug }} className="rounded-full border border-border px-3 py-1.5 text-sm hover:border-primary">
                  {x.nom}
                </Link>
              ))}
              <Link to="/zones-intervention" className="rounded-full border border-primary/50 text-primary px-3 py-1.5 text-sm">Toutes les villes</Link>
            </div>
            <p className="mt-6 text-xs text-muted-foreground">
              Base opérationnelle : {operatingBaseLine} — {COMPANY_CONFIG.openingHoursDisplay}.
            </p>
          </div>
        </section>

        <section className="py-12 sm:py-16">
          <div className="mx-auto max-w-5xl px-6 text-center">
            <h2 className="text-3xl font-medium">Un projet à {v.nom} ?</h2>
            <p className="mt-3 text-muted-foreground">Réponse rapide, devis gratuit et sans engagement.</p>
            <Link to="/demande" className="mt-6 inline-flex items-center gap-2 rounded-md px-5 py-3 bg-primary text-primary-foreground hover:opacity-90 transition">
              Démarrer ma demande <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
