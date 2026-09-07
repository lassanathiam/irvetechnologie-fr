import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  CalendarClock,
  CheckCircle2,
  FileCheck2,
  Fuel,
  Loader2,
  MapPin,
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
  validerChantier,
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
import { dureeFr } from "@/lib/geo";
import { economieCarburant, groupesProximite, optimiserTournee } from "@/lib/tournee";

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
  const [panel, setPanel] = useState<{ id: string; tab: "chantier" | "voirie" } | null>(null);
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
  const removeVoirie = useMutation({
    mutationFn: (id: string) => deleteVoirieFn({ data: { id } }),
    onSuccess: refresh,
  });

  const rows = list.data ?? [];
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
          new Date(r.date_debut).getTime() >= Date.now() - 12 * 3600e3,
      ),
    [rows],
  );

  const tournee = useMemo(
    () =>
      optimiserTournee(
        aVenir.map((r) => ({
          id: r.id,
          lat: Number(r.lat),
          lng: Number(r.lng),
          label: r.client_nom,
          sub: r.cp_ville,
        })),
      ),
    [aVenir],
  );

  const grappes = useMemo(
    () =>
      groupesProximite(
        aVenir.map((r) => ({
          id: r.id,
          lat: Number(r.lat),
          lng: Number(r.lng),
          label: r.client_nom,
          sub: r.cp_ville,
        })),
      ).filter((g) => g.length > 1),
    [aVenir],
  );

  const economie = economieCarburant(Math.max(tournee.kmDirect - tournee.kmTotal, 0));

  /** Itinéraire routier réel base → chantier sélectionné. */
  const routeFn = useServerFn(itineraireDepuisBase);
  const activeRow = rows.find((r) => r.id === active && r.lat != null && r.lng != null);
  const itineraire = useQuery({
    queryKey: ["itineraire", activeRow?.id],
    enabled: !!activeRow,
    staleTime: 30 * 60_000,
    queryFn: () =>
      routeFn({ data: { lat: Number(activeRow!.lat), lng: Number(activeRow!.lng) } }),
  });

  /** Tournée complète sur le réseau routier réel. */
  const tourneeFn = useServerFn(tourneeReelle);
  const tourneeStops = useMemo(
    () =>
      aVenir.slice(0, 10).map((r) => ({
        id: r.id,
        lat: Number(r.lat),
        lng: Number(r.lng),
        label: r.client_nom,
        sub: r.cp_ville,
      })),
    [aVenir],
  );
  const tourneeReel = useQuery({
    queryKey: ["tournee-reelle", tourneeStops.map((s) => s.id).join(",")],
    enabled: tourneeStops.length > 0,
    staleTime: 30 * 60_000,
    queryFn: () => tourneeFn({ data: { stops: tourneeStops } }),
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
    create.mutate({
      titre: get("titre") || "Intervention",
      type: get("type") as RendezVousInput["type"],
      statut: "planifie",
      client_nom: get("client_nom"),
      client_telephone: get("client_telephone") || null,
      client_email: get("client_email") || null,
      adresse: get("adresse"),
      cp_ville: get("cp_ville") || null,
      date_debut: new Date(get("date_debut")).toISOString(),
      duree_min: Number(get("duree_min") || 120),
      technicien: get("technicien") || null,
      notes: get("notes") || null,
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
          <Field label="Adresse du chantier" name="adresse" required placeholder="12 rue des Lilas" />
          <Field label="Code postal & ville" name="cp_ville" placeholder="44000 Nantes" />
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
          <Field label="Technicien" name="technicien" />
          <Field label="Objet" name="titre" placeholder="Pose borne 7,4 kW" />
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
                  Nantes → chantier : {itineraire.data.km} km · {dureeFr(itineraire.data.minutes)}
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
                              onClick={() => remove.mutate(r.id)}
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
              <RouteIcon className="h-4 w-4 text-primary" /> Tournée optimisée
              {tourneeReel.data && !tourneeReel.data.estime && (
                <span className="text-[10px] font-bold text-primary normal-case tracking-normal bg-primary/10 px-1.5 py-0.5 rounded-full">
                  itinéraires réels
                </span>
              )}
            </h2>
            {tourneeAff.etapes.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Aucun chantier à venir géolocalisé pour le moment.
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
                    <span className="text-muted-foreground">Tournée groupée</span>
                    <span>
                      {tourneeAff.kmTotal} km · {dureeFr(tourneeAff.minutes)}
                    </span>
                  </p>
                  <p className="flex justify-between">
                    <span className="text-muted-foreground">Trajets séparés</span>
                    <span>{tourneeAff.kmDirect} km</span>
                  </p>
                  {tourneeAff.kmDirect > tourneeAff.kmTotal && (
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
