import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState, type FormEvent } from "react";
import { ArrowRight, Check, CheckCircle2, Loader2, ShieldCheck, Clock, FileText } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { submitDemande } from "@/lib/demande.functions";
import { getTarifsSitePublic, TARIFS_SITE_DEFAUT } from "@/lib/tarifs-site.functions";
import { lireOrigineLead } from "@/lib/lead-source";
import { suivreDemandeEnvoyee } from "@/lib/analytics";
import heroAccueil from "@/assets/hero-accueil.jpg";

const URL_PAGE = "https://irvetechnologie.fr/devis-borne-recharge";
const TITRE = "Devis borne de recharge gratuit en Bretagne et Pays de la Loire | Borne de l'Ouest";
const DESC =
  "Borne de recharge posée en 1 journée par un installateur qualifié IRVE. Devis gratuit et sans engagement en Bretagne et Pays de la Loire. Demande en 1 minute.";

/** Distances proposées (mètres entre le tableau électrique et la borne). */
const DISTANCES = [
  { v: 5, label: "Moins de 5 m" },
  { v: 10, label: "5 à 10 m" },
  { v: 15, label: "10 à 15 m" },
  { v: 20, label: "15 à 20 m" },
  { v: null, label: "Plus de 20 m" },
] as const;

export const Route = createFileRoute("/devis-borne-recharge")({
  loader: async () => {
    try {
      return await getTarifsSitePublic();
    } catch {
      return TARIFS_SITE_DEFAUT;
    }
  },
  head: () => ({
    links: [{ rel: "canonical", href: URL_PAGE }],
    meta: [
      { title: TITRE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITRE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: URL_PAGE },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PageDevisExpress,
});

const ETAPES = [
  ["Vous envoyez votre demande", "5 informations, moins d'une minute."],
  ["Nous vous rappelons", "Un échange rapide puis votre devis gratuit et sans engagement."],
  ["Votre borne est posée", "En 1 journée, par un électricien qualifié IRVE."],
] as const;

function PageDevisExpress() {
  const tarifs = Route.useLoaderData();
  const submitDemandeFn = useServerFn(submitDemande);
  const mountedAt = useRef(Date.now());
  const [distance, setDistance] = useState<number | null | undefined>(undefined);
  const [envoi, setEnvoi] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const prix = `${tarifs.installation_ttc.toLocaleString("fr-FR")} €`;

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (envoi) return;
    if (distance === undefined) {
      setErreur("Indiquez la distance approximative entre votre tableau électrique et la borne.");
      return;
    }
    setErreur(null);
    setEnvoi(true);
    try {
      const fd = new FormData(e.currentTarget);
      const get = (k: string) => (fd.get(k)?.toString() ?? "").trim();
      const origine = lireOrigineLead();
      const libelleDistance = DISTANCES.find((d) => d.v === distance)?.label ?? "";
      const res = await submitDemandeFn({
        data: {
          nom: get("nom"),
          email: get("email"),
          telephone: get("tel"),
          code_postal: get("cp"),
          distance_m: distance,
          notes: `Demande express (page devis rapide) · distance tableau–borne : ${libelleDistance}`,
          type_demande: "raccordement",
          profil_client: "particulier",
          nb_bornes: 1,
          lead_source: origine?.source ?? null,
          lead_campagne: origine?.campagne ?? null,
          page_origine: origine?.page ?? "/devis-borne-recharge",
          website: get("website") || null,
          elapsed_ms: Date.now() - mountedAt.current,
        },
      });
      setEnvoye(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (res?.id && res.id !== "honeypot" && res.id !== "timetrap") {
        suivreDemandeEnvoyee("particulier", res.id);
      }
    } catch (err) {
      console.error(err);
      setErreur(err instanceof Error ? err.message : "Une erreur est survenue. Réessayez.");
    } finally {
      setEnvoi(false);
    }
  }

  if (envoye) {
    return (
      <div className="public-premium min-h-screen bg-background text-foreground">
        <SiteNav />
        <main className="pt-40 pb-24">
          <div className="mx-auto max-w-xl px-6 text-center">
            <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
              <Check className="h-7 w-7" strokeWidth={2.5} />
            </div>
            <h1 className="mt-8 text-4xl font-medium tracking-tight">Demande reçue, merci !</h1>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Nous vous rappelons rapidement pour préparer votre devis gratuit. Pour aller plus vite,
              vous pouvez nous envoyer des photos de votre tableau électrique lors de l&apos;appel.
            </p>
            <Link to="/bornes" className="mt-8 inline-flex items-center gap-2 text-primary underline">
              Voir nos bornes en attendant <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="public-premium min-h-screen bg-background text-foreground">
      <SiteNav />
      <main className="pt-24 sm:pt-28">
        <section className="border-b border-border">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[1.05fr_1fr] lg:items-start">
            <div className="min-w-0">
              <p className="font-medium text-primary">Bretagne · Pays de la Loire</p>
              <h1 className="mt-3 text-3xl font-medium tracking-tight sm:text-5xl">
                Votre borne de recharge posée en 1 journée
              </h1>
              <p className="mt-5 text-2xl font-semibold text-primary sm:text-3xl">
                dès {prix} <span className="text-base font-normal text-muted-foreground">TTC posée</span>
              </p>
              <ul className="mt-6 space-y-3 text-muted-foreground">
                {[
                  "Devis gratuit et sans engagement",
                  "Électricien qualifié IRVE P1 · P2 · P3",
                  "Crédit d'impôt possible pour les particuliers (sous conditions)",
                ].map((p) => (
                  <li key={p} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                    {p}
                  </li>
                ))}
              </ul>
              <img
                src={heroAccueil}
                alt="Borne de recharge installée par Borne de l'Ouest"
                className="mt-8 hidden aspect-[16/10] w-full rounded-xl border border-border object-cover lg:block"
                loading="eager"
              />
            </div>

            <form
              onSubmit={onSubmit}
              className="min-w-0 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-7"
              aria-label="Demande de devis rapide"
            >
              <h2 className="text-xl font-medium">Recevez votre devis gratuit</h2>
              <p className="mt-1 text-sm text-muted-foreground">Moins d&apos;une minute · nous vous rappelons.</p>

              <div aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
                <label>
                  Ne pas remplir
                  <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
                </label>
              </div>

              <div className="mt-6 grid gap-4">
                <Champ label="Nom et prénom" name="nom" autoComplete="name" />
                <Champ label="Téléphone" name="tel" type="tel" autoComplete="tel" inputMode="tel" />
                <Champ label="Email" name="email" type="email" autoComplete="email" />
                <Champ label="Code postal" name="cp" autoComplete="postal-code" inputMode="numeric" />
                <fieldset>
                  <legend className="text-sm font-medium">Distance entre votre tableau électrique et la borne</legend>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {DISTANCES.map((d) => (
                      <button
                        key={d.label}
                        type="button"
                        onClick={() => setDistance(d.v)}
                        aria-pressed={distance === d.v}
                        className={`rounded-md border px-3 py-2.5 text-sm transition ${
                          distance === d.v
                            ? "border-primary bg-primary/10 font-medium text-primary"
                            : "border-border hover:border-primary/60"
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">Une estimation suffit, nous vérifions ensemble.</p>
                </fieldset>
              </div>

              {erreur && (
                <p role="alert" className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {erreur}
                </p>
              )}

              <button
                type="submit"
                disabled={envoi}
                className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-5 py-3.5 font-medium text-primary-foreground transition hover:opacity-90 disabled:opacity-60"
              >
                {envoi ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Recevoir mon devis gratuit
                {!envoi ? <ArrowRight className="h-4 w-4" /> : null}
              </button>
              <p className="mt-3 text-xs text-muted-foreground">
                Vos coordonnées servent uniquement à vous recontacter pour ce projet.{" "}
                <Link to="/confidentialite" className="underline">Confidentialité</Link>
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                Professionnel, copropriété ou plusieurs bornes ?{" "}
                <Link to="/demande" className="text-primary underline">Demande détaillée</Link>
              </p>
            </form>
          </div>
        </section>

        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 className="text-2xl font-medium sm:text-3xl">Comment ça se passe</h2>
            <ol className="mt-8 grid gap-4 md:grid-cols-3">
              {ETAPES.map(([titre, texte], i) => {
                const Icone = [FileText, Clock, ShieldCheck][i]!;
                return (
                  <li key={titre} className="rounded-xl border border-border bg-card p-6">
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary">
                        {i + 1}
                      </span>
                      <Icone className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="mt-4 font-medium">{titre}</h3>
                    <p className="mt-2 text-sm text-muted-foreground">{texte}</p>
                  </li>
                );
              })}
            </ol>
            <p className="mt-6 text-sm text-muted-foreground">
              Le prix final dépend de la borne choisie et de la distance du câble. Il est indiqué clairement
              sur le devis, avant toute intervention.
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function Champ({
  label,
  name,
  type = "text",
  autoComplete,
  inputMode,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  inputMode?: "tel" | "numeric" | "email" | "text";
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        name={name}
        type={type}
        required
        autoComplete={autoComplete}
        inputMode={inputMode}
        className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2.5 text-base outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
    </label>
  );
}
