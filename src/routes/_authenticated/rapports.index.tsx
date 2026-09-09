import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, ClipboardCheck, FileText, Loader2, Trash2, X } from "lucide-react";
import {
  CHECK_LABEL,
  type CheckState,
  PHOTOS_REQUISES,
  type PhotoKind,
  RAPPORT_TYPES,
  type RapportType,
  checklistFor,
  checklistForMode,
  mesuresFor,
  allOk,
  TYPOLOGIES,
  type Typologie,
  type ChecklistMode,
  mesuresFromTypologie,
} from "@/lib/rapport-checklist";
import {
  createRapport,
  deleteRapport,
  getRapportPrefill,
  listRapportSources,
  listRapports,
  uploadRapportPhoto,
  type RapportInput,
} from "@/lib/rapports.functions";
import { SignaturePad } from "@/components/SignaturePad";
import { ProShell } from "@/components/ProShell";
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

  const [type, setType] = useState<RapportType>("assurance");
  const [mode, setMode] = useState<ChecklistMode>("essentiel");
  const [typologie, setTypologie] = useState<Typologie>({});
  const [sourceKind, setSourceKind] = useState<"devis" | "rendezvous">("devis");
  const [sourceId, setSourceId] = useState("");
  const [prefill, setPrefill] = useState<Record<string, string>>({});
  const [prefillKey, setPrefillKey] = useState(0);
  const [checks, setChecks] = useState<Record<string, CheckState>>({});
  const [mesures, setMesures] = useState<Record<string, string>>({});
  const [photos, setPhotos] = useState<Partial<Record<PhotoKind, string>>>({});
  const [sigTech, setSigTech] = useState<string | null>(null);
  const [sigClient, setSigClient] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [linked, setLinked] = useState<{ devis_id: string | null; rendezvous_id: string | null }>({
    devis_id: null,
    rendezvous_id: null,
  });
  const formRef = useRef<HTMLFormElement | null>(null);
  const [restaure, setRestaure] = useState(false);

  /* -------- Brouillon local : rien n'est perdu si l'app se recharge -------- */
  const DRAFT_KEY = "rapport-brouillon-v1";
  const TEXT_FIELDS = [
    "client_nom",
    "date",
    "client_telephone",
    "client_email",
    "chantier_adresse",
    "chantier_cp_ville",
    "technicien",
    "borne_marque",
    "borne_modele",
    "borne_puissance",
    "borne_serie",
    "observations",
    "reserves",
    "signataire_client",
  ];

  function readFields(): Record<string, string> {
    const form = formRef.current;
    if (!form) return {};
    const fd = new FormData(form);
    const out: Record<string, string> = {};
    for (const k of TEXT_FIELDS) {
      const v = fd.get(k);
      if (typeof v === "string" && v) out[k] = v;
    }
    return out;
  }

  function saveDraft() {
    if (typeof window === "undefined" || !restaure) return;
    try {
      window.localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          at: Date.now(),
          type,
          mode,
          typologie,
          checks,
          mesures,
          photos,
          sigTech,
          sigClient,
          linked,
          fields: readFields(),
        }),
      );
    } catch {
      /* mémoire du téléphone pleine : on continue sans brouillon */
    }
  }

  function clearDraft() {
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      /* ignore */
    }
  }

  // Restauration au chargement (mobile : l'app peut être fermée à tout moment).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw) as Record<string, unknown>;
        if (d && typeof d === "object") {
          if (typeof d.type === "string") setType(d.type as RapportType);
          if (typeof d.mode === "string") setMode(d.mode as ChecklistMode);
          if (d.typologie) setTypologie(d.typologie as Typologie);
          if (d.checks) setChecks(d.checks as Record<string, CheckState>);
          if (d.mesures) setMesures(d.mesures as Record<string, string>);
          if (d.photos) setPhotos(d.photos as Partial<Record<PhotoKind, string>>);
          if (typeof d.sigTech === "string") setSigTech(d.sigTech);
          if (typeof d.sigClient === "string") setSigClient(d.sigClient);
          if (d.linked) setLinked(d.linked as { devis_id: string | null; rendezvous_id: string | null });
          const fields = (d.fields ?? {}) as Record<string, string>;
          if (Object.keys(fields).length) {
            setPrefill(fields);
            setPrefillKey((k) => k + 1);
            requestAnimationFrame(() => {
              const form = formRef.current;
              if (!form) return;
              for (const [k, v] of Object.entries(fields)) {
                const el = form.elements.namedItem(k) as HTMLInputElement | HTMLTextAreaElement | null;
                if (el && "value" in el) el.value = v;
              }
            });
          }
        }
      }
    } catch {
      /* brouillon illisible : on repart d'un rapport vierge */
    }
    setRestaure(true);
  }, []);

  // Enregistrement automatique du brouillon dès qu'un choix change.
  useEffect(() => {
    if (!restaure) return;
    const t = setTimeout(saveDraft, 400);
    return () => clearTimeout(t);
  }, [restaure, type, mode, typologie, checks, mesures, photos, sigTech, sigClient, linked]);

  const sections = useMemo(() => checklistForMode(type, mode), [type, mode]);
  const mesureFields = mesuresFor(type);
  const uploadPhoto = useServerFn(uploadRapportPhoto);
  const fetchSources = useServerFn(listRapportSources);
  const fetchPrefill = useServerFn(getRapportPrefill);

  const sources = useQuery({ queryKey: ["rapport-sources"], queryFn: () => fetchSources() });

  // Mode Essentiel : tous les points sont préréglés « conforme ».
  useEffect(() => {
    if (mode === "essentiel") setChecks(allOk(checklistForMode(type, "essentiel")));
  }, [mode, type]);

  const reprendre = useMutation({
    mutationFn: async () => {
      if (!sourceId) throw new Error("Choisissez un devis ou un chantier.");
      return fetchPrefill({
        data: sourceKind === "devis" ? { devis_id: sourceId } : { rendezvous_id: sourceId },
      });
    },
    onSuccess: (d) => {
      setPrefill({
        client_nom: d.client_nom ?? "",
        client_email: d.client_email ?? "",
        client_telephone: d.client_telephone ?? "",
        chantier_adresse: d.chantier_adresse ?? "",
        chantier_cp_ville: d.chantier_cp_ville ?? "",
        technicien: d.technicien ?? "",
        date: d.date_intervention ?? today(),
        borne_puissance: d.borne_puissance ?? "",
      });
      setPrefillKey((k) => k + 1);
      setLinked({ devis_id: d.devis_id ?? null, rendezvous_id: d.rendezvous_id ?? null });
      if (d.longueur) setMesures((m) => ({ ...m, longueur: d.longueur!.replace(".", ",") }));
      if (d.borne_puissance) {
        const p = d.borne_puissance.replace(".", ",").replace(/\s+/g, " ");
        setTypologie((t) => ({ ...t, puissance: t.puissance ?? p }));
      }
    },
    onError: (e) => setError(e instanceof Error ? e.message : "Reprise impossible."),
  });

  function pickTypologie(key: keyof Typologie, value: string) {
    const next: Typologie = { ...typologie, [key]: typologie[key] === value ? undefined : value };
    setTypologie(next);
    setMesures((m) => mesuresFromTypologie(next, m));
  }

  const [envoi, setEnvoi] = useState<string | null>(null);

  /** Réessaie une action réseau : indispensable en 4G instable sur chantier. */
  async function withRetry<T>(fn: () => Promise<T>, tries = 3): Promise<T> {
    let last: unknown;
    for (let i = 0; i < tries; i++) {
      try {
        return await fn();
      } catch (e) {
        last = e;
        await new Promise((r) => setTimeout(r, 700 * (i + 1)));
      }
    }
    throw last instanceof Error ? last : new Error("Connexion interrompue.");
  }

  const create = useMutation({
    mutationFn: async (payload: RapportInput) => {
      setEnvoi("Enregistrement du rapport…");
      const res = await withRetry(() => createFn({ data: payload }));
      const aEnvoyer = Object.entries(photos).filter(([, v]) => Boolean(v));
      let i = 0;
      let echecs = 0;
      for (const [kind, data_url] of aEnvoyer) {
        i++;
        setEnvoi(`Envoi des photos ${i}/${aEnvoyer.length}…`);
        try {
          await withRetry(() =>
            uploadPhoto({ data: { rapport_id: res.id, kind: kind as PhotoKind, data_url: data_url! } }),
          );
        } catch {
          echecs++;
        }
      }
      return { ...res, echecs };
    },
    onSuccess: (res) => {
      setEnvoi(null);
      clearDraft();
      qc.invalidateQueries({ queryKey: ["rapports"] });
      if (res.echecs) {
        setError(
          `Rapport enregistré, mais ${res.echecs} photo(s) n'ont pas pu être envoyées. Vous pourrez les rajouter avec une meilleure connexion.`,
        );
      }
      navigate({ to: "/rapports/$id", params: { id: res.id } });
    },
    onError: (e) => {
      setEnvoi(null);
      const msg = e instanceof Error ? e.message : "";
      setError(
        /fetch|network|réseau|Failed/i.test(msg)
          ? "Connexion perdue. Votre saisie est conservée sur le téléphone : réessayez dès que le réseau revient."
          : msg || "Enregistrement impossible. Votre saisie est conservée, réessayez.",
      );
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rapports"] }),
  });

  function setAllSection(sectionKey: string, state: CheckState) {
    const section = sections.find((s) => s.key === sectionKey);
    if (!section) return;
    setChecks((c) => {
      const next = { ...c };
      for (const item of section.items) next[`${sectionKey}.${item.key}`] = state;
      return next;
    });
  }

  function setAll(state: CheckState) {
    const next: Record<string, CheckState> = {};
    for (const s of sections) for (const i of s.items) next[`${s.key}.${i.key}`] = state;
    setChecks(next);
  }

  async function onPickPhoto(kind: PhotoKind, file: File | undefined) {
    if (!file) return;
    try {
      const dataUrl = await compressImage(file);
      setPhotos((p) => ({ ...p, [kind]: dataUrl }));
    } catch {
      setError("Photo illisible, merci de réessayer.");
    }
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
      typologie: Object.fromEntries(Object.entries(typologie).filter(([, v]) => Boolean(v))) as Record<string, string>,
      devis_id: linked.devis_id,
      rendezvous_id: linked.rendezvous_id,
      
      checklist: checks,
      observations: get("observations") || null,
      reserves: get("reserves") || null,
      signature_technicien: sigTech,
      signature_client: sigClient,
      signataire_client: get("signataire_client") || null,
    });
  }

  const total = sections.reduce((s, sec) => s + sec.items.length, 0);
  const filled = Object.keys(checks).length;


  return (
    <ProShell>
      <div className="pro-workspace">
      <div className="mb-8">
        <div className="pro-kicker flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4" /> Contrôle terrain
        </div>
        <h1 className="pro-title mt-2 text-3xl sm:text-5xl">Rapports d’intervention</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Une saisie guidée, enregistrée automatiquement sur votre appareil.
        </p>
      </div>
      </div>


      <div className="grid lg:grid-cols-[1fr_300px] gap-10 items-start">
        <form
          ref={formRef}
          onSubmit={onSubmit}
          onInput={saveDraft}
          onChange={saveDraft}
          className="space-y-8"
        >
          {/* Type */}
          <section className="bg-card border border-border rounded-sm p-6">
            <div className="text-mono text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground mb-3">Type de rapport</div>
            <div className="grid sm:grid-cols-3 gap-3">
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

          {/* Reprise d'un devis ou d'un chantier */}
          <section className="bg-card border border-border rounded-sm p-6">
            <div className="text-mono text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground mb-1">
              Reprendre un devis / un chantier
            </div>
            <p className="text-xs text-muted-foreground">
              Le client, l'adresse, la puissance et le métrage sont repris automatiquement — tout reste modifiable.
            </p>
            <div className="mt-4 flex flex-wrap items-end gap-3">
              <div className="flex gap-1">
                {(["devis", "rendezvous"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => {
                      setSourceKind(k);
                      setSourceId("");
                    }}
                    className={`text-mono text-[11px] rounded-sm px-3 py-2 border transition ${
                      sourceKind === k ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {k === "devis" ? "Devis" : "Chantier"}
                  </button>
                ))}
              </div>
              <select
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                className="flex-1 min-w-[220px] bg-background border border-border rounded-sm px-3 py-2 text-sm focus:border-primary outline-none"
              >
                <option value="">— Choisir —</option>
                {sourceKind === "devis"
                  ? (sources.data?.devis ?? []).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.numero} · {d.client_nom}
                      </option>
                    ))
                  : (sources.data?.rendezvous ?? []).map((r) => (
                      <option key={r.id} value={r.id}>
                        {dateFr(r.date_debut)} · {r.client_nom} — {r.titre}
                      </option>
                    ))}
              </select>
              <button
                type="button"
                disabled={!sourceId || reprendre.isPending}
                onClick={() => reprendre.mutate()}
                className="hero-grad text-primary-foreground rounded-sm px-4 py-2 text-mono text-[11px] inline-flex items-center gap-2 disabled:opacity-50"
              >
                {reprendre.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Remplir automatiquement
              </button>
            </div>
          </section>

          {/* Typologie */}
          <section className="bg-card border border-border rounded-sm p-6 space-y-5">
            <div>
              <div className="text-mono text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground mb-1">
                Typologie de l'installation
              </div>
              <p className="text-xs text-muted-foreground">
                Un clic renseigne la puissance, le calibre du disjoncteur, la section de câble et la tension.
              </p>
            </div>
            {TYPOLOGIES.map((g) => (
              <div key={g.key}>
                <div className="text-xs text-muted-foreground mb-2">{g.label}</div>
                <div className="flex flex-wrap gap-2">
                  {g.options.map((o) => (
                    <button
                      key={o}
                      type="button"
                      onClick={() => pickTypologie(g.key, o)}
                      className={`text-mono text-[11px] rounded-sm px-3 py-2 border transition ${
                        typologie[g.key] === o
                          ? "border-primary bg-primary/15 text-primary"
                          : "border-border text-muted-foreground hover:border-primary/50"
                      }`}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </section>

          {/* Client & chantier */}
          <section className="bg-card border border-border rounded-sm p-6 space-y-4">
            <div className="text-mono text-muted-foreground">Client & chantier</div>
            <div key={prefillKey} className="grid sm:grid-cols-2 gap-4">
              <Field name="client_nom" label="Nom du client *" required defaultValue={prefill.client_nom} />
              <Field name="date" label="Date d'intervention" type="date" defaultValue={prefill.date ?? today()} />
              <Field name="client_telephone" label="Téléphone" defaultValue={prefill.client_telephone} />
              <Field name="client_email" label="Email" type="email" defaultValue={prefill.client_email} />
              <Field name="chantier_adresse" label="Adresse du chantier" defaultValue={prefill.chantier_adresse} />
              <Field name="chantier_cp_ville" label="CP / Ville" defaultValue={prefill.chantier_cp_ville} />
              <Field name="technicien" label="Technicien" defaultValue={prefill.technicien} />
            </div>
          </section>

          {/* Borne */}
          <section className="bg-card border border-border rounded-sm p-6 space-y-4">
            <div className="text-mono text-muted-foreground">Matériel installé</div>
            <div className="grid sm:grid-cols-2 gap-4">
              <Field name="borne_marque" label="Marque de la borne" />
              <Field name="borne_modele" label="Modèle" />
              <Field key={prefillKey} name="borne_puissance" label="Puissance (kW)" defaultValue={prefill.borne_puissance} />
              <Field name="borne_serie" label="N° de série" />
            </div>
          </section>

          {/* Mesures */}
          <section className="bg-card border border-border rounded-sm p-6">
            <div className="text-mono text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground mb-1">Mesures relevées</div>
            {type === "assurance" && (
              <p className="text-xs text-muted-foreground mb-4">
                Renseignez les valeurs chiffrées : un assureur n'accepte pas la seule mention « conforme ».
              </p>
            )}
            <div className="mt-3 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {mesureFields.map((m) => (
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

          {/* Photos justificatives */}
          <section className="bg-card border border-border rounded-sm p-6">
            <div className="text-mono text-muted-foreground">Photos justificatives</div>
            <p className="text-xs text-muted-foreground mt-1">
              4 photos attendues par l'assureur — elles sont joignables au rapport imprimé.
            </p>
            <div className="mt-4 grid sm:grid-cols-2 gap-4">
              {PHOTOS_REQUISES.map((p) => {
                const value = photos[p.key];
                return (
                  <div key={p.key} className="border border-border rounded-sm p-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs">{p.label}</span>
                      {value && (
                        <button
                          type="button"
                          onClick={() => setPhotos((v) => ({ ...v, [p.key]: undefined }))}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Retirer la photo"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    {value ? (
                      <img src={value} alt={p.label} className="mt-2 w-full h-32 object-cover rounded-sm" />
                    ) : (
                      <label className="mt-2 h-32 grid place-items-center border border-dashed border-border rounded-sm cursor-pointer hover:border-primary text-muted-foreground">
                        <span className="inline-flex items-center gap-2 text-mono text-[11px]">
                          <Camera className="h-4 w-4" /> Ajouter
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={(e) => onPickPhoto(p.key, e.target.files?.[0])}
                        />
                      </label>
                    )}
                  </div>
                );
              })}
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
              <div className="flex flex-wrap gap-2 text-mono text-xs">
                {(["essentiel", "complet"] as ChecklistMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`rounded-sm px-3 py-1.5 border transition ${
                      mode === m ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {m === "essentiel" ? "Essentiel" : "Complet"}
                  </button>
                ))}
                <button type="button" onClick={() => setAll("ok")} className="border border-border rounded-sm px-3 py-1.5 hover:border-primary hover:text-primary">
                  Tout conforme
                </button>
                <button type="button" onClick={() => setChecks({})} className="border border-border rounded-sm px-3 py-1.5 hover:border-primary hover:text-primary">
                  Réinitialiser
                </button>
              </div>
            </div>

            {sections.map((section) => (
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
          {envoi && <p className="text-sm text-muted-foreground">{envoi}</p>}
          <p className="text-xs text-muted-foreground">
            Votre saisie est enregistrée automatiquement sur l'appareil : si l'application se ferme,
            vous retrouvez tout en revenant sur cette page.
          </p>

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
          <div className="text-mono text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground mb-3">Derniers rapports</div>
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
    </ProShell>
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
