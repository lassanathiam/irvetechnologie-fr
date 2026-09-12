import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Phone, Zap, Wrench, HardHat, Activity, Check, Star, ShieldCheck, Sparkles, Clock, MapPin } from "lucide-react";
import chantier1 from "@/assets/chantier-1.jpg";
import chantier2 from "@/assets/chantier-2.jpg";
import chantier3 from "@/assets/chantier-3.jpg";
import chantierTechnicienIntervention from "@/assets/chantier-technicien-intervention.jpg";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { HeroSlider } from "@/components/HeroSlider";
import { RealisationsSlider } from "@/components/RealisationsSlider";
import { AnimatedCounter } from "@/components/AnimatedCounter";
import { useReveal } from "@/hooks/use-reveal";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listPublicRealisations } from "@/lib/realisations.functions";
import { COMPANY, GARANTIES } from "@/lib/company";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Borne de l'Ouest — Installation bornes de recharge VE | Grand Ouest" },
      { name: "description", content: "Borne de l'Ouest : installation de bornes de recharge IRVE en Bretagne et Pays de la Loire. Étude, génie civil, électricité et maintenance — 44, 49, 56, 35, 85, 72, 53." },
      { property: "og:title", content: "Borne de l'Ouest — Bornes de recharge VE dans le Grand Ouest" },
      { property: "og:description", content: "Étude, génie civil, électricité et maintenance pour vos bornes 7 / 11 / 22 kW en Bretagne & Pays de la Loire." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              name: "Accueil",
              item: "https://www.irvetechnologie.fr/",
            },
          ],
        }),
      },
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
  { n: "04", t: "Maintenance", d: "Suivi annuel et formule Sérénité pour garder votre borne en état." },
];

const heroSlides = [
  {
    src: chantierTechnicienIntervention,
    label: "Technicien en intervention",
    meta: "Pose et raccordement en conditions réelles",
  },
  { src: chantier2, label: "Mise en service", meta: "Intervention réelle client" },
  { src: chantier3, label: "Tableau électrique", meta: "Mise en conformité sur site" },
  { src: chantier1, label: "Suivi chantier", meta: "Contrôle final et essais" },
];

const realisationsFallback = [
  { src: chantier2, title: "Maison individuelle · Tesla 11 kW", place: "Nantes (44)", spec: "Pose extérieure sur façade, raccordement triphasé, cheminement en goulotte aluminium 8 m. Mise en service le jour même." },
  { src: chantier1, title: "Borne murale 11 kW", place: "Vannes (56)", spec: "Installation en garage attenant, ajout d'un différentiel 30 mA type A, prise T2S verrouillable. Éligible Advenir." },
  { src: chantier3, title: "Mise en conformité tableau", place: "Angers (49)", spec: "Refonte complète du tableau avant installation borne 22 kW. Contrôle Consuel et attestation IRVE." },
];


type Plan = {
  name: string;
  slug: "serenite" | "premium" | "pro";
  code: string;
  client: string;
  external: string;
  period: string;
  icon: typeof ShieldCheck;
  featured: boolean;
  desc: string;
  features: string[];
};

const maintenancePlans: Plan[] = [
  {
    name: "Sérénité",
    slug: "serenite",
    code: "M/01",
    client: "149",
    external: "Sur devis",
    period: "TTC/an",
    icon: ShieldCheck,
    featured: false,
    desc: "L'entretien annuel de votre borne de recharge.",
    features: [
      "1 visite préventive par an sur site",
      "Contrôle électrique et mesures",
      "Mise à jour des paramètres",
      "Rapport de visite remis",
      "Assistance téléphonique",
      "Main-d'œuvre de dépannage à tarif préférentiel",
      "Déplacement facturé au-delà de 60 km",
    ],
  },
  {
    name: "Sérénité+",
    slug: "premium",
    code: "M/02",
    client: "290",
    external: "Sur devis",
    period: "TTC/an",
    icon: Sparkles,
    featured: true,
    desc: "L'entretien renforcé, avec un dépannage inclus.",
    features: [
      "Tout Sérénité +",
      "Intervention sur site sous 72 h ouvrées",
      "1 dépannage main-d'œuvre inclus par an",
      "Pièces de remplacement facturées en sus",
      "Réservé aux bornes installées ou contrôlées par nos soins",
    ],
  },
  {
    name: "Pro / Flotte",
    slug: "pro",
    code: "M/03",
    client: "Sur devis",
    external: "Sur devis",
    period: "",
    icon: Wrench,
    featured: false,
    desc: "Entreprises, copropriétés, concessions.",
    features: [
      "Contrats multi-bornes",
      "Visites planifiées selon le parc",
      "Suivi technique et historique des interventions",
      "Reporting sur demande",
      "Conditions définies au contrat",
    ],
  },
];

const partenaires = ["Hager", "Schneider Electric", "Legrand", "Wallbox", "Tesla", "EVBox", "Hager Witty", "Schneider EVlink", "Legrand Green'up"];

function Index() {
  const services_r = useReveal<HTMLDivElement>();
  const parcours_r = useReveal<HTMLDivElement>();
  const real_r = useReveal<HTMLDivElement>();
  const fetchRealisations = useServerFn(listPublicRealisations);
  const realisationsQuery = useQuery({
    queryKey: ["realisations-publiques"],
    queryFn: () => fetchRealisations(),
    staleTime: 5 * 60 * 1000,
  });
  const realisations = realisationsQuery.data?.length
    ? realisationsQuery.data.map((r) => ({ src: r.url, title: r.titre, place: r.lieu, spec: r.description }))
    : realisationsFallback;
  const zones_r = useReveal<HTMLDivElement>();
  const [audience, setAudience] = useState<"client" | "external">("client");
  const isClient = audience === "client";

  return (
    <div className="min-h-screen overflow-x-hidden">
      <SiteNav />

      {/* HERO */}
      <section className="relative pt-32 pb-24">
        <div className="mx-auto max-w-7xl px-6 grid lg:grid-cols-2 gap-12 items-center">
          <div className="animate-fade-up">
            <div className="flex items-center gap-3 text-mono text-primary mb-8">
              <span className="h-px w-10 bg-primary" />
              <span className="relative flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                IRVE · Bretagne & Pays de la Loire
              </span>
            </div>
            <h1 className="font-display text-5xl md:text-7xl font-medium tracking-tight leading-[1.02]">
              <span className="block animate-fade-up" style={{ animationDelay: "80ms" }}>Borne de</span>
              <span className="block animate-fade-up" style={{ animationDelay: "180ms" }}>
                <em className="not-italic text-primary font-light italic">l'Ouest</em>{" "}
                <span className="text-muted-foreground/60">— installation</span>
              </span>
              <span className="block animate-fade-up" style={{ animationDelay: "280ms" }}>
                IRVE pour particuliers, entreprises et collectivités.
              </span>
            </h1>
            <p className="mt-8 max-w-lg text-muted-foreground leading-relaxed animate-fade-up" style={{ animationDelay: "400ms" }}>
              Installation de bornes de recharge pour véhicules électriques dans tout le
              Grand Ouest. Étude technique, génie civil, raccordement et maintenance —
              une équipe locale, un seul interlocuteur, du devis à la mise en service.
            </p>
            <div className="mt-10 flex flex-wrap gap-3 animate-fade-up" style={{ animationDelay: "500ms" }}>
              <Link to="/demande" className="hero-grad text-primary-foreground text-mono px-5 py-3.5 rounded-sm inline-flex items-center gap-2 hover:opacity-90 hover:scale-[1.02] transition">
                Demande de raccordement <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="tel:+33633657840" className="border border-border text-mono px-5 py-3.5 rounded-sm inline-flex items-center gap-2 hover:border-primary hover:text-primary transition">
                <Phone className="h-4 w-4" /> 06 33 65 78 40
              </a>
            </div>

            <div className="mt-16 grid grid-cols-3 gap-6 max-w-md border-t border-border pt-8 animate-fade-up" style={{ animationDelay: "600ms" }}>
              <div>
                <div className="text-3xl font-medium tracking-tight">
                  <AnimatedCounter to={7} />
                </div>
                <div className="text-mono text-muted-foreground mt-2">Départements</div>
              </div>
              <div>
                <div className="text-3xl font-medium tracking-tight">
                  <AnimatedCounter to={48} suffix="h" />
                </div>
                <div className="text-mono text-muted-foreground mt-2">Étude tech.</div>
              </div>
              <div>
                <div className="text-3xl font-medium tracking-tight flex items-center gap-1">
                  <AnimatedCounter to={10} />
                  <Star className="h-5 w-5 text-primary fill-primary" />
                </div>
                <div className="text-mono text-muted-foreground mt-2">Avis clients</div>
              </div>
            </div>
          </div>

          <div className="animate-fade-soft" style={{ animationDelay: "200ms" }}>
            <HeroSlider slides={heroSlides} />
          </div>
        </div>
      </section>

      {/* MARQUEE partenaires */}
      <section className="border-y border-border py-6 overflow-hidden bg-card/30">
        <div className="flex gap-12 animate-marquee whitespace-nowrap text-mono text-muted-foreground">
          {[...partenaires, ...partenaires].map((p, i) => (
            <span key={i} className="flex items-center gap-3">
              <span className="h-1 w-1 rounded-full bg-primary" /> {p}
            </span>
          ))}
        </div>
      </section>

      {/* SERVICES */}
      <section id="services" className="py-24 border-t border-border">
        <div
          ref={services_r.ref}
          className={`mx-auto max-w-7xl px-6 reveal-on-scroll ${services_r.shown ? "reveal-visible" : ""}`}
        >
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
            {services.map((s, idx) => (
              <div
                key={s.code}
                className="bg-card p-8 hover:bg-secondary/50 transition-all duration-300 group relative overflow-hidden"
                style={{ transitionDelay: `${idx * 30}ms` }}
              >
                <div className="absolute inset-x-0 top-0 h-px bg-primary scale-x-0 group-hover:scale-x-100 transition-transform origin-left duration-500" />
                <div className="flex justify-between items-start mb-10">
                  <span className="text-mono text-muted-foreground">{s.code}</span>
                  <s.icon className="h-5 w-5 text-primary group-hover:scale-125 group-hover:rotate-6 transition-transform duration-300" strokeWidth={1.5} />
                </div>
                <h3 className="text-xl font-medium tracking-tight group-hover:text-primary transition">{s.title}</h3>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RÉALISATIONS — diaporama */}
      <section id="realisations" className="py-24 border-t border-border bg-card/20">
        <div
          ref={real_r.ref}
          className={`mx-auto max-w-7xl px-6 reveal-on-scroll ${real_r.shown ? "reveal-visible" : ""}`}
        >
          <div className="flex items-end justify-between flex-wrap gap-6 mb-12">
            <div>
              <div className="flex items-center gap-3 text-mono text-primary mb-6">
                <span className="h-px w-10 bg-primary" /> Réalisations récentes
              </div>
              <h2 className="text-4xl md:text-5xl font-medium tracking-tight max-w-2xl">
                Chantiers livrés{" "}
                <span className="text-muted-foreground/60">dans le Grand Ouest.</span>
              </h2>
            </div>
            <p className="text-mono text-muted-foreground">défilement automatique · cliquez pour explorer</p>
          </div>
          <RealisationsSlider items={realisations} />
        </div>
      </section>

      {/* PARCOURS */}
      <section id="parcours" className="py-24 border-t border-border">
        <div
          ref={parcours_r.ref}
          className={`mx-auto max-w-7xl px-6 reveal-on-scroll ${parcours_r.shown ? "reveal-visible" : ""}`}
        >
          <div className="flex items-center gap-3 text-mono text-primary mb-6">
            <span className="h-px w-10 bg-primary" /> Parcours client
          </div>
          <h2 className="text-4xl md:text-5xl font-medium tracking-tight max-w-3xl">
            Devis clair,{" "}
            <span className="text-muted-foreground/60">chantier maîtrisé.</span>
          </h2>

          <ol className="mt-16 grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s, idx) => (
              <li
                key={s.n}
                className="relative p-6 border border-border rounded-sm bg-card/50 hover:border-primary hover:-translate-y-1 transition-all duration-300"
                style={{ transitionDelay: `${idx * 60}ms` }}
              >
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
        <div
          ref={zones_r.ref}
          className={`mx-auto max-w-7xl px-6 reveal-on-scroll ${zones_r.shown ? "reveal-visible" : ""}`}
        >
          <div className="grid lg:grid-cols-2 gap-12">
            <div>
              <div className="flex items-center gap-3 text-mono text-primary mb-6">
                <span className="h-px w-10 bg-primary" /> Zones d'intervention
              </div>
              <h2 className="text-4xl md:text-5xl font-medium tracking-tight">
                Le Grand Ouest,{" "}
                <span className="text-muted-foreground/60">notre terrain de jeu.</span>
              </h2>
              <p className="mt-6 text-muted-foreground max-w-md">
                Bretagne et Pays de la Loire en priorité — équipes locales, connaissance
                du terrain et du réseau électrique. Et partout ailleurs en France, on
                intervient aussi, avec un léger délai supplémentaire.
              </p>
            </div>
            <ul className="grid grid-cols-2 gap-3 self-end">
              {["44 · Loire-Atlantique", "49 · Maine-et-Loire", "85 · Vendée", "72 · Sarthe", "53 · Mayenne", "35 · Ille-et-Vilaine", "56 · Morbihan"].map((z, idx) => (
                <li
                  key={z}
                  className="text-mono flex items-center gap-3 border border-border p-4 rounded-sm bg-card/50 hover:border-primary hover:bg-card hover:translate-x-1 transition-all"
                  style={{ transitionDelay: `${idx * 40}ms` }}
                >
                  <Check className="h-3 w-3 text-primary" strokeWidth={3} /> {z}
                </li>
              ))}
            </ul>
          </div>

          {/* Sous-bloc : couverture France */}
          <div className="mt-10 grid md:grid-cols-3 gap-px bg-border border border-border rounded-sm overflow-hidden">
            <div className="bg-card p-6 flex items-start gap-4">
              <span className="hero-grad text-primary-foreground p-2 rounded-sm shrink-0">
                <MapPin className="h-4 w-4" />
              </span>
              <div>
                <div className="text-mono text-primary mb-1">Grand Ouest</div>
                <div className="font-medium">Intervention 24-48h</div>
                <p className="text-sm text-muted-foreground mt-1">Bretagne & Pays de la Loire, équipe locale.</p>
              </div>
            </div>
            <div className="bg-card p-6 flex items-start gap-4">
              <span className="hero-grad text-primary-foreground p-2 rounded-sm shrink-0">
                <Clock className="h-4 w-4" />
              </span>
              <div>
                <div className="text-mono text-primary mb-1">Reste de la France</div>
                <div className="font-medium">Intervention 48-72h</div>
                <p className="text-sm text-muted-foreground mt-1">Métropole entière, déplacement organisé sous 72h max.</p>
              </div>
            </div>
            <div className="bg-card p-6 flex items-start gap-4">
              <span className="hero-grad text-primary-foreground p-2 rounded-sm shrink-0">
                <Zap className="h-4 w-4" />
              </span>
              <div>
                <div className="text-mono text-primary mb-1">Urgence panne</div>
                <div className="font-medium">Intervention rapide</div>
                <p className="text-sm text-muted-foreground mt-1">Diagnostic à distance puis déplacement prioritaire sous contrat Confort / Pro.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MAINTENANCE / ABONNEMENTS */}
      <section id="maintenance" className="py-28 md:py-32 border-t border-border bg-secondary/40">
        <div className="mx-auto max-w-6xl px-6">
          {/* Header centré */}
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center gap-3 text-mono text-primary mb-6">
              <span className="h-px w-10 bg-primary" /> Garanties & entretien <span className="h-px w-10 bg-primary" />
            </div>
            <h2 className="text-4xl md:text-5xl font-medium tracking-tight">
              Vos garanties légales,{" "}
              <span className="text-muted-foreground/60">et la formule Sérénité pour la suite.</span>
            </h2>
            <p className="mt-6 text-muted-foreground text-lg leading-relaxed">
              Toute installation bénéficie des <strong className="text-foreground">garanties prévues par la loi</strong> et
              de celles du fabricant. Pour l'entretien dans le temps, choisissez la formule Sérénité qui vous convient.
            </p>
          </div>



          {/* Cadre légal des garanties */}
          <div className="mb-16">
            <div className="text-center mb-8">
              <h3 className="text-2xl md:text-3xl font-medium tracking-tight">
                Vos garanties, en clair
              </h3>
              <p className="mt-3 text-muted-foreground">
                Ce que la loi et le fabricant vous garantissent sur une borne de recharge.
              </p>
              <div className="mt-4 inline-flex items-center gap-2 border border-primary/30 bg-card rounded-sm px-4 py-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span className="text-mono text-primary">{COMPANY.qualifications}</span>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {GARANTIES.map((g) => (
                <div key={g.titre} className="border border-border bg-card rounded-sm p-6">
                  <div className="text-mono text-primary mb-2">{g.duree}</div>
                  <div className="font-semibold leading-snug mb-2">{g.titre}</div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{g.texte}</p>
                </div>
              ))}
            </div>
            <p className="mt-5 text-xs text-muted-foreground text-center max-w-3xl mx-auto">
              Information générale à jour de la réglementation française ; les garanties légales
              s'appliquent sans supplément et ne remplacent pas les conditions du fabricant.
            </p>
          </div>


          {/* Toggle audience */}
          <div className="flex flex-col items-center gap-3 mb-14">
            <span className="text-mono text-muted-foreground">Choisissez votre profil</span>
            <div className="inline-flex border border-border rounded-sm bg-card p-1">
              <button
                type="button"
                onClick={() => setAudience("client")}
                className={`text-mono px-5 py-2.5 rounded-sm transition ${
                  isClient ? "hero-grad text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Client Borne de l'Ouest
              </button>
              <button
                type="button"
                onClick={() => setAudience("external")}
                className={`text-mono px-5 py-2.5 rounded-sm transition ${
                  !isClient ? "hero-grad text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Borne installée ailleurs
              </button>
            </div>
          </div>

          {/* Cartes formules */}
          <div className="grid md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
            {maintenancePlans.map((p, idx) => {
              const raw = isClient ? p.client : p.external;
              const isQuote = raw === "Sur devis";
              return (
                <div
                  key={p.code}
                  className={`relative flex flex-col p-8 lg:p-10 rounded-sm border bg-card transition-all duration-300 hover:-translate-y-1 ${
                    p.featured
                      ? "border-primary shadow-xl shadow-primary/10 md:scale-[1.03]"
                      : "border-border hover:border-primary/60"
                  }`}
                  style={{ transitionDelay: `${idx * 60}ms` }}
                >
                  {p.featured && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 hero-grad text-primary-foreground text-mono px-4 py-1 rounded-sm whitespace-nowrap">
                      Le plus choisi
                    </div>
                  )}

                  {/* En-tête : code + icône */}
                  <div className="flex items-center justify-between">
                    <span className="text-mono text-muted-foreground">{p.code}</span>
                    <span className={`p-2 rounded-sm ${p.featured ? "hero-grad text-primary-foreground" : "bg-secondary text-primary"}`}>
                      <p.icon className="h-5 w-5" strokeWidth={1.75} />
                    </span>
                  </div>

                  {/* Nom + tagline */}
                  <h3 className="mt-8 text-2xl font-medium tracking-tight">{p.name}</h3>
                  <p className="mt-2 text-sm text-muted-foreground min-h-[2.5rem]">{p.desc}</p>

                  {/* Prix — bloc dédié */}
                  <div className="mt-8 pb-8 border-b border-border">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-5xl font-medium tracking-tight">
                        {isQuote ? "Sur" : raw}
                      </span>
                      {isQuote ? (
                        <span className="text-5xl font-medium tracking-tight text-muted-foreground/70">devis</span>
                      ) : (
                        <>
                          <span className="text-2xl text-muted-foreground">€</span>
                          <span className="text-mono text-muted-foreground ml-1">{p.period}</span>
                        </>
                      )}
                    </div>
                    <div className="text-mono text-muted-foreground mt-3">
                      {isClient ? "Tarif client Borne de l'Ouest" : "Borne installée par un tiers"}
                    </div>
                  </div>

                  {/* Features */}
                  <ul className="mt-8 space-y-4 flex-1">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-3 text-sm leading-relaxed">
                        <span className={`mt-0.5 p-0.5 rounded-full shrink-0 ${p.featured ? "bg-primary/15" : "bg-secondary"}`}>
                          <Check className="h-3.5 w-3.5 text-primary" strokeWidth={3} />
                        </span>
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <Link
                    to="/demande"
                    search={{ formule: p.slug }}
                    className={`mt-10 w-full text-mono px-4 py-3.5 rounded-sm inline-flex items-center justify-center gap-2 transition ${
                      p.featured
                        ? "hero-grad text-primary-foreground hover:opacity-90"
                        : "border border-border hover:border-primary hover:text-primary"
                    }`}
                  >
                    {isQuote ? "Demander un devis" : "Souscrire la formule"} <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              );
            })}
          </div>

          <p className="mt-12 text-xs text-muted-foreground text-center max-w-2xl mx-auto">
            Sérénité et Sérénité+ : tarifs forfaitaires annuels, sans engagement de durée. Pro / Flotte établi sur devis selon le parc. Pièces de remplacement facturées en sus.
          </p>
        </div>
      </section>


      {/* CTA */}
      <section className="py-24 border-t border-border relative overflow-hidden">
        <div className="absolute inset-0 hero-grad opacity-[0.03]" aria-hidden />
        <div className="mx-auto max-w-5xl px-6 text-center relative">
          <h2 className="text-4xl md:text-6xl font-medium tracking-tight">
            Prêt à recharger{" "}
            <span className="text-primary italic font-light">chez vous</span> ?
          </h2>
          <p className="mt-6 text-muted-foreground max-w-xl mx-auto">
            Envoyez-nous quelques photos et nous étudions la faisabilité sous 48h.
          </p>
          <Link to="/demande" className="mt-10 hero-grad text-primary-foreground text-mono px-6 py-4 rounded-sm inline-flex items-center gap-2 hover:opacity-90 hover:scale-[1.03] transition">
            Démarrer ma demande <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
