import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Phone, Zap, Wrench, HardHat, Activity, Check } from "lucide-react";
import borneHero from "@/assets/borne-hero.jpg";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Borne de l'Ouest — Installation bornes de recharge VE | Grand Ouest" },
      { name: "description", content: "Borne de l'Ouest : installation de bornes de recharge IRVE en Bretagne et Pays de la Loire. Étude, génie civil, électricité et maintenance — 44, 49, 56, 35, 85, 72, 53." },
      { property: "og:title", content: "Borne de l'Ouest — Bornes de recharge VE dans le Grand Ouest" },
      { property: "og:description", content: "Étude, génie civil, électricité et maintenance pour vos bornes 7 / 11 / 22 kW en Bretagne & Pays de la Loire." },
    ],
  }),
  component: Index,
});

const services = [
  { code: "S/01", title: "Bornes IRVE", icon: Zap, body: "Installation 7, 11, 22 kW pour particuliers, entreprises et concessions. Marques de référence, accompagnement Advenir." },
  { code: "S/02", title: "Électricité", icon: Activity, body: "Adaptation de tableaux, protections différentielles, disjoncteurs et contrôle de puissance." },
  { code: "S/03", title: "Génie civil", icon: HardHat, body: "Tranchées, fourreaux, passage de réseaux enterrés et préparation complète des infrastructures." },
  { code: "S/04", title: "Maintenance", icon: Wrench, body: "Dépannage, contrôle annuel, suivi technique et accompagnement après installation." },
];

const steps = [
  { n: "01", t: "Demande", d: "Vous décrivez votre besoin et joignez vos photos (tableau, cheminement, emplacement)." },
  { n: "02", t: "Étude technique", d: "Analyse de puissance, faisabilité, choix de la borne et chiffrage clair." },
  { n: "03", t: "Installation", d: "Génie civil, raccordement, pose et mise en service par nos équipes habilitées." },
  { n: "04", t: "Maintenance", d: "Suivi annuel, dépannage rapide et garantie sur l'installation." },
];

function Index() {
  return (
    <div className="min-h-screen">
      <SiteNav />

      {/* HERO */}
      <section className="relative pt-32 pb-24">
        <div className="mx-auto max-w-7xl px-6 grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="flex items-center gap-3 text-mono text-primary mb-8">
              <span className="h-px w-10 bg-primary" />
              <span className="relative flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                IRVE · Bretagne & Pays de la Loire
              </span>
            </div>
            <h1 className="font-display text-5xl md:text-7xl font-medium tracking-tight leading-[1.02]">
              <span className="block">Borne de</span>
              <span className="block">
                <em className="not-italic text-primary font-light italic">l'Ouest</em>{" "}
                <span className="text-muted-foreground/60">— rechargez</span>
              </span>
              <span className="block">près de chez vous.</span>
            </h1>
            <p className="mt-8 max-w-lg text-muted-foreground leading-relaxed">
              Installation de bornes de recharge pour véhicules électriques dans tout le
              Grand Ouest. Étude technique, génie civil, raccordement et maintenance —
              une équipe locale, un seul interlocuteur, du devis à la mise en service.
            </p>
            <div className="mt-10 flex flex-wrap gap-3">
              <Link to="/demande" className="hero-grad text-primary-foreground text-mono px-5 py-3.5 rounded-sm inline-flex items-center gap-2 hover:opacity-90 transition">
                Demande de raccordement <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="tel:0768084367" className="border border-border text-mono px-5 py-3.5 rounded-sm inline-flex items-center gap-2 hover:border-primary transition">
                <Phone className="h-4 w-4" /> 07 68 08 43 67
              </a>
            </div>

            <div className="mt-16 grid grid-cols-3 gap-6 max-w-md border-t border-border pt-8">
              {[
                { v: "7", l: "Départements couverts" },
                { v: "48h", l: "Étude technique" },
                { v: "10★", l: "Avis clients" },
              ].map((s) => (
                <div key={s.l}>
                  <div className="text-3xl font-medium tracking-tight">{s.v}</div>
                  <div className="text-mono text-muted-foreground mt-2">{s.l}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 -m-4 border border-primary/20 rounded-sm" aria-hidden />
            <img
              src={borneHero}
              alt="Borne de recharge IRVE installée"
              width={1280}
              height={1280}
              className="relative rounded-sm w-full object-cover aspect-square"
            />
            <div className="absolute bottom-6 left-6 right-6 backdrop-blur-md bg-background/70 border border-border p-4 rounded-sm flex justify-between items-center">
              <div>
                <div className="text-mono text-primary flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                  Live install
                </div>
                <div className="mt-1 text-sm">Borne 22 kW · triphasé</div>
              </div>
              <div className="text-right">
                <div className="text-mono text-muted-foreground">Habilitations</div>
                <div className="text-sm mt-1">B1V · BR · BC · IRVE N2</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" className="py-24 border-t border-border">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex items-center gap-3 text-mono text-primary mb-6">
            <span className="h-px w-10 bg-primary" /> Nos services
          </div>
          <h2 className="text-4xl md:text-5xl font-medium tracking-tight max-w-3xl">
            Une offre complète,{" "}
            <span className="text-muted-foreground/60">pas juste une pose de borne.</span>
          </h2>
          <p className="mt-6 max-w-2xl text-muted-foreground">
            Vous n'achetez pas seulement une borne — vous obtenez une installation fiable,
            conforme, propre et suivie. Un seul interlocuteur technique, du devis à la maintenance.
          </p>

          <div className="mt-16 grid md:grid-cols-2 lg:grid-cols-4 gap-px bg-border border border-border rounded-sm overflow-hidden">
            {services.map((s) => (
              <div key={s.code} className="bg-card p-8 hover:bg-secondary/50 transition group">
                <div className="flex justify-between items-start mb-10">
                  <span className="text-mono text-muted-foreground">{s.code}</span>
                  <s.icon className="h-5 w-5 text-primary group-hover:scale-110 transition" strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-medium tracking-tight">{s.title}</h3>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PARCOURS */}
      <section id="parcours" className="py-24 border-t border-border">
        <div className="mx-auto max-w-7xl px-6">
          <div className="flex items-center gap-3 text-mono text-primary mb-6">
            <span className="h-px w-10 bg-primary" /> Parcours client
          </div>
          <h2 className="text-4xl md:text-5xl font-medium tracking-tight max-w-3xl">
            Devis clair,{" "}
            <span className="text-muted-foreground/60">chantier maîtrisé.</span>
          </h2>

          <ol className="mt-16 grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s) => (
              <li key={s.n} className="relative p-6 border border-border rounded-sm bg-card/50">
                <div className="text-mono text-primary mb-6">{s.n}</div>
                <div className="font-medium">{s.t}</div>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{s.d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ZONES */}
      <section id="zones" className="py-24 border-t border-border">
        <div className="mx-auto max-w-7xl px-6 grid lg:grid-cols-2 gap-12">
          <div>
            <div className="flex items-center gap-3 text-mono text-primary mb-6">
              <span className="h-px w-10 bg-primary" /> Zones d'intervention
            </div>
            <h2 className="text-4xl md:text-5xl font-medium tracking-tight">
              Le Grand Ouest,{" "}
              <span className="text-muted-foreground/60">notre terrain de jeu.</span>
            </h2>
            <p className="mt-6 text-muted-foreground max-w-md">
              Bretagne et Pays de la Loire. Nos équipes interviennent au plus près de chez vous,
              avec une vraie connaissance du terrain et du réseau électrique local.
            </p>
          </div>
          <ul className="grid grid-cols-2 gap-3 self-end">
            {["44 · Loire-Atlantique", "49 · Maine-et-Loire", "85 · Vendée", "72 · Sarthe", "53 · Mayenne", "35 · Ille-et-Vilaine", "56 · Morbihan"].map((z) => (
              <li key={z} className="text-mono flex items-center gap-3 border border-border p-4 rounded-sm bg-card/50 hover:border-primary hover:bg-card transition">
                <Check className="h-3 w-3 text-primary" strokeWidth={3} /> {z}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 border-t border-border">
        <div className="mx-auto max-w-5xl px-6 text-center">
          <h2 className="text-4xl md:text-6xl font-medium tracking-tight">
            Prêt à recharger{" "}
            <span className="text-primary italic font-light">chez vous</span> ?
          </h2>
          <p className="mt-6 text-muted-foreground max-w-xl mx-auto">
            Envoyez-nous quelques photos et nous étudions la faisabilité sous 48h.
          </p>
          <Link to="/demande" className="mt-10 hero-grad text-primary-foreground text-mono px-6 py-4 rounded-sm inline-flex items-center gap-2 hover:opacity-90">
            Démarrer ma demande <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
