import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState, type FormEvent } from "react";
import { ArrowRight, Phone, Zap, Wrench, HardHat, Activity, Check, ShieldCheck, Sparkles, Clock, MapPin, ChevronDown, BadgeCheck } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { RealisationsSlider } from "@/components/RealisationsSlider";
import { useReveal } from "@/hooks/use-reveal";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listPublicRealisations } from "@/lib/realisations.functions";
import { listPublicAvis, submitAvisClient } from "@/lib/demande.functions";
import borneHager from "@/assets/borne-hager.png";
import borneSchneider from "@/assets/borne-schneider.png";
import borneWallbox from "@/assets/borne-wallbox.png";
import borneTesla from "@/assets/borne-tesla.png";
import borneLegrand from "@/assets/borne-legrand.png";
import borneEvbox from "@/assets/borne-evbox.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Borne de l'Ouest — Installation bornes de recharge VE | Nantes & Grand Ouest élargi" },
      { name: "description", content: "Borne de l'Ouest intervient principalement dans le Grand Ouest et dans les régions voisines, jusqu'à environ 250 km autour de Nantes, avec étude au cas par cas selon la rentabilité du chantier." },
      { property: "og:title", content: "Borne de l'Ouest — Bornes de recharge VE autour de Nantes (Grand Ouest élargi)" },
      { property: "og:description", content: "Installation IRVE autour de Nantes : zone principale Grand Ouest + extension jusqu'à ~250 km selon distance, trajet et rentabilité du projet." },
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

const partenaires = [
  { nom: "Hager Witty", img: borneHager },
  { nom: "Schneider EVlink", img: borneSchneider },
  { nom: "Wallbox Pulsar", img: borneWallbox },
  { nom: "Tesla Wall Connector", img: borneTesla },
  { nom: "Legrand Green'up", img: borneLegrand },
  { nom: "EVBox", img: borneEvbox },
];

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
  const realisations = (realisationsQuery.data ?? []).map((r) => ({
    src: r.url,
    title: r.titre,
    place: r.lieu,
    spec: r.description,
  }));
  const zones_r = useReveal<HTMLDivElement>();
  const [audience, setAudience] = useState<"client" | "external">("client");
  const [avisSent, setAvisSent] = useState(false);
  const [avisBusy, setAvisBusy] = useState(false);
  const [avisError, setAvisError] = useState<string | null>(null);
  const [homeCompact, setHomeCompact] = useState(true);
  const [aideProfil, setAideProfil] = useState<"maison" | "copro-individuelle" | "copro-partagee" | "pro">("maison");
  const PRIX_DEMARRAGE_TTC = 1290;
  const PRIX_DEMARRAGE_HT = Math.round((PRIX_DEMARRAGE_TTC / 1.2) * 100) / 100;
  const [aideBornes, setAideBornes] = useState(0);
  const [aideMontantHt, setAideMontantHt] = useState(PRIX_DEMARRAGE_HT);
  const avisMountedAt = useRef<number>(Date.now());
  const envoyerAvis = useServerFn(submitAvisClient);
  const fetchAvis = useServerFn(listPublicAvis);
  const avisQuery = useQuery({
    queryKey: ["avis-publics"],
    queryFn: () => fetchAvis(),
    staleTime: 60_000,
  });
  const isClient = audience === "client";
  const baseHt = Math.max(0, aideMontantHt);
  const nbBornes = Math.max(0, aideBornes);
  const aideTotale =
    aideProfil === "copro-individuelle"
      ? Math.min(baseHt * 0.5, 1000) * nbBornes
      : aideProfil === "copro-partagee"
        ? Math.min(baseHt * 0.5, 1660) * nbBornes
        : 0;

  async function onSubmitAvis(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (avisBusy) return;
    setAvisError(null);
    setAvisBusy(true);
    try {
      const form = e.currentTarget;
      const fd = new FormData(form);
      const note = Number(fd.get("note") ?? "5");
      await envoyerAvis({
        data: {
          nom: String(fd.get("nom") ?? "").trim(),
          email: String(fd.get("email") ?? "").trim(),
          telephone: String(fd.get("telephone") ?? "").trim(),
          code_postal: String(fd.get("code_postal") ?? "").trim(),
          partenaire: String(fd.get("partenaire") ?? "").trim() || null,
          intervention: String(fd.get("intervention") ?? "").trim() || null,
          note: Number.isFinite(note) ? note : 5,
          avis: String(fd.get("avis") ?? "").trim(),
          website: String(fd.get("website") ?? "").trim() || null,
          elapsed_ms: Date.now() - avisMountedAt.current,
        },
      });
      setAvisSent(true);
      form.reset();
      void avisQuery.refetch();
    } catch (err) {
      setAvisError(err instanceof Error ? err.message : "Envoi de l'avis impossible.");
    } finally {
      setAvisBusy(false);
    }
  }

  return (
    <div className="public-premium min-h-screen overflow-x-hidden bg-background text-foreground">
      <SiteNav />

      {/* HERO */}
      <section className="premium-hero relative min-h-[92svh] overflow-hidden pt-16">
        <div className="premium-hero-atmosphere absolute inset-0" aria-hidden />
        <div className="absolute inset-0 premium-hero-veil" aria-hidden />
        <div className="absolute inset-0 premium-tech-grid opacity-30" aria-hidden />
        <div className="relative mx-auto grid min-h-[calc(92svh-4rem)] max-w-7xl items-center gap-12 px-6 py-16 lg:grid-cols-12 lg:py-20">
          <div className="animate-fade-up lg:col-span-7">
            <div className="inline-flex items-center gap-2 border border-premium-blue/50 bg-premium-night/65 px-3 py-2 text-xs font-semibold uppercase text-premium-blue backdrop-blur-md">
              <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-premium-blue opacity-70" /><span className="relative inline-flex h-2 w-2 rounded-full bg-premium-blue" /></span>
              Expertise IRVE certifiée P1 · P2 · P3
            </div>
            <h1 className="mt-7 font-display text-2xl font-bold leading-tight sm:text-3xl lg:text-4xl">
              Installation de bornes de recharge
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-current opacity-70 sm:text-lg">
              Étude, pose, mise en service et maintenance pour particuliers, copropriétés et professionnels dans le Grand Ouest.
            </p>
            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Link to="/demande" className="premium-primary-cta inline-flex min-h-14 items-center justify-center gap-3 px-7 text-base font-bold uppercase">
                Demander un devis <ArrowRight className="h-5 w-5" />
              </Link>
              <a href="tel:+33768084367" className="premium-secondary-cta inline-flex min-h-14 items-center justify-center gap-3 px-7 text-base font-bold uppercase">
                <Phone className="h-5 w-5" /> 07 68 08 43 67
              </a>
            </div>
            <div className="mt-10 grid max-w-2xl grid-cols-1 gap-px border-y border-premium-foreground/20 bg-premium-foreground/20 sm:grid-cols-3">
              {["Étude technique", "Pose & raccordement", "Maintenance suivie"].map((label) => (
                <div key={label} className="flex items-center gap-3 bg-premium-night/90 px-4 py-4 text-sm font-semibold text-premium-foreground backdrop-blur-md">
                  <BadgeCheck className="h-5 w-5 shrink-0 text-premium-blue" /> {label}
                </div>
              ))}
            </div>
          </div>
          <div className="relative hidden lg:col-span-5 lg:block animate-fade-soft">
            <div className="premium-photo-frame relative ml-auto aspect-[4/5] w-full max-w-md border border-premium-blue/50">
              {realisations[0]?.src ? (
                <img src={realisations[0].src} alt={realisations[0].title || "Réalisation de recharge électrique par Borne de l'Ouest"} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full bg-[linear-gradient(165deg,#0f1c34_0%,#16284a_58%,#0d1528_100%)]" />
              )}
              <div className="absolute right-5 top-5 border border-premium-blue/60 bg-premium-night/85 p-4 backdrop-blur-md">
                <p className="text-xs font-semibold uppercase text-premium-blue">Installation maîtrisée</p>
                <p className="mt-1 font-display text-2xl font-bold text-premium-foreground">7 · 11 · 22 kW</p>
              </div>
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-premium-night p-6 pt-20">
                <p className="text-xs uppercase text-premium-foreground/60">IRVE Technologie</p>
                <p className="mt-1 text-lg font-semibold text-premium-foreground">Une installation nette, conforme et documentée.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* MARQUEE partenaires */}
      <section className="border-y border-border py-8 overflow-hidden bg-white/[0.03]">
        <div className="flex gap-10 animate-marquee">
          {[...partenaires, ...partenaires].map((p, i) => (
            <div key={i} className="flex shrink-0 flex-col items-center gap-3">
              <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-border bg-premium-night/60 p-2">
                <img src={p.img} alt={`Borne ${p.nom}`} loading="lazy" width={96} height={96} className="h-full w-full object-contain" />
              </div>
              <span className="text-mono text-xs text-muted-foreground">{p.nom}</span>
            </div>
          ))}
        </div>
      </section>

      {/* MAINTENANCE / ABONNEMENTS */}
      <section id="maintenance" className="py-16 sm:py-20 md:py-24 border-t border-border bg-white/[0.02]">
        <div className="mx-auto max-w-6xl px-6">
          {/* Header centré */}
          <div className="text-center max-w-3xl mx-auto mb-10">
            <div className="inline-flex items-center gap-3 text-mono text-primary mb-6">
              <span className="h-px w-10 bg-primary" /> Aides & entretien <span className="h-px w-10 bg-primary" />
            </div>
            <h2 className="text-4xl md:text-5xl font-medium tracking-tight">
              Prime Advenir & crédit d&apos;impôt,{" "}
              <span className="text-muted-foreground/60">puis formule Sérénité.</span>
            </h2>
            <p className="mt-5 text-muted-foreground text-base leading-relaxed">
              Nous vous aidons à estimer les aides mobilisables selon votre profil
              et le nombre de bornes, puis à choisir la bonne formule d&apos;entretien.
            </p>
          </div>

          <div className={`rounded-2xl border border-border bg-card/70 p-4 sm:p-6 ${homeCompact ? "mb-8" : "mb-12"}`}>
            <p className="text-mono text-primary">Simulateur rapide d&apos;aides (indicatif)</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-4">
              <button
                type="button"
                onClick={() => setAideProfil("maison")}
                className={`rounded-lg border px-3 py-2 text-sm ${aideProfil === "maison" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary"}`}
              >
                Maison individuelle
              </button>
              <button
                type="button"
                onClick={() => setAideProfil("copro-individuelle")}
                className={`rounded-lg border px-3 py-2 text-sm ${aideProfil === "copro-individuelle" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary"}`}
              >
                Copro · borne individuelle
              </button>
              <button
                type="button"
                onClick={() => setAideProfil("copro-partagee")}
                className={`rounded-lg border px-3 py-2 text-sm ${aideProfil === "copro-partagee" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary"}`}
              >
                Copro · borne partagée
              </button>
              <button
                type="button"
                onClick={() => setAideProfil("pro")}
                className={`rounded-lg border px-3 py-2 text-sm ${aideProfil === "pro" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary"}`}
              >
                Pro / flotte
              </button>
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <label className="text-sm text-muted-foreground">Nombre de bornes</label>
              <input
                type="number"
                min={0}
                value={aideBornes}
                onChange={(e) => setAideBornes(Math.max(0, Number(e.target.value) || 0))}
                className="w-20 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              />
              <label className="text-sm text-muted-foreground">Coût HT / borne</label>
              <input
                type="number"
                min={0}
                step={50}
                value={aideMontantHt}
                onChange={(e) => setAideMontantHt(Math.max(0, Number(e.target.value) || 0))}
                className="w-28 rounded-md border border-border bg-background px-2 py-1.5 text-sm"
              />
            </div>
            {aideProfil === "maison" ? (
              <>
                <p className="mt-3 text-sm text-muted-foreground">
                  En 2026, le crédit d&apos;impôt borne est supprimé pour les dépenses payées en 2026
                  (source : Service-Public). Pour une facture payée en 2025, le crédit était de 75% plafonné à 500 € par système pilotable.
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Aides restantes : TVA réduite (si éligible) + aides locales selon votre commune.
                </p>
              </>
            ) : aideProfil === "pro" ? (
              <>
                <p className="mt-3 text-sm text-muted-foreground">
                  Les barèmes professionnels Advenir dépendent du type de parking, de l&apos;usage et du dossier CEE.
                </p>
                <p className="mt-1 text-sm font-semibold">Estimation : étude personnalisée obligatoire.</p>
              </>
            ) : (
              <>
                <p className="mt-3 text-sm text-muted-foreground">
                  Estimation Advenir : 50% du coût HT, plafonné à{" "}
                  {aideProfil === "copro-individuelle" ? "1 000 € HT" : "1 660 € HT"} par point de charge.
                </p>
                <p className="mt-1 text-sm font-semibold">
                  Aide estimée totale : {new Intl.NumberFormat("fr-FR").format(Math.round(aideTotale))} € HT
                </p>
              </>
            )}
            <p className="mt-2 text-xs text-muted-foreground">
              Base de calcul par défaut : 1 290 € TTC (≈ {new Intl.NumberFormat("fr-FR").format(PRIX_DEMARRAGE_HT)} € HT) par borne. Montants donnés à titre indicatif ; validation finale selon dossier, devis signé et règles en vigueur.
            </p>
          </div>


          {/* Toggle audience */}
          <div className={`flex flex-col items-center gap-3 ${homeCompact ? "mb-8" : "mb-14"}`}>
            <span className="text-mono text-muted-foreground">Choisissez votre profil</span>
            <div className="inline-flex border border-border rounded-sm bg-card p-1">
              <button
                type="button"
                onClick={() => setAudience("client")}
                className={`text-mono px-5 py-2.5 rounded-sm transition ${
                  isClient ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-primary"
                }`}
              >
                Client Borne de l'Ouest
              </button>
              <button
                type="button"
                onClick={() => setAudience("external")}
                className={`text-mono px-5 py-2.5 rounded-sm transition ${
                  !isClient ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-primary"
                }`}
              >
                Borne installée ailleurs
              </button>
            </div>
          </div>

          {/* Cartes formules */}
          <div className="grid md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
            {(homeCompact ? maintenancePlans.slice(0, 2) : maintenancePlans).map((p, idx) => {
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
                    {(homeCompact ? p.features.slice(0, 3) : p.features).map((f) => (
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

          <p className={`text-xs text-muted-foreground text-center max-w-2xl mx-auto ${homeCompact ? "mt-7" : "mt-12"}`}>
            Sérénité et Sérénité+ : tarifs forfaitaires annuels, sans engagement de durée. Pro / Flotte établi sur devis selon le parc. Pièces de remplacement facturées en sus.
          </p>
        </div>
      </section>


      {!homeCompact && (
      <>
      {/* SERVICES */}
      <section id="services" className="py-16 sm:py-20 border-t border-border">
        <div
          ref={services_r.ref}
          className="mx-auto max-w-7xl px-6 reveal-on-scroll reveal-visible"
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
      </>
      )}

      <section className="border-t border-border bg-white/[0.03] py-5">
        <div className="mx-auto max-w-7xl px-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Mode compact actif pour raccourcir la page d&apos;accueil.
          </p>
          <button
            type="button"
            onClick={() => setHomeCompact((v) => !v)}
            className="text-mono text-xs px-4 py-2 rounded-full border border-border bg-background hover:border-primary hover:text-primary transition"
          >
            {homeCompact ? "Afficher toutes les sections" : "Revenir au mode compact"}
          </button>
        </div>
      </section>

      {!homeCompact && (
      <>
      {/* AVIS */}
      <section id="avis" className="py-16 sm:py-20 border-t border-border">
        <div className="mx-auto max-w-7xl px-6 grid gap-10 lg:grid-cols-2">
          <div>
            <div className="flex items-center gap-3 text-mono text-primary mb-6">
              <span className="h-px w-10 bg-primary" /> Avis clients & partenaires
            </div>
            <h2 className="text-4xl md:text-5xl font-medium tracking-tight">
              Vos retours terrain,{" "}
              <span className="text-muted-foreground/60">directement depuis l&apos;écran.</span>
            </h2>
            <p className="mt-5 text-muted-foreground max-w-xl">
              Après une intervention, le client peut laisser un avis ici. Nous pouvons ainsi valoriser le
              travail réalisé, y compris pour des chantiers effectués au nom d&apos;un partenaire.
            </p>
            <div className="mt-7 space-y-3">
              {(avisQuery.data ?? []).slice(0, 4).map((a) => (
                <article key={a.id} className="rounded-sm border border-border bg-card/50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{a.nom}</p>
                    <span className="text-mono text-xs text-primary">
                      {"★".repeat(a.note)}
                      {"☆".repeat(Math.max(0, 5 - a.note))}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{a.avis}</p>
                  <p className="mt-2 text-[11px] text-muted-foreground">
                    {a.partenaire ? `Intervention via partenaire ${a.partenaire}` : "Intervention directe"} ·{" "}
                    {a.code_postal}
                  </p>
                </article>
              ))}
              {avisQuery.isLoading && <p className="text-sm text-muted-foreground">Chargement des avis…</p>}
            </div>
          </div>

          <div className="rounded-sm border border-border bg-card p-6">
            <p className="text-mono text-primary">Laisser un avis</p>
            <form className="mt-4 space-y-4" onSubmit={onSubmitAvis}>
              <input
                name="website"
                tabIndex={-1}
                autoComplete="off"
                defaultValue=""
                className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden"
                aria-hidden="true"
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm">
                  Nom complet
                  <input name="nom" required className="mt-1 w-full bg-input border border-border rounded-sm px-3 py-2.5" />
                </label>
                <label className="text-sm">
                  Email
                  <input name="email" type="email" required className="mt-1 w-full bg-input border border-border rounded-sm px-3 py-2.5" />
                </label>
                <label className="text-sm">
                  Téléphone
                  <input name="telephone" required className="mt-1 w-full bg-input border border-border rounded-sm px-3 py-2.5" />
                </label>
                <label className="text-sm">
                  Code postal
                  <input name="code_postal" required className="mt-1 w-full bg-input border border-border rounded-sm px-3 py-2.5" />
                </label>
              </div>
              <label className="text-sm block">
                Société partenaire (optionnel)
                <input
                  name="partenaire"
                  placeholder="Ex: concession partenaire"
                  className="mt-1 w-full bg-input border border-border rounded-sm px-3 py-2.5"
                />
              </label>
              <label className="text-sm block">
                Type d&apos;intervention
                <input
                  name="intervention"
                  placeholder="Ex: borne 7,4 kW en maison"
                  className="mt-1 w-full bg-input border border-border rounded-sm px-3 py-2.5"
                />
              </label>
              <label className="text-sm block">
                Note
                <select name="note" defaultValue="5" className="mt-1 w-full bg-input border border-border rounded-sm px-3 py-2.5">
                  <option value="5">5 / 5 — Excellent</option>
                  <option value="4">4 / 5 — Très bien</option>
                  <option value="3">3 / 5 — Bien</option>
                  <option value="2">2 / 5 — Correct</option>
                  <option value="1">1 / 5 — À améliorer</option>
                </select>
              </label>
              <label className="text-sm block">
                Avis
                <textarea
                  name="avis"
                  required
                  minLength={10}
                  rows={4}
                  placeholder="Décrivez votre retour d'expérience"
                  className="mt-1 w-full bg-input border border-border rounded-sm px-3 py-2.5"
                />
              </label>
              {avisError && <p className="text-sm text-destructive">{avisError}</p>}
              {avisSent && <p className="text-sm text-primary">Merci, votre avis a bien été envoyé.</p>}
              <button
                type="submit"
                disabled={avisBusy}
                className="hero-grad text-primary-foreground text-mono px-5 py-3 rounded-sm inline-flex items-center gap-2 disabled:opacity-60"
              >
                {avisBusy ? "Envoi…" : "Envoyer l'avis"} <ArrowRight className="h-4 w-4" />
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* PARCOURS */}
      <section id="parcours" className="py-16 sm:py-20 border-t border-border">
        <div
          ref={parcours_r.ref}
          className="mx-auto max-w-7xl px-6 reveal-on-scroll reveal-visible"
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
      <section id="zones" className="py-16 sm:py-20 border-t border-border">
        <div
          ref={zones_r.ref}
          className="mx-auto max-w-7xl px-6 reveal-on-scroll reveal-visible"
        >
          <div className="grid lg:grid-cols-2 gap-12">
            <div>
              <div className="flex items-center gap-3 text-mono text-primary mb-6">
                <span className="h-px w-10 bg-primary" /> Zones d'intervention
              </div>
              <h2 className="text-4xl md:text-5xl font-medium tracking-tight">
                Nantes au centre,{" "}
                <span className="text-muted-foreground/60">Grand Ouest élargi.</span>
              </h2>
              <p className="mt-6 text-muted-foreground max-w-lg">
                Borne de l&apos;Ouest intervient principalement dans le Grand Ouest et étend ses
                interventions dans les régions voisines, jusqu&apos;à environ 250 km autour de Nantes.
                Pour les projets professionnels, copropriétés et installations multi-bornes, nous
                pouvons également étudier des interventions au-delà selon la nature et la
                rentabilité du chantier.
              </p>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 self-end">
              {[
                "44 · Loire-Atlantique",
                "49 · Maine-et-Loire",
                "85 · Vendée",
                "53 · Mayenne",
                "72 · Sarthe",
                "35 · Ille-et-Vilaine",
                "56 · Morbihan",
                "22 · Côtes-d'Armor",
                "29 · Finistère",
                "79 · Deux-Sèvres",
                "86 · Vienne",
                "16 · Charente",
                "17 · Charente-Maritime",
                "37 · Indre-et-Loire",
                "41 · Loir-et-Cher",
                "61 · Orne",
                "14 · Calvados",
                "18 · Cher",
              ].map((z, idx) => (
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
                <div className="text-mono text-primary mb-1">Zone principale</div>
                <div className="font-medium">Grand Ouest élargi</div>
                <p className="text-sm text-muted-foreground mt-1">
                  Départements prioritaires + régions voisines autour de Nantes.
                </p>
              </div>
            </div>
            <div className="bg-card p-6 flex items-start gap-4">
              <span className="hero-grad text-primary-foreground p-2 rounded-sm shrink-0">
                <Clock className="h-4 w-4" />
              </span>
              <div>
                <div className="text-mono text-primary mb-1">Zone élargie</div>
                <div className="font-medium">Jusqu&apos;à ~250 km autour de Nantes</div>
                <p className="text-sm text-muted-foreground mt-1">
                  Distance et temps de trajet étudiés selon le type de chantier.
                </p>
              </div>
            </div>
            <div className="bg-card p-6 flex items-start gap-4">
              <span className="hero-grad text-primary-foreground p-2 rounded-sm shrink-0">
                <Zap className="h-4 w-4" />
              </span>
              <div>
                <div className="text-mono text-primary mb-1">Règle commerciale</div>
                <div className="font-medium">Décision à la rentabilité globale</div>
                <p className="text-sm text-muted-foreground mt-1">
                  Montant, nombre de bornes, frais, regroupement d&apos;interventions et rentabilité du déplacement.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
      </>
      )}


      {/* CTA */}
      <section className="py-16 sm:py-20 border-t border-border relative overflow-hidden bg-white/[0.02]">
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
          <a href="#realisations" className="mt-6 inline-flex items-center gap-2 text-mono text-xs text-primary hover:opacity-80">
            Voir nos réalisations
            <ChevronDown className="h-4 w-4 animate-arrow-blink" />
          </a>
        </div>
      </section>

      {/* RÉALISATIONS — diaporama */}
      <section id="realisations" className="py-16 sm:py-20 border-t border-border bg-white/[0.02]">
        <div
          ref={real_r.ref}
          className="mx-auto max-w-7xl px-6 reveal-on-scroll reveal-visible"
        >
          <div className="flex items-end justify-between flex-wrap gap-6 mb-12">
            <div>
              <div className="flex items-center gap-3 text-mono text-primary mb-6">
                <span className="h-px w-10 bg-primary" /> Réalisations récentes
              </div>
              <h2 className="text-4xl md:text-5xl font-medium tracking-tight max-w-2xl">
                Nos installations{" "}
                <span className="text-muted-foreground/60">réalisées.</span>
              </h2>
            </div>
          </div>
          <RealisationsSlider items={realisations} />
        </div>
      </section>


      <SiteFooter />
    </div>
  );
}
