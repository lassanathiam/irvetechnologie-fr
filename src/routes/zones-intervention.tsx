import { avecSurchargeSeo } from "@/lib/sorank/rendu";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, MapPin } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import { VILLES_ZONE } from "@/lib/zones-intervention";

const URL = "https://irvetechnologie.fr/zones-intervention";
const TITRE = "Zones d'intervention Bretagne et Pays de la Loire | Borne de l'Ouest";
const DESC =
  "Installation de bornes de recharge en Bretagne et Pays de la Loire : Nantes, Rennes, Brest, Angers, Le Mans, Vannes, Saint-Nazaire et alentours. Particuliers et professionnels.";

export const Route = createFileRoute("/zones-intervention")({
  head: avecSurchargeSeo(() => ({
    links: [{ rel: "canonical", href: URL }],
    meta: [
      { title: TITRE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITRE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: URL },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  })),
  component: Zones,
});

function Zones() {
  const regions = ["Pays de la Loire", "Bretagne"] as const;
  return (
    <div className="public-premium min-h-screen bg-background text-foreground">
      <SiteNav />
      <main className="pt-28">
        <section className="mx-auto max-w-5xl px-6 py-14">
          <p className="text-primary font-medium">Bretagne · Pays de la Loire</p>
          <h1 className="mt-4 text-4xl md:text-5xl font-medium tracking-tight">Nos zones d&apos;intervention</h1>
          <p className="mt-6 max-w-3xl text-muted-foreground leading-relaxed">
            Borne de l&apos;Ouest installe des bornes de recharge chez les particuliers, en copropriété et en entreprise
            dans les principales villes de Bretagne et des Pays de la Loire. Choisissez votre ville.
          </p>
          {regions.map((r) => (
            <div key={r} className="mt-10">
              <h2 className="text-2xl font-medium">{r}</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {r === "Pays de la Loire" && (
                  <Link to="/installation-borne-recharge-nantes" className="rounded-xl border border-border bg-card p-4 hover:border-primary transition flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" /> Nantes <span className="text-muted-foreground text-sm">(44)</span>
                  </Link>
                )}
                {VILLES_ZONE.filter((v) => v.region === r).map((v) => (
                  <Link key={v.slug} to="/installation-borne-recharge/$ville" params={{ ville: v.slug }} className="rounded-xl border border-border bg-card p-4 hover:border-primary transition flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-primary" /> {v.nom} <span className="text-muted-foreground text-sm">({v.numero})</span>
                  </Link>
                ))}
              </div>
            </div>
          ))}
          <div className="mt-12 flex flex-wrap gap-3">
            <Link to="/demande" className="inline-flex items-center gap-2 rounded-md px-5 py-3 bg-primary text-primary-foreground hover:opacity-90 transition">
              Demander un devis gratuit <ArrowRight className="h-4 w-4" />
            </Link>
            <Link to="/borne-recharge-professionnels" className="inline-flex items-center gap-2 rounded-md px-5 py-3 border border-border bg-card hover:border-primary transition">
              Vous êtes un professionnel
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
