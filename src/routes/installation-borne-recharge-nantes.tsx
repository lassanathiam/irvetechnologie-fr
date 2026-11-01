import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { getTarifsSitePublic, TARIFS_SITE_DEFAUT } from "@/lib/tarifs-site.functions";

const URL = "https://irvetechnologie.fr/installation-borne-recharge-nantes";
const TITRE = "Installation borne de recharge à Nantes | Borne de l'Ouest";
const DESC =
  "Installation de borne de recharge à Nantes et en Loire-Atlantique : déroulé du chantier, aides Advenir, crédit d'impôt et tarifs. Installateur qualifié IRVE P1 P2 P3.";

export const Route = createFileRoute("/installation-borne-recharge-nantes")({
  loader: async () => {
    try {
      return await getTarifsSitePublic();
    } catch {
      return TARIFS_SITE_DEFAUT;
    }
  },
  head: () => ({
    links: [{ rel: "canonical", href: URL }],
    meta: [
      { title: TITRE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITRE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: URL },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PageNantes,
});

const etapes = [
  ["Demande et échange", "Vous décrivez votre logement, votre véhicule et votre tableau électrique. Nous vous rappelons rapidement."],
  ["Étude technique", "Vérification de la puissance disponible, de la distance tableau–borne et du type de pose (murale ou sur pied)."],
  ["Devis clair", "Un devis détaillé : borne, câble, protections, main-d'œuvre et aides applicables."],
  ["Installation", "Pose par un électricien qualifié IRVE, en général en une demi-journée à une journée."],
  ["Mise en service", "Tests, réglages, explication de l'utilisation et remise de l'attestation de conformité."],
];

function PageNantes() {
  const t = Route.useLoaderData();
  const eur = (n: number) => `${n.toLocaleString("fr-FR")} €`;
  return (
    <div className="public-premium min-h-screen bg-background text-foreground">
      <SiteNav />
      <main className="pt-28">
        <section className="border-b border-border">
          <div className="mx-auto max-w-5xl px-6 py-14 sm:py-20">
            <p className="text-primary font-medium">Nantes · Loire-Atlantique</p>
            <h1 className="mt-4 text-4xl md:text-5xl font-medium tracking-tight">
              Installation de borne de recharge à Nantes
            </h1>
            <p className="mt-6 max-w-3xl text-muted-foreground leading-relaxed">
              Borne de l&apos;Ouest installe des bornes de recharge pour voitures électriques chez les
              particuliers, en copropriété et en entreprise, à Nantes et dans toute l&apos;agglomération
              (Rezé, Saint-Herblain, Orvault, Carquefou, Vertou…). Installateur qualifié IRVE P1 · P2 · P3.
            </p>
            <Link to="/demande" className="mt-8 inline-flex items-center gap-2 rounded-md px-5 py-3 bg-primary text-primary-foreground hover:opacity-90 transition">
              Demander un devis gratuit <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>

        <section className="border-b border-border">
          <div className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
            <h2 className="text-3xl font-medium">Le déroulé de votre installation</h2>
            <ol className="mt-8 grid gap-4 md:grid-cols-5">
              {etapes.map(([titre, texte], i) => (
                <li key={titre} className="rounded-xl border border-border bg-card p-5">
                  <span className="text-primary font-semibold">{i + 1}</span>
                  <h3 className="mt-2 font-medium">{titre}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">{texte}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-b border-border">
          <div className="mx-auto max-w-5xl px-6 py-12 sm:py-16 grid gap-6 lg:grid-cols-2">
            <article className="rounded-xl border border-border bg-card p-6 sm:p-8">
              <h2 className="text-2xl font-medium">Aides Advenir</h2>
              <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
                Le programme Advenir finance une partie de l&apos;installation pour les copropriétés,
                les logements collectifs, les entreprises et les collectivités. Le montant dépend du
                type de site et du programme en vigueur. Nous vérifions votre éligibilité et montons
                le dossier avec vous.
              </p>
            </article>
            <article className="rounded-xl border border-border bg-card p-6 sm:p-8">
              <h2 className="text-2xl font-medium">Pour les particuliers</h2>
              <ul className="mt-4 space-y-3 text-sm text-muted-foreground">
                {[
                  "Crédit d'impôt pour l'achat et la pose d'une borne (sous conditions).",
                  "TVA réduite possible pour un logement de plus de 2 ans.",
                  "Installation par un professionnel qualifié IRVE, obligatoire pour bénéficier des aides.",
                ].map((p) => (
                  <li key={p} className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />{p}</li>
                ))}
              </ul>
            </article>
          </div>
        </section>

        <section className="border-b border-border">
          <div className="mx-auto max-w-5xl px-6 py-12 sm:py-16">
            <h2 className="text-3xl font-medium">Tarifs</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {[
                ["Installation de borne", t.installation_ttc, "Pose standard, mise en service comprise"],
                ["Maintenance", t.maintenance_ttc, "Contrôle et entretien de votre borne"],
                ["Dépannage", t.depannage_ttc, "Intervention sur borne existante"],
              ].map(([nom, prix, detail]) => (
                <article key={nom as string} className="rounded-xl border border-border bg-card p-6">
                  <h3 className="font-medium">{nom}</h3>
                  <p className="mt-3 text-3xl font-semibold text-primary">à partir de {eur(prix as number)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">TTC · {detail}</p>
                </article>
              ))}
            </div>
            <p className="mt-6 text-sm text-muted-foreground">
              Le prix final dépend de la borne choisie et de la distance entre le tableau et la borne.
              Estimez votre projet avec notre <Link to="/calculateur-irve" className="text-primary underline">calculateur</Link> ou
              consultez nos <Link to="/bornes" className="text-primary underline">bornes</Link>.
            </p>
          </div>
        </section>

        <section className="py-12 sm:py-16">
          <div className="mx-auto max-w-5xl px-6 text-center">
            <h2 className="text-3xl font-medium">Un projet à Nantes ?</h2>
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
