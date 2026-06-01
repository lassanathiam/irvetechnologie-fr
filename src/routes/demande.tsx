import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, type ChangeEvent } from "react";
import { ArrowRight, Camera, Check, Upload, X, Zap, CableCar, PanelTop } from "lucide-react";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createFileRoute("/demande")({
  head: () => ({
    meta: [
      { title: "Demande de raccordement — IRVE Technologie" },
      { name: "description", content: "Décrivez votre projet et joignez les photos du tableau électrique, du cheminement de câble et de l'emplacement souhaité pour votre borne." },
    ],
  }),
  component: Demande,
});

type PhotoKey = "tableau" | "cheminement" | "borne";

const photoFields: { key: PhotoKey; label: string; hint: string; icon: typeof PanelTop }[] = [
  {
    key: "tableau",
    label: "Tableau électrique",
    hint: "Photo nette du tableau ouvert avec les disjoncteurs visibles.",
    icon: PanelTop,
  },
  {
    key: "cheminement",
    label: "Cheminement du câble",
    hint: "Vue du trajet entre tableau et borne (mur, plafond, sol, extérieur).",
    icon: CableCar,
  },
  {
    key: "borne",
    label: "Emplacement de la borne",
    hint: "Mur ou poteau où la borne sera installée, avec recul si possible.",
    icon: Zap,
  },
];

function Demande() {
  const [photos, setPhotos] = useState<Record<PhotoKey, string | null>>({
    tableau: null,
    cheminement: null,
    borne: null,
  });
  const [submitted, setSubmitted] = useState(false);

  function handleFile(key: PhotoKey, e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    setPhotos((p) => ({ ...p, [key]: url }));
  }

  function clearPhoto(key: PhotoKey) {
    setPhotos((p) => {
      if (p[key]) URL.revokeObjectURL(p[key]!);
      return { ...p, [key]: null };
    });
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitted(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (submitted) {
    return (
      <div className="min-h-screen">
        <SiteNav />
        <section className="pt-40 pb-24">
          <div className="mx-auto max-w-2xl px-6 text-center">
            <div className="inline-flex items-center justify-center h-16 w-16 rounded-full hero-grad text-primary-foreground mb-8">
              <Check className="h-7 w-7" strokeWidth={2.5} />
            </div>
            <h1 className="text-4xl md:text-5xl font-medium tracking-tight">
              Demande reçue.
            </h1>
            <p className="mt-6 text-muted-foreground">
              Notre équipe étudie votre dossier et revient vers vous sous 48h ouvrées.
              Vous serez recontacté par téléphone pour valider l'étude technique.
            </p>
          </div>
        </section>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SiteNav />

      <section className="pt-32 pb-12 border-b border-border">
        <div className="mx-auto max-w-5xl px-6">
          <div className="flex items-center gap-3 text-mono text-primary mb-6">
            <span className="h-px w-10 bg-primary" /> Formulaire · 5 min
          </div>
          <h1 className="text-4xl md:text-6xl font-medium tracking-tight">
            Demande de{" "}
            <span className="text-muted-foreground/60">raccordement</span>
          </h1>
          <p className="mt-6 max-w-2xl text-muted-foreground">
            Quelques infos et 3 photos suffisent pour démarrer l'étude. Plus elles sont
            précises, plus notre devis sera juste — et rapide.
          </p>
        </div>
      </section>

      <form onSubmit={onSubmit} className="py-16">
        <div className="mx-auto max-w-5xl px-6 space-y-16">

          {/* Coordonnées */}
          <div>
            <SectionHeading n="01" title="Vos coordonnées" />
            <div className="grid md:grid-cols-2 gap-4 mt-8">
              <Field label="Nom complet" name="nom" required />
              <Field label="Téléphone" name="tel" type="tel" required />
              <Field label="Email" name="email" type="email" required />
              <Field label="Code postal" name="cp" required />
            </div>
          </div>

          {/* Projet */}
          <div>
            <SectionHeading n="02" title="Votre projet" />
            <div className="grid md:grid-cols-2 gap-4 mt-8">
              <Select label="Type de bien" name="bien" options={["Maison individuelle", "Copropriété", "Entreprise / parking", "Concession auto"]} />
              <Select label="Puissance souhaitée" name="puissance" options={["7 kW (monophasé)", "11 kW (triphasé)", "22 kW (triphasé)", "Je ne sais pas"]} />
              <Select label="Type d'installation" name="type" options={["Intérieure (garage)", "Extérieure (façade)", "Sur poteau / borne", "À déterminer"]} />
              <Field label="Distance tableau → borne (m)" name="distance" type="number" />
            </div>
            <Textarea label="Précisions" name="notes" placeholder="Modèle de véhicule, contraintes particulières, délais souhaités…" />
          </div>

          {/* PHOTOS */}
          <div>
            <SectionHeading n="03" title="Photos du chantier" />
            <p className="text-sm text-muted-foreground mt-3 max-w-xl">
              Ces 3 photos nous permettent d'évaluer la faisabilité sans déplacement.
              Format JPG/PNG, idéalement en lumière naturelle.
            </p>

            <div className="grid md:grid-cols-3 gap-4 mt-8">
              {photoFields.map((f) => (
                <PhotoUpload
                  key={f.key}
                  field={f}
                  value={photos[f.key]}
                  onChange={(e) => handleFile(f.key, e)}
                  onClear={() => clearPhoto(f.key)}
                />
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="pt-8 border-t border-border flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <p className="text-mono text-muted-foreground max-w-md">
              En envoyant ce formulaire, vous acceptez d'être recontacté par IRVE Technologie.
            </p>
            <button type="submit" className="hero-grad text-primary-foreground text-mono px-6 py-4 rounded-sm inline-flex items-center gap-2 hover:opacity-90">
              Envoyer la demande <ArrowRight className="h-4 w-4" />
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

function Field({ label, name, type = "text", required }: { label: string; name: string; type?: string; required?: boolean }) {
  return (
    <label className="block">
      <span className="text-mono text-muted-foreground">{label}{required && <span className="text-primary"> *</span>}</span>
      <input
        name={name}
        type={type}
        required={required}
        className="mt-2 w-full bg-input border border-border rounded-sm px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition"
      />
    </label>
  );
}

function Select({ label, name, options }: { label: string; name: string; options: string[] }) {
  return (
    <label className="block">
      <span className="text-mono text-muted-foreground">{label}</span>
      <select
        name={name}
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
      <textarea
        name={name}
        rows={4}
        placeholder={placeholder}
        className="mt-2 w-full bg-input border border-border rounded-sm px-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition resize-none"
      />
    </label>
  );
}

function PhotoUpload({
  field,
  value,
  onChange,
  onClear,
}: {
  field: { key: PhotoKey; label: string; hint: string; icon: typeof PanelTop };
  value: string | null;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const Icon = field.icon;

  return (
    <div className="relative border border-border rounded-sm bg-card overflow-hidden group">
      <div className="aspect-[4/3] relative bg-secondary/40">
        {value ? (
          <>
            <img src={value} alt={field.label} className="absolute inset-0 w-full h-full object-cover" />
            <button
              type="button"
              onClick={onClear}
              className="absolute top-2 right-2 bg-background/80 border border-border p-1.5 rounded-sm hover:bg-destructive hover:text-destructive-foreground transition"
              aria-label="Retirer la photo"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="absolute bottom-2 left-2 text-mono text-primary bg-background/80 px-2 py-1 rounded-sm flex items-center gap-1.5">
              <Check className="h-3 w-3" /> Ajoutée
            </div>
          </>
        ) : (
          <button
            type="button"
            onClick={() => ref.current?.click()}
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-muted-foreground hover:text-primary hover:bg-primary/5 transition"
          >
            <Icon className="h-8 w-8" strokeWidth={1.25} />
            <span className="text-mono">Ajouter</span>
            <span className="flex items-center gap-2 text-mono opacity-60">
              <Camera className="h-3 w-3" /> ou <Upload className="h-3 w-3" />
            </span>
          </button>
        )}
        <input
          ref={ref}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={onChange}
          className="hidden"
        />
      </div>
      <div className="p-4 border-t border-border">
        <div className="flex items-center justify-between">
          <div className="font-medium">{field.label}</div>
          {!value && (
            <button type="button" onClick={() => ref.current?.click()} className="text-mono text-primary hover:underline">
              Parcourir
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{field.hint}</p>
      </div>
    </div>
  );
}
