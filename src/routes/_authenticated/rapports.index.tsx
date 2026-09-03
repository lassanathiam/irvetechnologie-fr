import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Camera, ClipboardCheck, FileText, Loader2, Trash2, X } from "lucide-react";
import {
  CHECK_LABEL,
  type CheckState,
  PHOTOS_REQUISES,
  type PhotoKind,
  RAPPORT_TYPES,
  type RapportType,
  checklistFor,
  mesuresFor,
} from "@/lib/rapport-checklist";
import {
  createRapport,
  deleteRapport,
  listRapports,
  uploadRapportPhoto,
  type RapportInput,
} from "@/lib/rapports.functions";
import { SignaturePad } from "@/components/SignaturePad";
import { compressImage } from "@/lib/image-compress";
import { dateFr } from "@/lib/company";


export const Route = createFileRoute("/_authenticated/rapports/")({
  head: () => ({
    meta: [
      { title: "Rapports de contrôle IRVE — Espace pro" },
      {
        name: "description",
        content:
          "Générer un rapport de contrôle ou de conformité d'installation de borne de recharge, avec points de contrôle, mesures et signatures.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RapportsPage,
});

const today = () => new Date().toISOString().slice(0, 10);

function RapportsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchRapports = useServerFn(listRapports);
  const createFn = useServerFn(createRapport);
  const deleteFn = useServerFn(deleteRapport);

  const rapports = useQuery({ queryKey: ["rapports"], queryFn: () => fetchRapports() });

  const [type, setType] = useState<RapportType>("conformite");
  const [checks, setChecks] = useState<Record<string, CheckState>>({});
  const [mesures, setMesures] = useState<Record<string, string>>({});
  const [sigTech, setSigTech] = useState<string | null>(null);
  const [sigClient, setSigClient] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: (payload: RapportInput) => createFn({ data: payload }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["rapports"] });
      navigate({ to: "/rapports/$id", params: { id: res.id } });
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Enregistrement impossible."),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rapports"] }),
  });

  function setAllSection(sectionKey: string, state: CheckState) {
    const section = CHECKLIST.find((s) => s.key === sectionKey);
    if (!section) return;
    setChecks((c) => {
      const next = { ...c };
      for (const item of section.items) next[`${sectionKey}.${item.key}`] = state;
      return next;
    });
  }

  function setAll(state: CheckState) {
    const next: Record<string, CheckState> = {};
    for (const s of CHECKLIST) for (const i of s.items) next[`${s.key}.${i.key}`] = state;
    setChecks(next);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => (fd.get(k)?.toString() ?? "").trim();
    create.mutate({
      type,
      date_intervention: get("date") || today(),
      client_nom: get("client_nom"),
      client_telephone: get("client_telephone") || null,
      client_email: get("client_email") || null,
      chantier_adresse: get("chantier_adresse") || null,
      chantier_cp_ville: get("chantier_cp_ville") || null,
      borne_marque: get("borne_marque") || null,
      borne_modele: get("borne_modele") || null,
      borne_puissance: get("borne_puissance") || null,
      borne_serie: get("borne_serie") || null,
      technicien: get("technicien") || null,
      mesures,
      checklist: checks,
      observations: get("observations") || null,
      reserves: get("reserves") || null,
      signature_technicien: sigTech,
      signature_client: sigClient,
      signataire_client: get("signataire_client") || null,
    });
  }

  const total = CHECKLIST.reduce((s, sec) => s + sec.items.length, 0);
  const filled = Object.keys(checks).length;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card sticky top-0 z-20">
        <div className="mx-auto max-w-5xl px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-mono">
            <ClipboardCheck className="h-4 w-4 text-primary" />
            Rapports d'intervention
          </div>
          <nav className="flex items-center gap-4 text-mono text-sm">
            <Link to="/devis" className="text-muted-foreground hover:text-primary">Devis</Link>
            <Link to="/demandes" className="text-muted-foreground hover:text-primary">Demandes</Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10 grid lg:grid-cols-[1fr_300px] gap-10 items-start">
        <form onSubmit={onSubmit} className="space-y-8">
          {/* Type */}
          <section className="bg-card border border-border rounded-sm p-6">
            <div className="text-mono text-muted-foreground mb-3">Type de rapport</div>
            <div className="grid sm:grid-cols-2 gap-3">
              {(Object.keys(RAPPORT_TYPES) as RapportType[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => setType(k)}
                  className={`text-left border rounded-sm p-4 transition ${
                    type === k ? "border-primary bg-primary/10" : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="font-medium">{RAPPORT_TYPES[k].label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{RAPPORT_TYPES[k].subtitle}</div>
                </button>
              ))}
            </div>
          </section>

          {/* Client & chantier */}
          <section className="bg-card border border-border rounded-sm p-6 space-y-4">
            <div className="text-mono text-muted-foreground">Client & chantier</div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field name="client_nom" label="Nom du client *" required />
              <Field name="date" label="Date d'intervention" type="date" defaultValue={today()} />
              <Field name="client_telephone" label="Téléphone" />
              <Field name="client_email" label="Email" type="email" />
              <Field name="chantier_adresse" label="Adresse du chantier" />
              <Field name="chantier_cp_ville" label="CP / Ville" />
              <Field name="technicien" label="Technicien" />
            </div>
          </section>

          {/* Borne */}
          <section className="bg-card border border-border rounded-sm p-6 space-y-4">
            <div className="text-mono text-muted-foreground">Matériel installé</div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field name="borne_marque" label="Marque de la borne" />
              <Field name="borne_modele" label="Modèle" />
              <Field name="borne_puissance" label="Puissance (kW)" />
              <Field name="borne_serie" label="N° de série" />
            </div>
          </section>

          {/* Mesures */}
          <section className="bg-card border border-border rounded-sm p-6">
            <div className="text-mono text-muted-foreground mb-4">Mesures relevées</div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {MESURES.map((m) => (
                <label key={m.key} className="block">
                  <span className="text-xs text-muted-foreground">
                    {m.label} {m.unit ? `(${m.unit})` : ""}
                  </span>
                  <input
                    value={mesures[m.key] ?? ""}
                    placeholder={m.placeholder}
                    onChange={(e) => setMesures((v) => ({ ...v, [m.key]: e.target.value }))}
                    className="mt-1 w-full bg-background border border-border rounded-sm px-3 py-2 text-sm focus:border-primary outline-none"
                  />
                </label>
              ))}
            </div>
          </section>

          {/* Checklist */}
          <section className="space-y-5">
            <div className="flex items-end justify-between gap-4 flex-wrap">
              <div>
                <div className="text-mono text-primary">Points de contrôle</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {filled} / {total} points renseignés
                </p>
              </div>
              <div className="flex gap-2 text-mono text-xs">
                <button type="button" onClick={() => setAll("ok")} className="border border-border rounded-sm px-3 py-1.5 hover:border-primary hover:text-primary">
                  Tout conforme
                </button>
                <button type="button" onClick={() => setChecks({})} className="border border-border rounded-sm px-3 py-1.5 hover:border-primary hover:text-primary">
                  Réinitialiser
                </button>
              </div>
            </div>

            {CHECKLIST.map((section) => (
              <div key={section.key} className="bg-card border border-border rounded-sm">
                <div className="flex items-center justify-between gap-4 px-5 py-3 border-b border-border">
                  <div className="font-medium text-sm">{section.title}</div>
                  <button
                    type="button"
                    onClick={() => setAllSection(section.key, "ok")}
                    className="text-mono text-[11px] text-muted-foreground hover:text-primary"
                  >
                    Tout conforme
                  </button>
                </div>
                <ul className="divide-y divide-border">
                  {section.items.map((item) => {
                    const key = `${section.key}.${item.key}`;
                    return (
                      <li key={key} className="px-5 py-3 flex items-center justify-between gap-4 flex-wrap">
                        <span className="text-sm flex-1 min-w-[200px]">{item.label}</span>
                        <div className="flex gap-1">
                          {(["ok", "nc", "na"] as CheckState[]).map((state) => (
                            <button
                              key={state}
                              type="button"
                              onClick={() =>
                                setChecks((c) => {
                                  const next = { ...c };
                                  if (next[key] === state) delete next[key];
                                  else next[key] = state;
                                  return next;
                                })
                              }
                              className={`text-mono text-[11px] rounded-sm px-2.5 py-1 border transition ${
                                checks[key] === state
                                  ? state === "nc"
                                    ? "border-destructive bg-destructive/15 text-destructive"
                                    : "border-primary bg-primary/15 text-primary"
                                  : "border-border text-muted-foreground hover:border-primary/50"
                              }`}
                            >
                              {CHECK_LABEL[state]}
                            </button>
                          ))}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </section>

          {/* Observations */}
          <section className="bg-card border border-border rounded-sm p-6 space-y-4">
            <label className="block">
              <span className="text-xs text-muted-foreground">Observations / travaux réalisés</span>
              <textarea name="observations" rows={4} className="mt-1 w-full bg-background border border-border rounded-sm px-3 py-2 text-sm focus:border-primary outline-none" />
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">Réserves / points à reprendre</span>
              <textarea name="reserves" rows={3} className="mt-1 w-full bg-background border border-border rounded-sm px-3 py-2 text-sm focus:border-primary outline-none" />
            </label>
          </section>

          {/* Signatures */}
          <section className="bg-card border border-border rounded-sm p-6 space-y-6">
            <div className="text-mono text-muted-foreground">Signatures</div>
            <div className="grid sm:grid-cols-2 gap-6">
              <SignaturePad label="Technicien IRVE Technologie" value={sigTech} onChange={setSigTech} />
              <div>
                <SignaturePad label="Client" value={sigClient} onChange={setSigClient} />
                <label className="block mt-3">
                  <span className="text-xs text-muted-foreground">Nom du signataire client</span>
                  <input name="signataire_client" className="mt-1 w-full bg-background border border-border rounded-sm px-3 py-2 text-sm focus:border-primary outline-none" />
                </label>
              </div>
            </div>
          </section>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <button
            type="submit"
            disabled={create.isPending}
            className="hero-grad text-primary-foreground rounded-sm px-6 py-3.5 text-mono inline-flex items-center gap-2 disabled:opacity-60"
          >
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            Générer le rapport
          </button>
        </form>

        {/* Historique */}
        <aside className="bg-card border border-border rounded-sm p-5">
          <div className="text-mono text-muted-foreground mb-3">Derniers rapports</div>
          {rapports.isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : !rapports.data?.length ? (
            <p className="text-xs text-muted-foreground">Aucun rapport pour le moment.</p>
          ) : (
            <ul className="divide-y divide-border">
              {rapports.data.map((r) => (
                <li key={r.id} className="py-3 flex items-start justify-between gap-2">
                  <Link to="/rapports/$id" params={{ id: r.id }} className="min-w-0 group">
                    <div className="text-mono text-sm text-primary group-hover:underline">{r.numero}</div>
                    <div className="text-xs truncate">{r.client_nom}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {dateFr(r.date_intervention)} · {RAPPORT_TYPES[r.type as RapportType]?.label ?? r.type}
                    </div>
                  </Link>
                  <button
                    type="button"
                    onClick={() => remove.mutate(r.id)}
                    className="text-muted-foreground hover:text-destructive"
                    aria-label="Supprimer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}

function Field({
  name,
  label,
  type = "text",
  required,
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="text-xs text-muted-foreground">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="mt-1 w-full bg-background border border-border rounded-sm px-3 py-2 text-sm focus:border-primary outline-none"
      />
    </label>
  );
}
