import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, ArrowRight, Building2, Car, Factory, Home, Info, Zap, HelpCircle } from "lucide-react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteNav } from "@/components/SiteNav";
import {
  DIFFERENTIEL, DISTANCES, KVA_OPTIONS, REGLES_BORNES, dimensionner, kvaInsuffisant, type Phase,
} from "@/lib/calculateur-irve";

const TITLE = "Calculateur de pré-dimensionnement IRVE | Borne de l'Ouest";
const DESC = "Estimez rapidement la puissance, le câble et les protections nécessaires pour votre projet de borne de recharge.";

export const Route = createFileRoute("/calculateur-irve")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESC },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESC },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Calculateur,
});

const PROJETS = [
  { v: "Maison individuelle", icon: Home },
  { v: "Copropriété", icon: Building2 },
  { v: "Entreprise", icon: Factory },
  { v: "Parking / flotte de véhicules", icon: Car },
  { v: "Autre", icon: HelpCircle },
];
const POSES = ["En apparent", "Sous goulotte", "Sous tube", "Sur chemin de câble", "Enterré", "Tranchée avec protection adaptée", "Je ne sais pas"];
const STEPS = ["Projet", "Borne", "Alimentation", "Distance", "Pose", "Gestion", "Résultat"];

function Choice({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`w-full min-h-16 rounded-lg border px-4 py-3 text-left text-sm font-semibold leading-tight transition flex items-center gap-3 ${active ? "border-primary bg-primary/15 text-foreground" : "border-border bg-card hover:border-primary/60"}`}>
      {children}
    </button>
  );
}

function Note({ warn, children }: { warn?: boolean; children: React.ReactNode }) {
  return (
    <div className={`mt-4 flex gap-3 rounded-lg border p-4 text-sm ${warn ? "border-yellow-500/50 bg-yellow-500/10" : "border-primary/40 bg-primary/5"}`}>
      {warn ? <AlertTriangle className="h-5 w-5 shrink-0 text-yellow-500" /> : <Info className="h-5 w-5 shrink-0 text-primary" />}
      <div>{children}</div>
    </div>
  );
}

function Calculateur() {
  const [step, setStep] = useState(0);
  const [projet, setProjet] = useState("");
  const [nbBornes, setNbBornes] = useState(1);
  const [kw, setKw] = useState<number | null>(null);
  const [alim, setAlim] = useState<Phase | null>(null);
  const [kva, setKva] = useState("");
  const [distance, setDistance] = useState("");
  const [exacte, setExacte] = useState("");
  const [pose, setPose] = useState("");
  const [delestage, setDelestage] = useState("");

  const regle = REGLES_BORNES.find((r) => r.kw === kw) ?? null;
  const longueur = Number(exacte) > 0 ? Number(exacte) : DISTANCES.find((d) => d.label === distance)?.m ?? 0;
  const incoherent = regle && alim === "mono" && regle.phase === "tri";
  const kvaFaible = regle ? kvaInsuffisant(kva, regle.kw) : false;

  const canNext = [
    !!projet && nbBornes >= 1,
    !!regle,
    !!alim && !!kva && !incoherent,
    longueur > 0,
    !!pose,
    !!delestage,
  ][step];

  const res = useMemo(() => (regle && longueur ? dimensionner(regle, longueur) : null), [regle, longueur]);

  const etude: string[] = [];
  if (nbBornes > 1) etude.push("plusieurs bornes");
  if (["Copropriété", "Parking / flotte de véhicules"].includes(projet)) etude.push("installation collective");
  if (longueur > 50) etude.push("distance importante");
  if (kw === 22) etude.push("puissance élevée");
  if (kvaFaible) etude.push("puissance souscrite possiblement insuffisante");
  if (regle?.phase === "tri") etude.push("installation triphasée");
  if (kva === "Autre") etude.push("abonnement hors cas standards");
  if (res && res.section === null) etude.push("section hors cas standards");

  const notes = regle ? [
    "Pré-dimensionnement calculateur :",
    `Projet : ${projet} (${nbBornes} borne${nbBornes > 1 ? "s" : ""})`,
    `Borne : ${regle.label} ${regle.phase === "mono" ? "monophasé" : "triphasé"}`,
    `Abonnement : ${kva}`, `Distance : ${longueur} m`, `Pose : ${pose}`, `Délestage souhaité : ${delestage}`,
    res ? `Indicatif : câble ${res.cable}, ${regle.disjoncteur}, chute ${res.chute.toFixed(1)} %` : "",
  ].filter(Boolean).join("\n") : "";

  const search = {
    puissance: regle?.label, kva: kva === "Autre" ? undefined : kva,
    phase: regle ? (regle.phase === "mono" ? "Monophasé" : "Triphasé") : undefined,
    distance: longueur || undefined, bien: projet, nb: nbBornes, notes,
  };

  return (
    <div className="public-premium min-h-screen bg-background text-foreground">
      <SiteNav />
      <main className="pt-28">
        <section className="mx-auto max-w-3xl px-4 sm:px-6 py-10 sm:py-14">
          <p className="text-mono text-primary">Outil gratuit · indicatif</p>
          <h1 className="mt-3 text-3xl md:text-5xl font-medium tracking-tight">Calculateur de pré-dimensionnement IRVE</h1>
          <p className="mt-4 text-muted-foreground">{DESC}</p>

          <div className="mt-8">
            <div className="flex justify-between text-xs text-muted-foreground mb-2">
              <span>Étape {step + 1} / {STEPS.length} · {STEPS[step]}</span>
              <span>{Math.round(((step + 1) / STEPS.length) * 100)} %</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary transition-all" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
            </div>
          </div>

          <div className="mt-8 rounded-xl border border-border bg-card/60 p-4 sm:p-6">
            {step === 0 && (<>
              <h2 className="text-xl font-semibold mb-4">Type de projet</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {PROJETS.map(({ v, icon: I }) => (
                  <Choice key={v} active={projet === v} onClick={() => setProjet(v)}><I className="h-5 w-5 text-primary" />{v}</Choice>
                ))}
              </div>
              <label className="block mt-5 text-sm">Nombre de bornes
                <input type="number" min={1} value={nbBornes} onChange={(e) => setNbBornes(Math.max(1, Number(e.target.value) || 1))}
                  className="mt-2 w-full bg-input border border-border rounded-lg px-4 py-3" />
              </label>
              {nbBornes > 1 && <Note warn>Plusieurs bornes : ce calculateur est prévu pour une borne. Une étude spécifique vous sera proposée à la fin.</Note>}
            </>)}

            {step === 1 && (<>
              <h2 className="text-xl font-semibold mb-4">Puissance de la borne</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {REGLES_BORNES.map((r) => (
                  <Choice key={r.kw} active={kw === r.kw} onClick={() => { setKw(r.kw); setAlim(r.phase === "tri" ? "tri" : alim); }}>
                    <Zap className="h-5 w-5 text-primary" />
                    <span>{r.label}<span className="block text-xs font-normal text-muted-foreground">{r.phase === "mono" ? "Monophasé" : "Triphasé obligatoire"}</span></span>
                  </Choice>
                ))}
              </div>
            </>)}

            {step === 2 && (<>
              <h2 className="text-xl font-semibold mb-4">Alimentation électrique</h2>
              <div className="grid grid-cols-2 gap-3">
                {(["mono", "tri"] as const).map((p) => (
                  <Choice key={p} active={alim === p} onClick={() => setAlim(p)}>{p === "mono" ? "Monophasé" : "Triphasé"}</Choice>
                ))}
              </div>
              {incoherent && (
                <Note warn>Une borne {regle?.label} nécessite une alimentation triphasée. Choisissez « Triphasé » ou revenez en arrière pour une borne 7,4 kW monophasée.</Note>
              )}
              <h3 className="mt-6 mb-3 font-semibold">Puissance souscrite</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {KVA_OPTIONS.map((k) => <Choice key={k} active={kva === k} onClick={() => setKva(k)}>{k}</Choice>)}
              </div>
              {kvaFaible && <Note warn>Attention : votre puissance souscrite pourrait être insuffisante pour cette borne. Une étude de puissance et/ou un système de gestion de charge peut être nécessaire.</Note>}
            </>)}

            {step === 3 && (<>
              <h2 className="text-xl font-semibold mb-4">Quelle est la distance approximative entre le tableau électrique et la borne ?</h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {DISTANCES.map((d) => <Choice key={d.label} active={distance === d.label} onClick={() => setDistance(d.label)}>{d.label}</Choice>)}
              </div>
              <label className="block mt-5 text-sm">Distance exacte en mètres (facultatif)
                <input type="number" min={1} value={exacte} onChange={(e) => setExacte(e.target.value)}
                  className="mt-2 w-full bg-input border border-border rounded-lg px-4 py-3" />
              </label>
              {longueur > 50 && <Note warn>Distance importante : une étude technique sera recommandée.</Note>}
            </>)}

            {step === 4 && (<>
              <h2 className="text-xl font-semibold mb-4">Mode de pose du câble</h2>
              <div className="grid sm:grid-cols-2 gap-3">
                {POSES.map((p) => <Choice key={p} active={pose === p} onClick={() => setPose(p)}>{p}</Choice>)}
              </div>
              {pose === "Je ne sais pas" && <Note>Pas d'inquiétude. Nos techniciens détermineront le mode de pose adapté lors de l'étude.</Note>}
            </>)}

            {step === 5 && (<>
              <h2 className="text-xl font-semibold mb-4">Souhaitez-vous éviter que votre installation disjoncte lorsque la borne fonctionne ?</h2>
              <div className="grid grid-cols-3 gap-3">
                {["Oui", "Non", "Je ne sais pas"].map((v) => <Choice key={v} active={delestage === v} onClick={() => setDelestage(v)}>{v}</Choice>)}
              </div>
              {(delestage === "Oui" || delestage === "Je ne sais pas") && (
                <Note>Un système de gestion de puissance / délestage peut permettre d'adapter automatiquement la puissance de recharge en fonction de la consommation du logement ou du bâtiment.</Note>
              )}
            </>)}

            {step === 6 && regle && res && (<div className="space-y-6">
              <h2 className="text-2xl font-semibold">Résultat de votre pré-dimensionnement</h2>
              <div>
                <h3 className="font-semibold text-primary mb-2">Votre projet</h3>
                <dl className="grid sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  {[["Type de projet", `${projet} · ${nbBornes} borne(s)`], ["Puissance de borne", regle.label], ["Réseau", regle.phase === "mono" ? "Monophasé" : "Triphasé"],
                    ["Distance", `${longueur} m`], ["Mode de pose", pose], ["Puissance souscrite", kva]].map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-3 border-b border-border/60 py-1.5"><dt className="text-muted-foreground">{k}</dt><dd className="font-medium text-right">{v}</dd></div>
                  ))}
                </dl>
              </div>
              <div>
                <h3 className="font-semibold text-primary mb-2">Dimensionnement indicatif</h3>
                <div className="grid sm:grid-cols-2 gap-3 text-sm">
                  {[["Courant de charge estimé", `${res.courant.toFixed(1)} A ${regle.phase === "mono" ? "(I = P / U)" : "(I = P / (√3 × U × cos φ))"}`],
                    ["Section de câble indicative", res.cable],
                    ["Protection indicative", regle.disjoncteur],
                    ["Protection différentielle", DIFFERENTIEL],
                    ["Chute de tension estimée", `${res.chute.toFixed(1)} % (limite 5 %)`]].map(([k, v]) => (
                    <div key={k} className="rounded-lg border border-border bg-background/40 p-3"><div className="text-xs text-muted-foreground">{k}</div><div className="mt-1 font-semibold">{v}</div></div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted-foreground">Résultats indicatifs, basés sur des hypothèses standards (câble cuivre, 230/400 V, cos φ = 1). Ils ne valent pas validation de conformité : seul un professionnel qualifié IRVE peut confirmer le dimensionnement après visite.</p>
              </div>

              {etude.length > 0 && (
                <div className="rounded-lg border border-yellow-500/50 bg-yellow-500/10 p-4">
                  <h3 className="font-semibold flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-yellow-500" />Étude technique recommandée</h3>
                  <p className="mt-2 text-sm">Votre projet nécessite une vérification plus approfondie ({etude.join(", ")}). Notre équipe IRVE Technologie peut réaliser l'étude et confirmer le dimensionnement avant installation.</p>
                  <Link to="/demande" search={search as never} className="mt-3 inline-flex rounded-lg border border-yellow-500 px-4 py-2 text-sm font-semibold">Demander une étude</Link>
                </div>
              )}

              <div className="rounded-lg border border-primary/40 bg-primary/5 p-5">
                <h3 className="text-lg font-semibold">Vous souhaitez aller plus loin ?</h3>
                <p className="mt-2 text-sm text-muted-foreground">Transmettez-nous les informations de votre projet. Notre équipe pourra vérifier le dimensionnement et vous proposer une solution adaptée.</p>
                <Link to="/demande" search={search as never} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 font-semibold text-primary-foreground">
                  Demander mon devis <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>)}

            <div className="mt-6 flex justify-between gap-3">
              <button type="button" disabled={step === 0} onClick={() => setStep(step - 1)}
                className="inline-flex items-center gap-2 rounded-lg border border-border px-4 py-3 text-sm disabled:opacity-40">
                <ArrowLeft className="h-4 w-4" /> Retour
              </button>
              {step < 6 && (
                <button type="button" disabled={!canNext} onClick={() => setStep(step + 1)}
                  className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40">
                  {step === 5 ? "Voir le résultat" : "Continuer"} <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
