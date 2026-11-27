import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { submitDemande } from "@/lib/demande.functions";
import { lireOrigineLead } from "@/lib/lead-source";
import { suivreDemandeEnvoyee } from "@/lib/analytics";
import {
  estDansZone,
  resumeDemande,
  LIBELLES,
  type Delai,
  type Occupation,
} from "@/lib/questionnaire-borne";

const TITRE = "Votre maison est-elle prête pour une borne ? | Borne de l'Ouest";
const DESC =
  "Répondez à 3 questions simples et recevez votre devis gratuit pour une borne de recharge posée en 1 journée en Bretagne et Pays de la Loire.";

export const Route = createFileRoute("/ma-borne-maison")({
  head: () => ({
    links: [{ rel: "canonical", href: "https://irvetechnologie.fr/devis-borne-recharge" }],
    meta: [
      { title: TITRE },
      { name: "description", content: DESC },
      { name: "robots", content: "noindex, follow" },
      { property: "og:title", content: TITRE },
      { property: "og:description", content: DESC },
      { property: "og:url", content: "https://irvetechnologie.fr/ma-borne-maison" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Questionnaire,
});

/* ---------- Dessins (traits simples, couleur du thème) ---------- */
const S = { fill: "none", stroke: "currentColor", strokeWidth: 3, strokeLinecap: "round", strokeLinejoin: "round" } as const;

function Maison({ cle }: { cle: Occupation }) {
  return (
    <svg viewBox="0 0 120 70" className="h-16 w-full" aria-hidden="true">
      <path d="M20 62V32L48 10l28 22v30Z" {...S} className="text-primary" fill="currentColor" fillOpacity={0.12} />
      <path d="M42 62V46h12v16" {...S} />
      {cle === "proprietaire" && <path d="M88 30a8 8 0 1 1 0 .1M94 36l12 12M102 44l4-4" {...S} />}
      {cle === "locataire" && <path d="M84 24h22v28H84zM88 32h14M88 40h10" {...S} />}
    </svg>
  );
}

function Horloge({ d }: { d: Delai }) {
  const aiguille = d === "vite" ? "M60 35V20" : d === "1_3_mois" ? "M60 35l12 6" : "M60 35l-10 10";
  return (
    <svg viewBox="0 0 120 70" className="h-16 w-full" aria-hidden="true">
      <circle cx="60" cy="35" r="24" {...S} className="text-primary" fill="currentColor" fillOpacity={0.12} />
      <path d={aiguille} {...S} />
    </svg>
  );
}

/* ---------- Étapes ---------- */
type Etat = {
  occupation?: Occupation;
  delai?: Delai;
  cp: string;
};

const NB_ETAPES = 4;

function Questionnaire() {
  const submitFn = useServerFn(submitDemande);
  const mountedAt = useRef(Date.now());
  const [etape, setEtape] = useState(1);
  const [r, setR] = useState<Etat>({ cp: "" });
  const [envoi, setEnvoi] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  function choisir(patch: Partial<Etat>) {
    setR((p) => ({ ...p, ...patch }));
    setEtape((e) => Math.min(e + 1, NB_ETAPES));
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (envoi || !r.occupation || !r.delai) return;
    setErreur(null);
    setEnvoi(true);
    try {
      const fd = new FormData(e.currentTarget);
      const get = (k: string) => (fd.get(k)?.toString() ?? "").trim();
      const reponses = {
        occupation: r.occupation,
        delai: r.delai,
        code_postal: r.cp,
      };
      const origine = lireOrigineLead();
      const res = await submitFn({
        data: {
          nom: get("nom"),
          email: get("email"),
          telephone: get("tel"),
          code_postal: r.cp,
          distance_m: null,
          type_bien: "Maison",
          type_installation: null,
          notes: resumeDemande(reponses),
          type_demande: "raccordement",
          profil_client: "particulier",
          nb_bornes: 1,
          lead_source: origine?.source ?? null,
          lead_campagne: origine?.campagne ?? null,
          page_origine: origine?.page ?? "/ma-borne-maison",
          website: get("website") || null,
          elapsed_ms: Date.now() - mountedAt.current,
        },
      });
      setEnvoye(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (res?.id && res.id !== "honeypot" && res.id !== "timetrap") suivreDemandeEnvoyee("particulier", res.id);
    } catch (err) {
      console.error(err);
      setErreur(err instanceof Error ? err.message : "Une erreur est survenue. Réessayez.");
    } finally {
      setEnvoi(false);
    }
  }

  const horsZone = /^\d{5}$/.test(r.cp) && !estDansZone(r.cp);

  return (
    <div className="public-premium min-h-screen bg-background text-foreground">
      <SiteNav />
      <main className="pt-24 pb-16 sm:pt-28">
        <div className="mx-auto max-w-2xl px-4 sm:px-6">
          {envoye ? (
            <div className="py-16 text-center">
              <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Check className="h-7 w-7" strokeWidth={2.5} />
              </div>
              <h1 className="mt-8 text-3xl font-medium tracking-tight sm:text-4xl">C'est noté, merci !</h1>
              <p className="mt-4 text-muted-foreground leading-relaxed">
                Votre électricien vous rappelle rapidement pour préparer votre devis gratuit et sans engagement.
                Gardez sous la main une photo de votre tableau électrique.
              </p>
              <Link to="/bornes" className="mt-8 inline-flex items-center gap-2 text-primary underline">
                Voir nos bornes en attendant <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <>
              <p className="font-medium text-primary">Bretagne · Pays de la Loire</p>
              <h1 className="mt-2 text-3xl font-medium tracking-tight sm:text-4xl">Votre maison est-elle prête pour une borne ?</h1>
              <p className="mt-3 text-muted-foreground">3 questions, 20 secondes. Devis gratuit, borne posée en 1 journée.</p>

              <div className="mt-6 flex items-center gap-3" aria-label={`Étape ${etape} sur ${NB_ETAPES}`}>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(etape / NB_ETAPES) * 100}%` }} />
                </div>
                <span className="shrink-0 text-sm text-muted-foreground">{etape}/{NB_ETAPES}</span>
              </div>

              <section className="mt-6 rounded-xl border border-border bg-card p-5 shadow-sm sm:p-7">
                {etape === 1 && (
                  <Question titre="Vous êtes…">
                    {(["proprietaire", "locataire"] as const).map((k) => (
                      <Choix key={k} actif={r.occupation === k} onClick={() => choisir({ occupation: k })} label={`${LIBELLES.occupation[k]} de ma maison`}>
                        <Maison cle={k} />
                      </Choix>
                    ))}
                  </Question>
                )}
                {etape === 2 && (
                  <Question titre="Quand voulez-vous votre borne ?">
                    {(["vite", "1_3_mois", "renseigne"] as const).map((k) => (
                      <Choix key={k} actif={r.delai === k} onClick={() => choisir({ delai: k })} label={LIBELLES.delai[k]}>
                        <Horloge d={k} />
                      </Choix>
                    ))}
                  </Question>
                )}
                {etape === 3 && (
                  <div>
                    <h2 className="text-xl font-medium">Votre code postal</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Pour vérifier que nous intervenons chez vous.</p>
                    <input
                      value={r.cp}
                      onChange={(e) => setR((p) => ({ ...p, cp: e.target.value.replace(/\D/g, "").slice(0, 5) }))}
                      inputMode="numeric"
                      autoComplete="postal-code"
                      aria-label="Code postal"
                      placeholder="44000"
                      className="mt-4 w-full rounded-md border border-border bg-background px-4 py-3 text-2xl tracking-widest outline-hidden focus:border-primary focus:ring-2 focus:ring-primary/20"
                    />
                    {horsZone && (
                      <p className="mt-3 rounded-md border border-border bg-muted px-3 py-2 text-sm">
                        Nous intervenons en Bretagne et Pays de la Loire. Vous pouvez quand même envoyer votre demande, nous vous dirons si c'est possible.
                      </p>
                    )}
                    <button
                      type="button"
                      disabled={!/^\d{5}$/.test(r.cp)}
                      onClick={() => setEtape(4)}
                      className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-5 py-3.5 font-medium text-primary-foreground disabled:opacity-50"
                    >
                      Continuer <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
                {etape === 4 && (
                  <form onSubmit={onSubmit} aria-label="Vos coordonnées">
                    <h2 className="text-xl font-medium">Dernière étape : où vous envoyer votre devis ?</h2>
                    <p className="mt-1 text-sm text-muted-foreground">Un électricien vous rappelle, sans engagement.</p>
                    <div aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
                      <label>
                        Ne pas remplir
                        <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
                      </label>
                    </div>
                    <div className="mt-5 grid gap-4">
                      <Champ label="Nom et prénom" name="nom" autoComplete="name" />
                      <Champ label="Téléphone" name="tel" type="tel" autoComplete="tel" inputMode="tel" />
                      <Champ label="Email" name="email" type="email" autoComplete="email" />
                    </div>
                    {erreur && (
                      <p role="alert" className="mt-4 rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">{erreur}</p>
                    )}
                    <button
                      type="submit"
                      disabled={envoi}
                      className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-5 py-3.5 font-medium text-primary-foreground disabled:opacity-60"
                    >
                      {envoi ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      Recevoir mon devis gratuit
                    </button>
                    <p className="mt-3 text-xs text-muted-foreground">
                      Vos coordonnées servent uniquement à vous recontacter pour ce projet.{" "}
                      <Link to="/confidentialite" className="underline">Confidentialité</Link>
                    </p>
                  </form>
                )}

                {etape > 1 && (
                  <button type="button" onClick={() => setEtape((e) => e - 1)} className="mt-5 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                    <ArrowLeft className="h-4 w-4" /> Retour
                  </button>
                )}
              </section>
              <p className="mt-4 text-center text-xs text-muted-foreground">Électricien qualifié IRVE P1 · P2 · P3 · IRVE Technologie</p>
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

function Question({ titre, aide, children }: { titre: string; aide?: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="text-xl font-medium">{titre}</legend>
      {aide && <p className="mt-1 text-sm text-muted-foreground">{aide}</p>}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">{children}</div>
    </fieldset>
  );
}

function Choix({ actif, onClick, label, children }: { actif: boolean; onClick: () => void; label: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={actif}
      className={`flex min-w-0 flex-col items-center gap-2 rounded-xl border p-3 text-center text-sm transition ${
        actif ? "border-primary bg-primary/10 font-medium text-primary" : "border-border hover:border-primary/60"
      }`}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

function Champ({ label, name, type = "text", autoComplete, inputMode }: { label: string; name: string; type?: string; autoComplete?: string; inputMode?: "tel" | "numeric" | "email" | "text" }) {
  return (
    <label className="block">
      <span className="text-sm font-medium">{label}</span>
      <input
        name={name}
        type={type}
        required
        autoComplete={autoComplete}
        inputMode={inputMode}
        className="mt-1.5 w-full rounded-md border border-border bg-background px-3 py-2.5 text-base outline-hidden transition focus:border-primary focus:ring-2 focus:ring-primary/20"
      />
    </label>
  );
}
