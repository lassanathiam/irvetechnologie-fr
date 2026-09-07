import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  FileCheck2,
  Euro,
  Fuel,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  Route as RouteIcon,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import {
  createRendezVous,
  deleteRendezVous,
  listRendezVous,
  updateStatutRendezVous,
  updateAdresseRendezVous,
  validerChantier,
  updateFacturationRdv,
  type RendezVousInput,
} from "@/lib/planning.functions";
import {
  deleteVoirie,
  listVoirie,
  saveVoirie,
  VOIRIE_STATUTS,
  type VoirieInput,
} from "@/lib/voirie.functions";
import { ProShell } from "@/components/ProShell";
import { InterventionsMap, STATUT_COLORS, type MapMarker } from "@/components/InterventionsMap";
import { itineraireDepuisBase, tourneeReelle } from "@/lib/routing.functions";
import { AgendaMois } from "@/components/AgendaMois";
import { AdresseFields } from "@/components/AdresseFields";
import { dureeFr, TECHNICIENS, technicienByNom } from "@/lib/geo";
import { economieCarburant, groupesProximite, optimiserTournee, planifierCampagne } from "@/lib/tournee";

export const Route = createFileRoute("/_authenticated/planning/")({
  head: () => ({
    meta: [
      { title: "Planning des interventions — Espace pro Borne de l'Ouest" },
      {
        name: "description",
        content:
          "Planification des rendez-vous IRVE : adresse géolocalisée, tournées optimisées, validation de chantier et autorisations de voirie.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PlanningPage,
});

const TYPES = [
  { v: "visite", l: "Visite technique" },
  { v: "installation", l: "Installation" },
  { v: "maintenance", l: "Maintenance" },
  { v: "sav", l: "SAV / dépannage" },
  { v: "controle", l: "Contrôle / conformité" },
] as const;

const STATUTS = [
  { v: "planifie", l: "Planifié" },
  { v: "confirme", l: "Confirmé" },
  { v: "realise", l: "Réalisé" },
  { v: "annule", l: "Annulé" },
] as const;

const VOIRIE_LABEL = Object.fromEntries(VOIRIE_STATUTS.map((s) => [s.v, s.l])) as Record<
  string,
  string
>;

const dateTimeFr = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

const dayKey = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "2-digit", month: "long" }).format(
    new Date(iso),
  );

const MAX_DOC = 8_000_000;

const FACTU_LABEL: Record<string, string> = {
  a_facturer: "à facturer",
  facture: "facturé",
  paye: "payé",
};

const ETIQUETTES_SUGGEREES = [
  "Borne 7,4 kW",
  "Borne 11 kW",
  "Borne 22 kW",
  "Maison",
  "Copropriété",
  "Entreprise",
  "Tranchée",
  "Voirie",
  "Urgent",
  "SAV",
];

const parseEtiquettes = (v: string) =>
  v
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 12);


const eurosFr = (n: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
    .format(n);

function PlanningPage() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listRendezVous);
  const createFn = useServerFn(createRendezVous);
  const statutFn = useServerFn(updateStatutRendezVous);
  const deleteFn = useServerFn(deleteRendezVous);
  const validerFn = useServerFn(validerChantier);
  const fetchVoirie = useServerFn(listVoirie);
  const saveVoirieFn = useServerFn(saveVoirie);
  const deleteVoirieFn = useServerFn(deleteVoirie);

  const list = useQuery({ queryKey: ["rendezvous"], queryFn: () => fetchList() });
  const voirie = useQuery({ queryKey: ["voirie"], queryFn: () => fetchVoirie() });
  const [active, setActive] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [panel, setPanel] = useState<{
    id: string;
    tab: "chantier" | "voirie" | "montant" | "adresse";
  } | null>(null);
  const [prefillDate, setPrefillDate] = useState<string>("");

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["rendezvous"] });
    qc.invalidateQueries({ queryKey: ["voirie"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const create = useMutation({
    mutationFn: (payload: RendezVousInput) => createFn({ data: payload }),
    onSuccess: () => {
      setOpen(false);
      setError(null);
      refresh();
    },
    onError: (e: unknown) =>
      setError(e instanceof Error ? e.message : "Enregistrement impossible."),
  });

  const setStatut = useMutation({
    mutationFn: (p: { id: string; statut: string }) => statutFn({ data: p }),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: refresh,
  });
  const valider = useMutation({
    mutationFn: (p: { id: string; valide: boolean; commentaire?: string | null; par?: string | null }) =>
      validerFn({ data: p }),
    onSuccess: () => {
      setPanel(null);
      refresh();
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : "Validation impossible."),
  });
  const saveVoirieMut = useMutation({
    mutationFn: (payload: VoirieInput) => saveVoirieFn({ data: payload }),
    onSuccess: () => {
      setPanel(null);
      setError(null);
      refresh();
    },
    onError: (e: unknown) =>
      setError(e instanceof Error ? e.message : "Enregistrement de l'autorisation impossible."),
  });
  const factuFn = useServerFn(updateFacturationRdv);
  const setFacturation = useMutation({
    mutationFn: (p: {
      id: string;
      origine: "direct" | "sous_traitance";
      partenaire?: string | null;
      montant_ht: number;
      tva_pct?: number;
      statut_facturation: "a_facturer" | "facture" | "paye";
      designation?: string | null;
      etiquettes?: string[];

    }) => factuFn({ data: p }),
    onSuccess: () => {
      setPanel(null);
      setError(null);
      refresh();
    },
    onError: (e: unknown) => setError(e instanceof Error ? e.message : "Enregistrement impossible."),
  });
  const adresseFn = useServerFn(updateAdresseRendezVous);
  const setAdresse = useMutation({
    mutationFn: (p: { id: string; adresse: string; cp_ville?: string | null }) =>
      adresseFn({ data: p }),
    onSuccess: () => {
      setPanel(null);
      setError(null);
      refresh();
    },
    onError: (e: unknown) =>
      setError(e instanceof Error ? e.message : "Modification de l'adresse impossible."),
  });
  const removeVoirie = useMutation({
    mutationFn: (id: string) => deleteVoirieFn({ data: { id } }),
    onSuccess: refresh,
  });

  const rows = list.data ?? [];
  /** Technicien dont on calcule les trajets (son domicile est le point de départ). */
  const [departId, setDepartId] = useState(TECHNICIENS[0]!.id);
  const depart = TECHNICIENS.find((t) => t.id === departId) ?? TECHNICIENS[0]!;
  const voirieByRdv = useMemo(() => {
    type Row = NonNullable<typeof voirie.data>[number];
    const m = new Map<string, Row>();
    for (const v of voirie.data ?? []) if (!m.has(v.rendezvous_id)) m.set(v.rendezvous_id, v);
    return m;
  }, [voirie.data]);

  const groups = useMemo(() => {
    const map = new Map<string, typeof rows>();
    for (const r of rows) {
      const k = dayKey(r.date_debut);
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return [...map.entries()];
  }, [rows]);

  const points: MapMarker[] = rows
    .filter((r) => r.lat != null && r.lng != null)
    .map((r) => ({
      id: r.id,
      lat: Number(r.lat),
      lng: Number(r.lng),
      label: r.client_nom,
      sub: [r.adresse, r.cp_ville].filter(Boolean).join(", "),
      statut: r.statut,
      date: dateTimeFr(r.date_debut),
    }));

  /** Chantiers à venir non annulés : base de la tournée optimisée. */
  const aVenir = useMemo(
    () =>
      rows.filter(
        (r) =>
          r.lat != null &&
          r.lng != null &&
          r.statut !== "annule" &&
          new Date(r.date_debut).getTime() >= Date.now() - 12 * 3600e3 &&
          // Chantiers du technicien sélectionné + chantiers encore sans technicien.
          (!r.technicien?.trim() || technicienByNom(r.technicien)?.id === depart.id),
      ),
    [rows, depart.id],
  );

  const asStop = (r: (typeof rows)[number]) => ({
    id: r.id,
    lat: Number(r.lat),
    lng: Number(r.lng),
    label: r.client_nom,
    sub: r.cp_ville,
  });

  /** Chantiers regroupés par journée : une tournée ne peut concerner qu'un seul jour. */
  const joursDispo = useMemo(() => {
    const m = new Map<string, { key: string; label: string; stops: ReturnType<typeof asStop>[] }>();
    for (const r of aVenir) {
      const d = new Date(r.date_debut);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const entry = m.get(key) ?? { key, label: dayKey(r.date_debut), stops: [] };
      entry.stops.push(asStop(r));
      m.set(key, entry);
    }
    return [...m.values()].sort((a, b) => a.key.localeCompare(b.key));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aVenir]);

  const [jourSel, setJourSel] = useState<string | null>(null);
  const jourActif =
    (jourSel ? joursDispo.find((j) => j.key === jourSel) : undefined) ?? joursDispo[0] ?? null;
  const stopsJour = jourActif?.stops ?? [];

  const tournee = useMemo(() => optimiserTournee(stopsJour, depart), [stopsJour, depart]);

  /** Campagne sur plusieurs jours (chantiers éloignés : une nuitée sur place). */
  const [horizon, setHorizon] = useState(7);
  const [campagneOn, setCampagneOn] = useState(false);
  const campagne = useMemo(
    () =>
      campagneOn ? planifierCampagne(aVenir.map(asStop), depart, { jours: horizon }) : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [campagneOn, horizon, aVenir, depart],
  );

  const grappes = useMemo(
    () => groupesProximite(aVenir.map(asStop)).filter((g) => g.length > 1),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [aVenir],
  );

  const economie = economieCarburant(Math.max(tournee.kmDirect - tournee.kmTotal, 0));

  /** Itinéraire routier réel base → chantier sélectionné. */
  const routeFn = useServerFn(itineraireDepuisBase);
  const activeRow = rows.find((r) => r.id === active && r.lat != null && r.lng != null);
  const itineraire = useQuery({
    queryKey: ["itineraire", activeRow?.id, depart.id],
    enabled: !!activeRow,
    staleTime: 30 * 60_000,
    queryFn: () =>
      routeFn({
        data: {
          lat: Number(activeRow!.lat),
          lng: Number(activeRow!.lng),
          base: { lat: depart.lat, lng: depart.lng },
        },
      }),
  });

  /** Tournée de la journée sélectionnée, sur le réseau routier réel. */
  const tourneeFn = useServerFn(tourneeReelle);
  const tourneeStops = useMemo(() => stopsJour.slice(0, 10), [stopsJour]);
  const tourneeReel = useQuery({
    queryKey: ["tournee-reelle", depart.id, tourneeStops.map((s) => s.id).join(",")],
    enabled: tourneeStops.length > 0,
    staleTime: 30 * 60_000,
    queryFn: () =>
      tourneeFn({ data: { stops: tourneeStops, base: { lat: depart.lat, lng: depart.lng } } }),
  });

  /** Données affichées : routier réel si disponible, sinon estimation locale. */
  const tourneeAff =
    tourneeReel.data && tourneeReel.data.etapes.length
      ? {
          etapes: tourneeReel.data.etapes,
          kmTotal: tourneeReel.data.kmTotal,
          minutes: tourneeReel.data.minutes,
          kmDirect: tourneeReel.data.kmSepares,
        }
      : { ...tournee, kmDirect: tournee.kmDirect };


  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const get = (k: string) => String(f.get(k) ?? "").trim();
    if (!get("client_nom")) {
      setError("Merci d'indiquer le nom du client.");
      return;
    }
    if (!get("adresse")) {
      setError("Merci d'indiquer l'adresse du chantier.");
      return;
    }
    const d = new Date(get("date_debut"));
    if (Number.isNaN(d.getTime())) {
      setError("Merci d'indiquer la date et l'heure du rendez-vous.");
      return;
    }
    setError(null);
    create.mutate({
      titre: get("titre") || "Intervention",
      type: get("type") as RendezVousInput["type"],
      statut: "planifie",
      client_nom: get("client_nom"),
      client_telephone: get("client_telephone") || null,
      client_email: get("client_email") || null,
      adresse: get("adresse"),
      cp_ville: get("cp_ville") || null,
      date_debut: d.toISOString(),

      duree_min: Number(get("duree_min") || 120),
      technicien: get("technicien") || null,
      notes: get("notes") || null,
      origine: (get("origine") || "direct") as "direct" | "sous_traitance",
      partenaire: get("partenaire") || null,
      montant_ht: Number(get("montant_ht") || 0),
      tva_pct: Number(get("tva_pct") || 20),
      statut_facturation: "a_facturer",
      designation: get("designation") || null,
      etiquettes: parseEtiquettes(get("etiquettes")),

    });
  }

  async function onVoirieSubmit(e: React.FormEvent<HTMLFormElement>, rdvId: string, existingId?: string) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = new FormData(form);
    const get = (k: string) => String(f.get(k) ?? "").trim();
    const file = f.get("document") as File | null;
    let data_url: string | null = null;
    if (file && file.size > 0) {
      if (file.size > MAX_DOC) {
        setError("Document trop lourd (8 Mo maximum).");
        return;
      }
      data_url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("Lecture du fichier impossible."));
        reader.readAsDataURL(file);
      });
    }
    saveVoirieMut.mutate({
      id: existingId ?? null,
      rendezvous_id: rdvId,
      statut: (get("statut") || "en_attente") as VoirieInput["statut"],
      reference: get("reference") || null,
      autorite: get("autorite") || null,
      date_demande: get("date_demande") || null,
      date_obtention: get("date_obtention") || null,
      date_fin: get("date_fin") || null,
      notes: get("notes") || null,
      data_url,
      file_name: file && file.size > 0 ? file.name : null,
    });
  }

  return (
    <ProShell>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-mono text-primary">Planning</p>
          <h1 className="text-2xl font-extrabold tracking-tight mt-1">
            Chantiers, tournées & autorisations
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Adresse géolocalisée automatiquement, tournée optimisée, validation de chantier et
            autorisation de voirie.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="hero-grad text-primary-foreground text-mono text-xs px-4 py-2.5 rounded-sm inline-flex items-center gap-2"
        >
          <Plus className="h-4 w-4" /> {open ? "Fermer" : "Nouveau rendez-vous"}
        </button>
      </div>

      {open && (
        <form
          onSubmit={onSubmit}
          className="bg-card border border-border rounded-xl p-5 shadow-sm mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
        >
          <Field label="Client" name="client_nom" required />
          <Field label="Téléphone" name="client_telephone" />
          <Field label="Email" name="client_email" type="email" />
          <AdresseFields required />
          <label className="block">
            <span className="text-mono text-xs text-muted-foreground">Type</span>
            <select
              name="type"
              defaultValue="installation"
              className="mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm"
            >
              {TYPES.map((t) => (
                <option key={t.v} value={t.v}>
                  {t.l}
                </option>
              ))}
            </select>
          </label>
          <Field
            key={prefillDate}
            label="Date & heure"
            name="date_debut"
            type="datetime-local"
            required
            defaultValue={prefillDate ? `${prefillDate}T09:00` : undefined}
          />
          <Field label="Durée sur site (min)" name="duree_min" type="number" defaultValue="120" />
          <label className="block">
            <span className="text-mono text-xs text-muted-foreground">Technicien</span>
            <select
              name="technicien"
              defaultValue={depart.nom}
              className="mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
            >
              <option value="">À attribuer</option>
              {TECHNICIENS.map((t) => (
                <option key={t.id} value={t.nom}>
                  {t.nom} — départ {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-mono text-xs text-muted-foreground">Origine du chantier</span>
            <select
              name="origine"
              defaultValue="direct"
              className="mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm"
            >
              <option value="direct">Client direct</option>
              <option value="sous_traitance">Sous-traitance / partenaire</option>
            </select>
          </label>
          <Field label="Partenaire / donneur d'ordre" name="partenaire" placeholder="Ex. ZePlug" />
          <Field label="Montant convenu HT (€)" name="montant_ht" type="number" defaultValue="0" />
          <Field label="TVA (%)" name="tva_pct" type="number" defaultValue="20" />
          <Field label="Objet" name="titre" placeholder="Pose borne 7,4 kW" />
          <Field
            label="Désignation du chantier"
            name="designation"
            placeholder="Ex. Inter de Rennes — prestation pour PureEnergie"
          />
          <label className="block sm:col-span-2">
            <span className="text-mono text-xs text-muted-foreground">
              Étiquettes (séparées par des virgules)
            </span>
            <input
              name="etiquettes"
              list="etiquettes-suggestions"
              placeholder="Borne 7,4 kW, Copropriété, Urgent"
              className="mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
            />
            <datalist id="etiquettes-suggestions">
              {ETIQUETTES_SUGGEREES.map((e) => (
                <option key={e} value={e} />
              ))}
            </datalist>
          </label>

          <label className="block sm:col-span-2 lg:col-span-2">
            <span className="text-mono text-xs text-muted-foreground">Notes</span>
            <textarea
              name="notes"
              rows={2}
              className="mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm"
            />
          </label>
          <div className="sm:col-span-2 lg:col-span-3 flex items-center gap-4">
            <button
              type="submit"
              disabled={create.isPending}
              className="hero-grad text-primary-foreground text-mono text-xs px-5 py-3 rounded-sm inline-flex items-center gap-2 disabled:opacity-60"
            >
              {create.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Planifier
            </button>
            {error && <p className="text-mono text-xs text-destructive">{error}</p>}
          </div>
        </form>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_400px] items-start">
        {/* CARTE — en haut à gauche */}
        <section className="order-1 bg-card border border-border rounded-xl overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-border flex flex-wrap items-center gap-x-5 gap-y-2">
            <h2 className="text-mono text-xs font-bold uppercase tracking-[0.14em] flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" /> Carte des interventions
            </h2>
            <div className="flex items-center gap-4 text-[11px] font-semibold text-muted-foreground ml-auto">
              <Legende color={STATUT_COLORS.planifie!} label="Programmé" />
              <Legende color={STATUT_COLORS.confirme!} label="Confirmé" />
              <Legende color={STATUT_COLORS.realise!} label="Réalisé / validé" />
              <Legende color={STATUT_COLORS.annule!} label="Annulé" />
            </div>
          </div>
          <div className="p-4">
            <InterventionsMap
              markers={points}
              activeId={active}
              onSelect={setActive}
              height={620}
              scrollWheelZoom
              routeCoords={itineraire.data?.coords ?? null}
              tourneeCoords={tourneeReel.data?.coords ?? null}
            />
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-[11px] font-semibold text-muted-foreground">
              {itineraire.isFetching ? (
                <span className="inline-flex items-center gap-1.5">
                  <Loader2 className="h-3 w-3 animate-spin" /> Calcul de l'itinéraire routier…
                </span>
              ) : itineraire.data ? (
                <span className="text-primary text-mono">
                  {depart.label} → chantier : {itineraire.data.km} km · {dureeFr(itineraire.data.minutes)}
                  {itineraire.data.estime ? " (estimé)" : " par la route"}
                </span>
              ) : (
                <span>Cliquez une intervention pour afficher l'itinéraire routier réel.</span>
              )}
              {tourneeReel.data && tourneeReel.data.etapes.length > 1 && (
                <span>
                  Boucle complète : {tourneeReel.data.kmTotal} km ·{" "}
                  {dureeFr(tourneeReel.data.minutes)}
                </span>
              )}
            </div>
          </div>
        </section>

        <section className="order-3 lg:col-span-2 space-y-6">
          <h2 className="text-mono text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-primary" /> Rendez-vous programmés
          </h2>

          {list.isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          ) : !groups.length ? (
            <p className="text-sm text-muted-foreground">
              Aucun rendez-vous. Créez le premier avec « Nouveau rendez-vous ».
            </p>
          ) : (
            groups.map(([day, items]) => (
              <div key={day}>
                <h2 className="text-mono text-xs text-primary uppercase mb-3">{day}</h2>
                <ul className="grid gap-3 xl:grid-cols-2">

                  {items.map((r) => {
                    const v = voirieByRdv.get(r.id);
                    const isChantierPanel = panel?.id === r.id && panel.tab === "chantier";
                    const isVoiriePanel = panel?.id === r.id && panel.tab === "voirie";
                    const isMontantPanel = panel?.id === r.id && panel.tab === "montant";
                    const isAdressePanel = panel?.id === r.id && panel.tab === "adresse";
                    return (
                      <li
                        key={r.id}
                        onMouseEnter={() => setActive(r.id)}
                        className={`bg-card border rounded-xl p-4 h-fit transition-all duration-200 hover:shadow-md ${
                          active === r.id
                            ? "border-primary shadow-md ring-1 ring-primary/30"
                            : "border-border"
                        }`}

                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-medium">
                              {r.client_nom}
                              <span className="text-muted-foreground font-normal"> — {r.titre}</span>
                            </p>
                            {r.designation && (
                              <p className="text-sm text-primary mt-0.5">{r.designation}</p>
                            )}

                            <p className="text-xs text-muted-foreground mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span className="inline-flex items-center gap-1">
                                <CalendarClock className="h-3 w-3" /> {dateTimeFr(r.date_debut)} ·{" "}
                                {dureeFr(r.duree_min)}
                              </span>
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="h-3 w-3" /> {r.adresse}
                                {r.cp_ville ? `, ${r.cp_ville}` : ""}
                              </span>
                              {r.distance_km != null ? (
                                <span className="inline-flex items-center gap-1 text-mono">
                                  <RouteIcon className="h-3 w-3" />{" "}
                                  {Math.round(Number(r.distance_km))} km ·{" "}
                                  {dureeFr(Number(r.duree_trajet_min ?? 0))}
                                </span>
                              ) : (
                                <span className="text-mono text-destructive">
                                  adresse non géolocalisée
                                </span>
                              )}
                            </p>
                            {r.notes && <p className="text-xs mt-2">{r.notes}</p>}

                            <p className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-mono">
                              <span
                                className={`px-2 py-0.5 rounded-full border ${
                                  r.origine === "sous_traitance"
                                    ? "border-amber-500/50 text-amber-600 dark:text-amber-400"
                                    : "border-primary/40 text-primary"
                                }`}
                              >
                                {r.origine === "sous_traitance"
                                  ? `Sous-traitance${r.partenaire ? ` · ${r.partenaire}` : ""}`
                                  : "Client direct"}
                              </span>
                              <span className="text-muted-foreground">
                                {eurosFr(Number(r.montant_ht ?? 0))} HT ·{" "}
                                {FACTU_LABEL[r.statut_facturation] ?? r.statut_facturation}
                              </span>
                            </p>

                            {Array.isArray(r.etiquettes) && r.etiquettes.length > 0 && (
                              <p className="mt-2 flex flex-wrap gap-1.5">
                                {r.etiquettes.map((et: string) => (
                                  <span
                                    key={et}
                                    className="text-mono text-[10px] px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground border border-border"
                                  >
                                    {et}
                                  </span>
                                ))}
                              </p>
                            )}


                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              {r.chantier_valide ? (
                                <span className="text-mono text-[11px] px-2 py-1 rounded-sm border border-primary/40 text-primary inline-flex items-center gap-1">
                                  <CheckCircle2 className="h-3 w-3" /> Chantier validé
                                  {r.chantier_valide_at
                                    ? ` le ${new Date(r.chantier_valide_at).toLocaleDateString("fr-FR")}`
                                    : ""}
                                </span>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setPanel(isChantierPanel ? null : { id: r.id, tab: "chantier" })
                                  }
                                  className="text-mono text-[11px] px-2 py-1 rounded-sm border border-border hover:border-primary hover:text-primary inline-flex items-center gap-1"
                                >
                                  <FileCheck2 className="h-3 w-3" /> Valider le chantier
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  setPanel(isVoiriePanel ? null : { id: r.id, tab: "voirie" })
                                }
                                className={`text-mono text-[11px] px-2 py-1 rounded-sm border inline-flex items-center gap-1 ${
                                  v?.statut === "obtenue"
                                    ? "border-primary/40 text-primary"
                                    : v?.statut === "refusee"
                                      ? "border-destructive/40 text-destructive"
                                      : "border-border text-muted-foreground hover:border-primary hover:text-primary"
                                }`}
                              >
                                <ShieldCheck className="h-3 w-3" /> Voirie :{" "}
                                {v ? (VOIRIE_LABEL[v.statut] ?? v.statut) : "à renseigner"}
                              </button>
                              {v?.url && (
                                <a
                                  href={v.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-mono text-[11px] text-primary hover:underline"
                                >
                                  Voir le document
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  setPanel(isMontantPanel ? null : { id: r.id, tab: "montant" })
                                }
                                className="text-mono text-[11px] px-2 py-1 rounded-sm border border-border text-muted-foreground hover:border-primary hover:text-primary inline-flex items-center gap-1"
                              >
                                <Euro className="h-3 w-3" /> Montant & facturation
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setPanel(isAdressePanel ? null : { id: r.id, tab: "adresse" })
                                }
                                className="text-mono text-[11px] px-2 py-1 rounded-sm border border-border text-muted-foreground hover:border-primary hover:text-primary inline-flex items-center gap-1"
                              >
                                <Pencil className="h-3 w-3" /> Modifier l'adresse
                              </button>
                              {r.chantier_valide && (
                                <button
                                  type="button"
                                  onClick={() => valider.mutate({ id: r.id, valide: false })}
                                  className="text-mono text-[11px] text-muted-foreground hover:text-destructive"
                                >
                                  Annuler la validation
                                </button>
                              )}
                            </div>
                            {r.chantier_commentaire && (
                              <p className="text-xs text-muted-foreground mt-2">
                                Validation : {r.chantier_commentaire}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <select
                              value={r.statut}
                              onChange={(e) =>
                                setStatut.mutate({ id: r.id, statut: e.target.value })
                              }
                              className="bg-input border border-border rounded-sm px-2 py-1.5 text-mono text-xs"
                            >
                              {STATUTS.map((s) => (
                                <option key={s.v} value={s.v}>
                                  {s.l}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Supprimer définitivement le rendez-vous de ${r.client_nom} ? Cette action est irréversible.`,
                                  )
                                ) {
                                  remove.mutate(r.id);
                                }
                              }}
                              aria-label="Supprimer le rendez-vous"

                              className="text-muted-foreground hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>

                        {isChantierPanel && (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              const f = new FormData(e.currentTarget);
                              valider.mutate({
                                id: r.id,
                                valide: true,
                                par: String(f.get("par") ?? "").trim() || r.technicien || null,
                                commentaire: String(f.get("commentaire") ?? "").trim() || null,
                              });
                            }}
                            className="mt-4 border-t border-border pt-4 grid gap-3 sm:grid-cols-2"
                          >
                            <Field label="Validé par" name="par" defaultValue={r.technicien ?? ""} />
                            <label className="block sm:col-span-2">
                              <span className="text-mono text-xs text-muted-foreground">
                                Commentaire de fin de chantier
                              </span>
                              <textarea
                                name="commentaire"
                                rows={2}
                                className="mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm"
                              />
                            </label>
                            <button
                              type="submit"
                              disabled={valider.isPending}
                              className="hero-grad text-primary-foreground text-mono text-xs px-4 py-2.5 rounded-sm inline-flex items-center gap-2 w-fit disabled:opacity-60"
                            >
                              {valider.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="h-4 w-4" />
                              )}
                              Confirmer la réalisation
                            </button>
                          </form>
                        )}

                        {isAdressePanel && (
                          <form
                            key={`adr-${r.id}`}
                            onSubmit={(e) => {
                              e.preventDefault();
                              const f = new FormData(e.currentTarget);
                              setAdresse.mutate({
                                id: r.id,
                                adresse: String(f.get("adresse") ?? "").trim(),
                                cp_ville: String(f.get("cp_ville") ?? "").trim() || null,
                              });
                            }}
                            className="mt-4 border-t border-border pt-4 grid gap-3 sm:grid-cols-2"
                          >
                            <AdresseFields
                              required
                              defaultAdresse={r.adresse}
                              defaultCpVille={r.cp_ville ?? ""}
                            />
                            <div className="sm:col-span-2 flex items-center gap-4">
                              <button
                                type="submit"
                                disabled={setAdresse.isPending}
                                className="hero-grad text-primary-foreground text-mono text-xs px-4 py-2.5 rounded-sm inline-flex items-center gap-2 w-fit disabled:opacity-60"
                              >
                                {setAdresse.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                                Enregistrer la nouvelle adresse
                              </button>
                              <p className="text-[11px] text-muted-foreground">
                                La carte et le temps de trajet seront recalculés automatiquement.
                              </p>
                            </div>
                          </form>
                        )}

                        {isMontantPanel && (
                          <form
                            onSubmit={(e) => {
                              e.preventDefault();
                              const f = new FormData(e.currentTarget);
                              const g = (k: string) => String(f.get(k) ?? "").trim();
                              setFacturation.mutate({
                                id: r.id,
                                origine: g("origine") as "direct" | "sous_traitance",
                                partenaire: g("partenaire") || null,
                                montant_ht: Number(g("montant_ht") || 0),
                                tva_pct: Number(g("tva_pct") || 20),
                                statut_facturation: g("statut_facturation") as
                                  | "a_facturer"
                                  | "facture"
                                  | "paye",
                                designation: g("designation") || null,
                                etiquettes: parseEtiquettes(g("etiquettes")),
                              });

                            }}
                            className="mt-4 pt-4 border-t border-border grid gap-3 sm:grid-cols-2"
                          >
                            <label className="block">
                              <span className="text-mono text-xs text-muted-foreground">
                                Origine
                              </span>
                              <select
                                name="origine"
                                defaultValue={r.origine ?? "direct"}
                                className="mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm"
                              >
                                <option value="direct">Client direct</option>
                                <option value="sous_traitance">Sous-traitance / partenaire</option>
                              </select>
                            </label>
                            <Field
                              label="Partenaire / donneur d'ordre"
                              name="partenaire"
                              defaultValue={r.partenaire ?? ""}
                            />
                            <Field
                              label="Montant HT (€)"
                              name="montant_ht"
                              type="number"
                              defaultValue={String(r.montant_ht ?? 0)}
                            />
                            <Field
                              label="TVA (%)"
                              name="tva_pct"
                              type="number"
                              defaultValue={String(r.tva_pct ?? 20)}
                            />
                            <label className="block">
                              <span className="text-mono text-xs text-muted-foreground">
                                Facturation
                              </span>
                              <select
                                name="statut_facturation"
                                defaultValue={r.statut_facturation ?? "a_facturer"}
                                className="mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm"
                              >
                                <option value="a_facturer">À facturer</option>
                                <option value="facture">Facturé</option>
                                <option value="paye">Payé</option>
                              </select>
                            </label>
                            <div className="sm:col-span-2">
                              <Field
                                label="Désignation du chantier"
                                name="designation"
                                defaultValue={r.designation ?? ""}
                                placeholder="Ex. Inter de Rennes — prestation pour PureEnergie"
                              />
                            </div>
                            <label className="block sm:col-span-2">
                              <span className="text-mono text-xs text-muted-foreground">
                                Étiquettes (séparées par des virgules)
                              </span>
                              <input
                                name="etiquettes"
                                list="etiquettes-suggestions"
                                defaultValue={
                                  Array.isArray(r.etiquettes) ? r.etiquettes.join(", ") : ""
                                }
                                className="mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
                              />
                              <span className="mt-2 flex flex-wrap gap-1.5">
                                {ETIQUETTES_SUGGEREES.map((et) => (
                                  <span
                                    key={et}
                                    className="text-mono text-[10px] px-2 py-0.5 rounded-full border border-border text-muted-foreground"
                                  >
                                    {et}
                                  </span>
                                ))}
                              </span>
                            </label>

                            <div className="sm:col-span-2 flex items-center gap-3">
                              <button
                                type="submit"
                                disabled={setFacturation.isPending}
                                className="hero-grad text-primary-foreground text-mono text-xs px-4 py-2.5 rounded-sm inline-flex items-center gap-2 disabled:opacity-60"
                              >
                                {setFacturation.isPending && (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                )}
                                Enregistrer
                              </button>
                              <span className="text-mono text-xs text-muted-foreground">
                                Total TTC :{" "}
                                {eurosFr(
                                  Number(r.montant_ht ?? 0) * (1 + Number(r.tva_pct ?? 20) / 100),
                                )}
                              </span>
                            </div>
                          </form>
                        )}

                        {isVoiriePanel && (
                          <form
                            onSubmit={(e) => onVoirieSubmit(e, r.id, v?.id)}
                            className="mt-4 border-t border-border pt-4 grid gap-3 sm:grid-cols-2"
                          >
                            <label className="block">
                              <span className="text-mono text-xs text-muted-foreground">Statut</span>
                              <select
                                name="statut"
                                defaultValue={v?.statut ?? "en_attente"}
                                className="mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm"
                              >
                                {VOIRIE_STATUTS.map((s) => (
                                  <option key={s.v} value={s.v}>
                                    {s.l}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <Field
                              label="Référence de l'arrêté"
                              name="reference"
                              defaultValue={v?.reference ?? ""}
                            />
                            <Field
                              label="Autorité (mairie, métropole…)"
                              name="autorite"
                              defaultValue={v?.autorite ?? ""}
                            />
                            <Field
                              label="Date de demande"
                              name="date_demande"
                              type="date"
                              defaultValue={v?.date_demande ?? ""}
                            />
                            <Field
                              label="Date d'obtention"
                              name="date_obtention"
                              type="date"
                              defaultValue={v?.date_obtention ?? ""}
                            />
                            <Field
                              label="Valable jusqu'au"
                              name="date_fin"
                              type="date"
                              defaultValue={v?.date_fin ?? ""}
                            />
                            <label className="block sm:col-span-2">
                              <span className="text-mono text-xs text-muted-foreground">
                                Document (PDF ou photo, 8 Mo max.)
                              </span>
                              <input
                                type="file"
                                name="document"
                                accept="application/pdf,image/jpeg,image/png,image/webp"
                                className="mt-2 w-full bg-input border border-border rounded-sm px-3 py-2 text-sm"
                              />
                            </label>
                            <label className="block sm:col-span-2">
                              <span className="text-mono text-xs text-muted-foreground">Notes</span>
                              <textarea
                                name="notes"
                                rows={2}
                                defaultValue={v?.notes ?? ""}
                                className="mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm"
                              />
                            </label>
                            <div className="sm:col-span-2 flex items-center gap-4">
                              <button
                                type="submit"
                                disabled={saveVoirieMut.isPending}
                                className="hero-grad text-primary-foreground text-mono text-xs px-4 py-2.5 rounded-sm inline-flex items-center gap-2 disabled:opacity-60"
                              >
                                {saveVoirieMut.isPending ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Upload className="h-4 w-4" />
                                )}
                                Enregistrer l'autorisation
                              </button>
                              {v && (
                                <button
                                  type="button"
                                  onClick={() => removeVoirie.mutate(v.id)}
                                  className="text-mono text-xs text-muted-foreground hover:text-destructive"
                                >
                                  Supprimer
                                </button>
                              )}
                              {error && (
                                <p className="text-mono text-xs text-destructive">{error}</p>
                              )}
                            </div>
                          </form>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          )}
        </section>

        <aside className="order-2 space-y-6">
          <AgendaMois
            events={rows.map((r) => ({
              id: r.id,
              date_debut: r.date_debut,
              duree_min: r.duree_min,
              client_nom: r.client_nom,
              titre: r.titre,
              cp_ville: r.cp_ville,
              statut: r.statut,
              distance_km: r.distance_km,
            }))}
            activeId={active}
            onSelectEvent={setActive}
            onPickDay={(iso) => {
              setPrefillDate(iso);
              setOpen(true);
            }}
          />


          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h2 className="text-mono text-xs font-bold uppercase tracking-[0.14em] mb-3 flex items-center gap-2">
              <RouteIcon className="h-4 w-4 text-primary" />
              {tourneeAff.etapes.length > 1 ? "Tournée du jour optimisée" : "Trajet du jour"}
              {tourneeReel.data && !tourneeReel.data.estime && (
                <span className="text-[10px] font-bold text-primary normal-case tracking-normal bg-primary/10 px-1.5 py-0.5 rounded-full">
                  itinéraires réels
                </span>
              )}
            </h2>
            <div className="mb-3 flex flex-wrap gap-2">
              {TECHNICIENS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setDepartId(t.id)}
                  className={`text-left border rounded-lg px-3 py-2 text-xs transition ${
                    depart.id === t.id
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <span className="block font-semibold">{t.nom}</span>
                  <span className="block text-muted-foreground">Départ {t.adresse}</span>
                </button>
              ))}
            </div>
            {joursDispo.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {joursDispo.map((j) => (
                  <button
                    key={j.key}
                    type="button"
                    onClick={() => setJourSel(j.key)}
                    className={`text-mono text-[11px] px-2 py-1 rounded-full border transition ${
                      jourActif?.key === j.key
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    }`}
                  >
                    {j.label} · {j.stops.length}
                  </button>
                ))}
              </div>
            )}
            {tourneeAff.etapes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun chantier géolocalisé ce jour-là pour {depart.nom}.
              </p>
            ) : (
              <>
                <ol className="space-y-1.5">
                  {tourneeAff.etapes.map((e) => (
                    <li
                      key={e.id}
                      onMouseEnter={() => setActive(e.id)}
                      onClick={() => setActive(e.id)}
                      className={`flex items-center gap-2.5 text-sm rounded-lg px-2 py-1.5 cursor-pointer transition ${
                        active === e.id ? "bg-primary/12" : "hover:bg-muted/70"
                      }`}
                    >
                      <span className="text-mono text-[11px] font-bold w-6 h-6 rounded-full hero-grad text-primary-foreground grid place-items-center shrink-0">
                        {e.ordre}
                      </span>
                      <span className="truncate font-semibold">{e.label}</span>
                      <span className="ml-auto text-mono text-xs font-bold text-muted-foreground shrink-0">
                        +{e.km} km
                      </span>
                    </li>
                  ))}
                </ol>

                <div className="mt-4 pt-3 border-t border-border space-y-1.5 text-mono text-xs">
                  <p className="flex justify-between">
                    <span className="text-muted-foreground">
                      {tourneeAff.etapes.length > 1
                        ? `${jourActif?.label ?? "Journée"} · ${tourneeAff.etapes.length} chantiers`
                        : `Aller-retour depuis ${depart.label}`}
                    </span>
                    <span>
                      {tourneeAff.kmTotal} km · {dureeFr(tourneeAff.minutes)}
                    </span>
                  </p>
                  {tourneeAff.etapes.length > 1 && (
                    <p className="flex justify-between">
                      <span className="text-muted-foreground">Un aller-retour par chantier</span>
                      <span>{tourneeAff.kmDirect} km</span>
                    </p>
                  )}
                  {tourneeAff.etapes.length > 1 && tourneeAff.kmDirect > tourneeAff.kmTotal && (
                    <p className="flex justify-between text-primary">
                      <span className="inline-flex items-center gap-1">
                        <Fuel className="h-3.5 w-3.5" /> Économie estimée
                      </span>
                      <span>
                        {tourneeAff.kmDirect - tourneeAff.kmTotal} km · {economie.litres} L ·{" "}
                        {economie.euros} €
                      </span>
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
            <h2 className="text-mono text-xs font-bold uppercase tracking-[0.14em] mb-1 flex items-center gap-2">
              <RouteIcon className="h-4 w-4 text-primary" /> Programme des tournées
            </h2>
            <p className="text-xs text-muted-foreground mb-3">
              Répartit les chantiers sur plusieurs journées en suivant les secteurs : au-delà de
              150 km, la journée prévoit une nuitée sur place.
            </p>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {[7, 14].map((h) => (
                <button
                  key={h}
                  type="button"
                  onClick={() => {
                    setHorizon(h);
                    setCampagneOn(true);
                  }}
                  className={`text-mono text-[11px] px-2.5 py-1.5 rounded-sm border transition ${
                    campagneOn && horizon === h
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  Sur {h} jours
                </button>
              ))}
              <button
                type="button"
                onClick={() => setCampagneOn((v) => !v)}
                className="hero-grad text-primary-foreground text-mono text-[11px] px-3 py-1.5 rounded-sm"
              >
                {campagneOn ? "Masquer" : "Programmer les tournées"}
              </button>
            </div>
            {campagneOn &&
              (!campagne || !campagne.jours.length ? (
                <p className="text-sm text-muted-foreground">
                  Aucun chantier à répartir pour {depart.nom}.
                </p>
              ) : (
                <>
                  <ol className="space-y-2">
                    {campagne.jours.map((j) => (
                      <li key={j.jour} className="text-sm border border-border rounded-lg p-2.5">
                        <p className="flex items-center gap-2">
                          <span className="text-mono text-[11px] font-bold w-6 h-6 rounded-full hero-grad text-primary-foreground grid place-items-center shrink-0">
                            J{j.jour}
                          </span>
                          <span className="font-semibold truncate">{j.secteur}</span>
                          <span className="ml-auto text-mono text-xs text-muted-foreground shrink-0">
                            +{j.km} km
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {j.stops.map((s) => s.label).join(" · ")}
                        </p>
                        {j.nuitee && (
                          <p className="text-mono text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                            Nuitée sur place conseillée
                          </p>
                        )}
                      </li>
                    ))}
                  </ol>
                  <div className="mt-3 pt-3 border-t border-border space-y-1.5 text-mono text-xs">
                    <p className="flex justify-between">
                      <span className="text-muted-foreground">
                        {campagne.jours.length} journées · {campagne.nuitees} nuitée(s)
                      </span>
                      <span>{campagne.kmTotal} km</span>
                    </p>
                    {campagne.kmSepares > campagne.kmTotal && (
                      <p className="flex justify-between text-primary">
                        <span className="inline-flex items-center gap-1">
                          <Fuel className="h-3.5 w-3.5" /> Économie estimée
                        </span>
                        <span>{campagne.kmSepares - campagne.kmTotal} km</span>
                      </p>
                    )}
                  </div>
                </>
              ))}
          </div>

          {grappes.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-5 shadow-sm">
              <h2 className="text-mono text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground mb-3">
                Chantiers proches (moins de 25 km)
              </h2>
              <ul className="space-y-3">
                {grappes.map((g, i) => (
                  <li key={i} className="text-sm">
                    <p className="text-mono text-xs text-primary">
                      Secteur {i + 1} · {g.length} chantiers
                    </p>
                    <p className="text-muted-foreground text-xs mt-1">
                      {g.map((s) => s.label).join(" · ")}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>

    </ProShell>
  );
}

function Legende({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  defaultValue?: string;
}) {
  return (
    <label className="block">
      <span className="text-mono text-xs text-muted-foreground">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        defaultValue={defaultValue}
        className="mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-primary"
      />
    </label>
  );
}
