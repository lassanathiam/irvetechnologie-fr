import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { BORNES_CATALOGUE } from "@/lib/bornes-catalogue";

export const Route = createFileRoute("/bornes")({
  head: () => ({
    meta: [
      { title: "Nos bornes de recharge — modèles et puissances | Borne de l'Ouest" },
      {
        name: "description",
        content:
          "Comparez les bornes que nous installons : 3,7 à 22 kW, monophasé ou triphasé, murales ou sur pied, pour maison, copropriété et entreprise.",
      },
      { property: "og:title", content: "Nos bornes de recharge — modèles et puissances" },
      {
        property: "og:description",
        content:
          "Tous les modèles installés par Borne de l'Ouest : puissance, alimentation et usage conseillé, avec demande de devis préremplie.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Bornes,
});

function Bornes() {
  return (
    <div className="public-premium min-h-screen bg-background text-foreground">
      <SiteNav />

      <section className="pt-28 pb-12 border-b border-border">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex items-center gap-3 text-mono text-primary mb-6">
            <span className="h-px w-10 bg-primary" /> Nos bornes · {BORNES_CATALOGUE.length} modèles
          </div>
          <h1 className="text-3xl md:text-5xl font-medium tracking-tight">Choisissez votre borne</h1>
          <p className="mt-6 max-w-2xl text-muted-foreground">
            Cliquez sur un modèle : votre demande de devis s&apos;ouvre déjà préremplie avec la borne, sa puissance et
            son alimentation. Il ne vous reste qu&apos;à indiquer vos coordonnées, le métrage de câble et vos photos.
          </p>
        </div>
      </section>

      <section className="py-14">
        <div className="mx-auto grid max-w-6xl gap-5 px-6 sm:grid-cols-2 lg:grid-cols-3">
          {BORNES_CATALOGUE.map((b) => (
            <Link
              key={b.id}
              to="/demande"
              search={{ borne: b.id }}
              className="group flex flex-col items-center gap-3 rounded-2xl border border-border bg-card/70 p-6 transition hover:border-primary hover:bg-card"
            >
              <div className="flex h-32 w-32 items-center justify-center rounded-xl border border-border bg-premium-night/60 p-3">
                <img
                  src={b.img}
                  alt={`Borne ${b.nom}`}
                  loading="lazy"
                  width={128}
                  height={128}
                  className="h-full w-full object-contain"
                />
              </div>
              <h2 className="text-center text-base font-semibold text-foreground">{b.nom}</h2>
              <span className="hero-grad rounded-full px-3 py-1 text-xs font-semibold text-primary-foreground">
                {b.puissance} · {b.phase}
              </span>
              <p className="text-center text-sm text-muted-foreground">{b.atout}</p>
              <p className="text-center text-xs text-muted-foreground/80">Idéal : {b.usage}</p>
              {b.badge && (
                <span className="rounded-full border border-primary/50 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  {b.badge}
                </span>
              )}
              <span className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-primary">
                Demander un devis <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
