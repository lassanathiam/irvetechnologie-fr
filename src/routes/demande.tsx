import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef, type ChangeEvent } from "react";
import { ArrowRight, Camera, Check, Upload, X, Zap, CableCar, PanelTop, Plus, ChevronLeft, ChevronRight, Loader2, Gauge } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { submitDemande } from "@/lib/demande.functions";
import { uploadDemandePhoto } from "@/lib/photos.functions";
import { compressImage } from "@/lib/image-compress";
import { ABONNEMENTS_KVA, PUISSANCES_BORNE, alerteAbonnement } from "@/lib/rapport-checklist";

type Formule = "serenite" | "premium" | "pro";
const FORMULES: Record<Formule, { label: string; price: string }> = {
  serenite: { label: "Sérénité", price: "149 € TTC/an" },
  premium: { label: "Sérénité+", price: "290 € TTC/an" },
  pro: { label: "Pro / Flotte", price: "Sur devis" },
};

type TypeDemande = "raccordement" | "intervention" | "maintenance" | "souscription";
const TYPES_DEMANDE: { v: TypeDemande; label: string }[] = [
  { v: "raccordement", label: "Demande de raccordement (installation)" },
  { v: "intervention", label: "Demande d'intervention (dépannage)" },
  { v: "maintenance", label: "Demande de maintenance / entretien" },
  { v: "souscription", label: "Souscription à une formule" },
];

export const Route = createFileRoute("/demande")({
  validateSearch: (search: Record<string, unknown>): { formule?: Formule } => {
    const f = search.formule;
    if (f === "serenite" || f === "premium" || f === "pro") return { formule: f };
    return {};
  },
  head: () => ({
    meta: [
      { title: "Demande de raccordement — Borne de l'Ouest" },
      { name: "description", content: "Décrivez votre projet et joignez les photos du tableau électrique, du cheminement de câble et de l'emplacement de la borne." },
      { property: "og:title", content: "Demande de raccordement — Borne de l'Ouest" },
      { property: "og:description", content: "Décrivez votre installation de borne et transmettez les informations nécessaires à son étude." },
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
            {
              "@type": "ListItem",
              position: 2,
              name: "Demande de raccordement",
              item: "https://www.irvetechnologie.fr/demande",
            },
          ],
        }),
      },
    ],
  }),
  component: Demande,
});

const MAX_CHEMINEMENT = 5;

function Demande() {
  const { formule } = Route.useSearch();
  const formuleInfo = formule ? FORMULES[formule as Formule] : null;
  const [kva, setKva] = useState(ABONNEMENTS_KVA[ABONNEMENTS_KVA.length - 1]!);
  const [puissanceBorne, setPuissanceBorne] = useState(PUISSANCES_BORNE[PUISSANCES_BORNE.length - 1]!);
  const alerte = alerteAbonnement(kva, puissanceBorne);
  const [typeDemande, setTypeDemande] = useState<TypeDemande>(
    formule ? "souscription" : "raccordement",
  );
  const [tableau, setTableau] = useState<string | null>(null);
  const [linky, setLinky] = useState<string | null>(null);
  const [borne, setBorne] = useState<string | null>(null);
  const [cheminement, setCheminement] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submitDemandeFn = useServerFn(submitDemande);
  const uploadPhotoFn = useServerFn(uploadDemandePhoto);
  const mountedAt = useRef<number>(Date.now());
  const files = useRef<{
    tableau: File | null;
    linky: File | null;
    borne: File | null;
    cheminement: File[];
  }>({
    tableau: null,
    linky: null,
    borne: null,
    cheminement: [],
  });

  function setSingle(
    setter: (v: string | null) => void,
    current: string | null,
    slot: "tableau" | "linky" | "borne",
  ) {
    return (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (current) URL.revokeObjectURL(current);
      files.current[slot] = file;
      setter(URL.createObjectURL(file));
    };
  }

  function clearSingle(
    setter: (v: string | null) => void,
    current: string | null,
    slot: "tableau" | "linky" | "borne",
  ) {
    return () => {
      if (current) URL.revokeObjectURL(current);
      files.current[slot] = null;
      setter(null);
    };
  }

  function addCheminement(e: ChangeEvent<HTMLInputElement>) {
    const picked = Array.from(e.target.files ?? []);
    if (!picked.length) return;
    const remaining = MAX_CHEMINEMENT - cheminement.length;
    const kept = picked.slice(0, remaining);
    files.current.cheminement = [...files.current.cheminement, ...kept];
    setCheminement((c) => [...c, ...kept.map((f) => URL.createObjectURL(f))]);
    e.target.value = "";
  }

  function removeCheminement(i: number) {
    files.current.cheminement = files.current.cheminement.filter((_, idx) => idx !== i);
    setCheminement((c) => {
      URL.revokeObjectURL(c[i]);
      return c.filter((_, idx) => idx !== i);
    });
  }

  /** Compresse puis envoie chaque photo vers le stockage privé de l'entreprise. */
  async function uploadPhotos(demandeId: string) {
    const jobs: { kind: "tableau" | "linky" | "cheminement" | "borne"; file: File }[] = [];
    if (files.current.tableau) jobs.push({ kind: "tableau", file: files.current.tableau });
    if (files.current.linky) jobs.push({ kind: "linky", file: files.current.linky });
    if (files.current.borne) jobs.push({ kind: "borne", file: files.current.borne });
    for (const f of files.current.cheminement) jobs.push({ kind: "cheminement", file: f });
    if (!jobs.length) return;
    setUploading(true);
    for (const job of jobs) {
      try {
        const data_url = await compressImage(job.file);
        await uploadPhotoFn({ data: { demande_id: demandeId, kind: job.kind, data_url } });
      } catch (err) {
        console.error("upload photo", job.kind, err);
      }
    }
    setUploading(false);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const fd = new FormData(e.currentTarget);
      const get = (k: string) => (fd.get(k)?.toString() ?? "").trim();
      const distanceRaw = get("distance");
      const distance = distanceRaw ? Number(distanceRaw) : null;
      const nbRaw = get("nb_bornes");
      const nb = nbRaw ? Number(nbRaw) : null;
      const res = await submitDemandeFn({
        data: {
          nom: get("nom"),
          email: get("email"),
          telephone: get("tel"),
          code_postal: get("cp"),
          type_bien: get("bien") || null,
          puissance: get("puissance") || null,
          type_installation: get("type") || null,
          abonnement_kva: get("abonnement_kva") || null,
          type_compteur: get("type_compteur") || null,
          phase: get("phase") || null,
          distance_m: Number.isFinite(distance as number) ? (distance as number) : null,
          notes: get("notes") || null,
          formule: formule ?? null,
          type_demande: typeDemande,
          nb_bornes: nb && Number.isFinite(nb) && nb > 0 ? Math.round(nb) : null,
          website: get("website") || null,
          elapsed_ms: Date.now() - mountedAt.current,
        },
      });
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
      if (res?.id && res.id !== "honeypot" && res.id !== "timetrap") {
        void uploadPhotos(res.id);
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Une erreur est survenue. Réessayez.");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="public-premium min-h-screen bg-background text-foreground">
        <SiteNav />
        <section className="pt-40 pb-24">
          <div className="mx-auto max-w-2xl px-6 text-center">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full hero-grad text-primary-foreground mb-8">
              <Check className="h-7 w-7" strokeWidth={2.5} />
            </div>
            <h1 className="text-4xl md:text-5xl font-medium tracking-tight">Demande reçue.</h1>
            <p className="mt-6 text-muted-foreground">
              L'équipe Borne de l'Ouest étudie votre dossier et revient vers vous sous 48h ouvrées.
            </p>
            <p className="mt-4 text-sm text-muted-foreground inline-flex items-center gap-2">
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin text-primary" /> Transfert de vos photos en cours — ne fermez
                  pas cette page.
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 text-primary" /> Vos photos ont bien été transmises à notre bureau d'études.
                </>
              )}
            </p>
          </div>
        </section>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="public-premium min-h-screen bg-background text-foreground">
      <SiteNav />

      <section className="pt-32 pb-12 border-b border-border">
        <div className="mx-auto max-w-5xl px-6">
          <div className="flex items-center gap-3 text-mono text-primary mb-6">
            <span className="h-px w-10 bg-primary" /> {formuleInfo ? "Souscription · Maintenance" : "Formulaire · 5 min"}
          </div>
          <h1 className="text-4xl md:text-6xl font-medium tracking-tight">
            {formuleInfo ? "Souscrire la formule" : "Demande de"}{" "}
            <span className="text-muted-foreground/60">{formuleInfo ? formuleInfo.label : "raccordement"}</span>
          </h1>
          <p className="mt-6 max-w-2xl text-muted-foreground">
            {formuleInfo
              ? `Renseignez vos coordonnées et l'adresse de la borne. Nous vous recontactons sous 48h pour activer votre abonnement ${formuleInfo.label} (${formuleInfo.price}).`
              : "Quelques infos et vos photos suffisent pour démarrer l'étude. Plus elles sont précises, plus notre devis sera juste — et rapide."}
          </p>
          {formuleInfo && (
            <div className="mt-8 inline-flex items-center gap-3 border border-primary/30 bg-card rounded-sm px-4 py-3">
              <span className="hero-grad text-primary-foreground text-mono px-2 py-1 rounded-sm">{formuleInfo.label}</span>
              <span className="text-sm text-muted-foreground">{formuleInfo.price}</span>
            </div>
          )}
        </div>
      </section>

      <form onSubmit={onSubmit} className="py-16">
        <div className="mx-auto max-w-5xl px-6 space-y-16">
          {formule && <input type="hidden" name="formule" value={formule} />}

          {/* Honeypot — hidden from humans, bots tend to fill it */}
          <div aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
            <label>
              Ne pas remplir
              <input type="text" name="website" tabIndex={-1} autoComplete="off" defaultValue="" />
            </label>
          </div>


          <div>
            <SectionHeading n="01" title="Vos coordonnées" />
            <div className="grid md:grid-cols-2 gap-4 mt-8">
              <Field label="Nom complet" name="nom" required />
              <Field label="Téléphone" name="tel" type="tel" required />
              <Field label="Email" name="email" type="email" required />
              <Field label="Code postal" name="cp" required />
            </div>
          </div>

          <div>
            <SectionHeading n="02" title="Votre compteur" />
            <p className="text-sm text-muted-foreground mt-3 max-w-xl">
              Ces informations figurent sur votre facture d'électricité. Elles nous permettent de savoir si votre
              abonnement suffit pour la borne souhaitée.
            </p>
            <div className="grid md:grid-cols-2 gap-4 mt-8">
              <SelectControlled
                label="Abonnement souscrit (kVA)"
                name="abonnement_kva"
                options={ABONNEMENTS_KVA}
                value={kva}
                onChange={setKva}
              />
              <Select label="Type de compteur" name="type_compteur" options={["Linky", "Ancien compteur", "Je ne sais pas"]} />
              <Select label="Alimentation" name="phase" options={["Monophasé", "Triphasé", "Je ne sais pas"]} />
              <SelectControlled
                label="Puissance de borne souhaitée"
                name="puissance"
                options={PUISSANCES_BORNE}
                value={puissanceBorne}
                onChange={setPuissanceBorne}
              />
            </div>
            {alerte && (
              <div className="mt-4 border border-primary/40 bg-primary/5 rounded-sm px-4 py-3 text-sm text-muted-foreground">
                {alerte}
              </div>
            )}
          </div>

          <div>
            <SectionHeading n="03" title="Votre projet" />
            <div className="grid md:grid-cols-2 gap-4 mt-8">
              <SelectControlled
                label="Objet de votre demande"
                name="type_demande"
                options={TYPES_DEMANDE.map((t) => t.label)}
                value={TYPES_DEMANDE.find((t) => t.v === typeDemande)!.label}
                onChange={(label) =>
                  setTypeDemande(
                    TYPES_DEMANDE.find((t) => t.label === label)?.v ?? "raccordement",
                  )
                }
              />
              <Field
                label="Nombre de bornes"
                name="nb_bornes"
                type="number"
                defaultValue={formule === "pro" ? "2" : "1"}
              />
              <Select label="Type de bien" name="bien" options={["Maison individuelle", "Copropriété", "Entreprise / parking", "Concession auto"]} />
              <Select label="Type d'installation" name="type" options={["Intérieure (garage)", "Extérieure (façade)", "Sur poteau / borne", "À déterminer"]} />
              <Field label="Distance tableau → borne (m)" name="distance" type="number" />
            </div>
            <Textarea label="Précisions" name="notes" placeholder="Modèle de véhicule, contraintes particulières, délais souhaités…" />
          </div>


          <div>
            <SectionHeading n="04" title="Photos du chantier" />
            <p className="text-sm text-muted-foreground mt-3 max-w-xl">
              Nous vous demandons de photographier soigneusement les éléments du chantier afin que notre bureau
              d&apos;études puisse analyser votre installation à distance. Des photos précises permettent d&apos;éviter
              un déplacement d&apos;étude inutile et nous aident à limiter les frais pour vous proposer un devis au plus juste.
              Le cheminement du câble peut comporter plusieurs vues — ajoutez-en autant que nécessaire (jusqu&apos;à {MAX_CHEMINEMENT}).
            </p>

            <div className="grid md:grid-cols-2 gap-4 mt-8">
              <SinglePhoto
                label="Tableau électrique"
                hint="Photo nette du tableau ouvert avec les disjoncteurs visibles."
                icon={PanelTop}
                value={tableau}
                onChange={setSingle(setTableau, tableau, "tableau")}
                onClear={clearSingle(setTableau, tableau, "tableau")}
              />
              <SinglePhoto
                label="Compteur Linky"
                hint="Photo de l'écran du compteur Linky, avec le numéro lisible."
                icon={Gauge}
                value={linky}
                onChange={setSingle(setLinky, linky, "linky")}
                onClear={clearSingle(setLinky, linky, "linky")}
              />
              <SinglePhoto
                label="Emplacement de la borne"
                hint="Mur ou poteau où la borne sera installée, avec recul si possible."
                icon={Zap}
                value={borne}
                onChange={setSingle(setBorne, borne, "borne")}
                onClear={clearSingle(setBorne, borne, "borne")}
              />
            </div>

            <div className="mt-4">
              <CheminementGallery
                photos={cheminement}
                onAdd={addCheminement}
                onRemove={removeCheminement}
                max={MAX_CHEMINEMENT}
              />
            </div>
          </div>

          <div className="pt-8 border-t border-border flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="max-w-md space-y-2">
              <p className="text-mono text-muted-foreground">
                En envoyant ce formulaire, vous acceptez d'être recontacté par Borne de l'Ouest.
              </p>
              {error && (
                <p className="text-mono text-destructive" role="alert">{error}</p>
              )}
            </div>
            <button type="submit" disabled={submitting} className="hero-grad text-primary-foreground text-mono px-6 py-4 rounded-sm inline-flex items-center gap-2 hover:opacity-90 disabled:opacity-60 disabled:cursor-not-allowed">
              {submitting ? (<><Loader2 className="h-4 w-4 animate-spin" /> Envoi…</>) : (<>Envoyer la demande <ArrowRight className="h-4 w-4" /></>)}
            </button>
          </div>
        </div>
      </form>

      <SiteFooter />
    </div>
  );
}

function SectionHeading({ n, title }: { n: string; title: string }) {
  return (
    <div className="flex items-baseline gap-6 border-b border-border pb-4">
      <span className="text-mono text-primary">{n}</span>
      <h2 className="text-2xl md:text-3xl font-medium tracking-tight">{title}</h2>
    </div>
  );
}

function Field({ label, name, type = "text", required, defaultValue }: { label: string; name: string; type?: string; required?: boolean; defaultValue?: string }) {
  return (
    <label className="block">
      <span className="text-mono text-muted-foreground">{label}{required && <span className="text-primary"> *</span>}</span>
      <input name={name} type={type} required={required} defaultValue={defaultValue} className="mt-2 w-full bg-input border border-border rounded-sm px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition" />
    </label>
  );
}

function Select({ label, name, options }: { label: string; name: string; options: string[] }) {
  return (
    <label className="block">
      <span className="text-mono text-muted-foreground">{label}</span>
      <select name={name} className="mt-2 w-full bg-input border border-border rounded-sm px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition">
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </label>
  );
}

function SelectControlled({
  label, name, options, value, onChange,
}: { label: string; name: string; options: string[]; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="text-mono text-muted-foreground">{label}</span>
      <select
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full bg-input border border-border rounded-sm px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition"
      >
        {options.map((o) => <option key={o}>{o}</option>)}
      </select>
    </label>
  );
}

function Textarea({ label, name, placeholder }: { label: string; name: string; placeholder?: string }) {
  return (
    <label className="block mt-4">
      <span className="text-mono text-muted-foreground">{label}</span>
      <textarea name={name} rows={4} placeholder={placeholder} className="mt-2 w-full bg-input border border-border rounded-sm px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition resize-none" />
    </label>
  );
}

function SinglePhoto({
  label, hint, icon: Icon, value, onChange, onClear,
}: {
  label: string;
  hint: string;
  icon: typeof PanelTop;
  value: string | null;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <div className="relative border border-border rounded-sm bg-card overflow-hidden">
      <div className="aspect-[4/3] relative bg-secondary/40">
        {value ? (
          <>
            <img src={value} alt={label} className="absolute inset-0 w-full h-full object-cover" />
            <button type="button" onClick={onClear} className="absolute top-2 right-2 bg-background/80 border border-border p-1.5 rounded-sm hover:bg-destructive hover:text-destructive-foreground transition" aria-label="Retirer la photo">
              <X className="h-4 w-4" />
            </button>
            <div className="absolute bottom-2 left-2 text-mono text-primary bg-background/80 px-2 py-1 rounded-sm flex items-center gap-1.5">
              <Check className="h-3 w-3" /> Ajoutée
            </div>
          </>
        ) : (
          <button type="button" onClick={() => ref.current?.click()} className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground hover:text-primary hover:bg-primary/5 transition">
            <Icon className="h-8 w-8" strokeWidth={1.25} />
            <span className="text-mono">Ajouter</span>
            <span className="flex items-center gap-2 text-mono opacity-60">
              <Camera className="h-3 w-3" /> ou <Upload className="h-3 w-3" />
            </span>
          </button>
        )}
        <input ref={ref} type="file" accept="image/*" capture="environment" onChange={onChange} className="hidden" />
      </div>
      <div className="p-4 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="font-medium">{label}</div>
          {!value && (
            <button type="button" onClick={() => ref.current?.click()} className="text-mono text-primary hover:underline">Parcourir</button>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{hint}</p>
      </div>
    </div>
  );
}

function CheminementGallery({
  photos, onAdd, onRemove, max,
}: {
  photos: string[];
  onAdd: (e: ChangeEvent<HTMLInputElement>) => void;
  onRemove: (i: number) => void;
  max: number;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState(0);
  const safeActive = photos.length ? Math.min(active, photos.length - 1) : 0;
  const canAdd = photos.length < max;

  return (
    <div className="border border-border rounded-sm bg-card overflow-hidden">
      <div className="aspect-[16/10] relative bg-secondary/40">
        {photos.length === 0 ? (
          <button type="button" onClick={() => ref.current?.click()} className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground hover:text-primary hover:bg-primary/5 transition">
            <CableCar className="h-10 w-10" strokeWidth={1.25} />
            <span className="text-mono">Ajouter les photos du cheminement</span>
            <span className="flex items-center gap-2 text-mono opacity-60">
              <Camera className="h-3 w-3" /> ou <Upload className="h-3 w-3" /> · 2 à {max} photos
            </span>
          </button>
        ) : (
          <>
            <img src={photos[safeActive]} alt={`Cheminement ${safeActive + 1}`} className="absolute inset-0 w-full h-full object-cover" />

            {photos.length > 1 && (
              <>
                <button type="button" onClick={() => setActive((i) => (i - 1 + photos.length) % photos.length)} className="absolute left-3 top-1/2 -translate-y-1/2 bg-background/80 border border-border p-2 rounded-sm hover:border-primary hover:text-primary transition" aria-label="Précédente">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button type="button" onClick={() => setActive((i) => (i + 1) % photos.length)} className="absolute right-3 top-1/2 -translate-y-1/2 bg-background/80 border border-border p-2 rounded-sm hover:border-primary hover:text-primary transition" aria-label="Suivante">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </>
            )}

            <button type="button" onClick={() => onRemove(safeActive)} className="absolute top-3 right-3 bg-background/80 border border-border p-1.5 rounded-sm hover:bg-destructive hover:text-destructive-foreground transition" aria-label="Retirer cette photo">
              <X className="h-4 w-4" />
            </button>

            <div className="absolute bottom-3 left-3 text-mono text-primary bg-background/80 px-2 py-1 rounded-sm">
              {safeActive + 1} / {photos.length}
            </div>
          </>
        )}
        <input ref={ref} type="file" accept="image/*" capture="environment" multiple onChange={onAdd} className="hidden" />
      </div>

      <div className="p-4 border-t border-border">
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="font-medium">Cheminement du câble</div>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              De 2 à {max} photos : trajet tableau → borne (mur, plafond, sol, traversées, extérieur).
            </p>
          </div>
          <button
            type="button"
            disabled={!canAdd}
            onClick={() => ref.current?.click()}
            className="hero-grad text-primary-foreground text-mono px-3 py-2 rounded-sm inline-flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition"
          >
            <Plus className="h-3.5 w-3.5" /> Ajouter
          </button>
        </div>

        {photos.length > 0 && (
          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {photos.map((src, i) => (
              <button
                key={src}
                type="button"
                onClick={() => setActive(i)}
                className={`relative shrink-0 h-16 w-20 rounded-sm overflow-hidden border-2 transition ${i === safeActive ? "border-primary" : "border-border hover:border-muted-foreground"}`}
              >
                <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" />
              </button>
            ))}
            {canAdd && (
              <button
                type="button"
                onClick={() => ref.current?.click()}
                className="shrink-0 h-16 w-20 rounded-sm border-2 border-dashed border-border hover:border-primary hover:text-primary text-muted-foreground flex items-center justify-center transition"
                aria-label="Ajouter une photo"
              >
                <Plus className="h-5 w-5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
