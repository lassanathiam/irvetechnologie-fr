import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Building, Car, CheckCircle2, Hotel, Phone, Warehouse } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";

const URL = "https://irvetechnologie.fr/borne-recharge-professionnels";
const TITRE = "Borne de recharge pour professionnels et copropriétés | Borne de l'Ouest";
const DESC =
  "Bornes de recharge pour syndics, copropriétés, entreprises avec parking, hôtels, restaurants, commerces, garages et concessions en Bretagne et Pays de la Loire. Aide Advenir.";

export const Route = createFileRoute("/borne-recharge-professionnels")({
  head: () => ({
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
  }),
  component: Pros,
});

const CIBLES = [
  {
    icon: Building,
    titre: "Syndics et copropriétés",
    secteur: "Syndic / copropriété",
    points: [
      "Droit à la prise : installation individuelle pour un résident qui en fait la demande.",
      "Infrastructure collective pour équiper le parking par étapes.",
      "Dossier d'aide Advenir monté avec vous quand la copropriété est éligible.",
    ],
  },
  {
    icon: Warehouse,
    titre: "Entreprises avec parking",
    secteur: "Entreprise avec parking",
    points: [
      "Recharge des véhicules de société, des salariés et des visiteurs.",
      "Pilotage de la puissance pour ne pas dépasser votre abonnement électrique.",
      "Maintenance et dépannage de vos bornes existantes.",
    ],
  },
  {
    icon: Hotel,
    titre: "Hôtels, restaurants et commerces",
    secteur: "Hôtel / restaurant / commerce",
    points: [
      "Un service apprécié des clients en voiture électrique.",
      "Bornes accessibles au public, avec paiement possible selon le modèle.",
      "Pose rapide pour limiter la gêne de votre activité.",
    ],
  },
  {
    icon: Car,
    titre: "Garages et concessions",
    secteur: "Garage / concession",
    points: [
      "Recharge des véhicules en atelier, en exposition et en livraison.",
      "Bornes rapides ou multiples selon votre puissance disponible.",
      "Mise en service, remplacement et maintenance par un électricien IRVE.",
    ],
  },
];

function Pros() {
  return (
    <div className="public-premium min-h-screen bg-background text-foreground">
      <SiteNav />
      <main className="pt-28">
        <section className="border-b border-border">
          <div className="mx-auto max-w-5xl px-6 py-14 sm:py-20">
            <p className="text-primary font-medium">Professionnels · Bretagne · Pays de la Loire</p>
            <h1 className="mt-4 text-4xl md:text-5xl font-medium tracking-tight">
              Bornes de recharge pour les professionnels
            </h1>
            <p className="mt-6 max-w-3xl text-muted-foreground leading-relaxed">
              Copropriétés, entreprises, hôtels, commerces, garages : Borne de l&apos;Ouest étudie votre site, propose la
              solution adaptée à votre puissance électrique et réalise l&apos;installation. Électricien qualifié IRVE P1 · P2 · P3.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/demande" search={{ profil: "professionnel" }} className="inline-flex items-center gap-2 rounded-md px-5 py-3 bg-primary text-primary-foreground hover:opacity-90 transition">
                Demander une étude gratuite <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="tel:+33633657840" className="inline-flex items-center gap-2 rounded-md px-5 py-3 border border-border bg-card hover:border-primary transition">
                <Phone className="h-4 w-4" /> 06 33 65 78 40
              </a>
            </div>
          </div>
        </section>

        <section className="border-b border-border">
          <div className="mx-auto max-w-5xl px-6 py-12 sm:py-16 grid gap-6 md:grid-cols-2">
            {CIBLES.map((c) => (
              <article key={c.titre} className="rounded-xl border border-border bg-card p-6 sm:p-8 flex flex-col">
                <c.icon className="h-6 w-6 text-primary" />
                <h2 className="mt-3 text-2xl font-medium">{c.titre}</h2>
                <ul className="mt-4 space-y-3 text-sm text-muted-foreground flex-1">
                  {c.points.map((p) => (
                    <li key={p} className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />{p}</li>
                  ))}
                </ul>
                <Link to="/demande" search={{ profil: "professionnel", secteur: c.secteur }} className="mt-6 inline-flex items-center gap-1 text-sm font-medium text-primary underline">
                  Demander un devis <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </article>
            ))}
          </div>
        </section>

        <section className="py-12 sm:py-16">
          <div className="mx-auto max-w-5xl px-6 text-center">
            <h2 className="text-3xl font-medium">Où intervenons-nous ?</h2>
            <p className="mt-3 text-muted-foreground">Nantes, Rennes, Brest, Angers, Le Mans, Vannes et toute la Bretagne et les Pays de la Loire.</p>
            <Link to="/zones-intervention" className="mt-6 inline-flex items-center gap-2 rounded-md px-5 py-3 border border-border bg-card hover:border-primary transition">
              Voir nos zones d&apos;intervention <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
