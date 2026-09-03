import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { CalendarClock, Loader2, MapPin, Plus, Route as RouteIcon, Trash2 } from "lucide-react";
import {
  createRendezVous,
  deleteRendezVous,
  listRendezVous,
  updateStatutRendezVous,
  type RendezVousInput,
} from "@/lib/planning.functions";
import { ProShell } from "@/components/ProShell";
import { FranceMap, type MapPoint } from "@/components/FranceMap";
import { dureeFr } from "@/lib/geo";

export const Route = createFileRoute("/_authenticated/planning/")({
  head: () => ({
    meta: [
      { title: "Planning des interventions — Espace pro Borne de l'Ouest" },
      {
        name: "description",
        content:
          "Planification des rendez-vous IRVE : adresse géolocalisée, distance et temps de trajet, statut d'intervention.",
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

function PlanningPage() {
  const qc = useQueryClient();
  const fetchList = useServerFn(listRendezVous);
  const createFn = useServerFn(createRendezVous);
  const statutFn = useServerFn(updateStatutRendezVous);
  const deleteFn = useServerFn(deleteRendezVous);

  const list = useQuery({ queryKey: ["rendezvous"], queryFn: () => fetchList() });
  const [active, setActive] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["rendezvous"] });
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

  const rows = list.data ?? [];
  const groups = useMemo(() => {
    const map = new Map<string, typeof rows>();
    for (const r of rows) {
      const k = dayKey(r.date_debut);
      map.set(k, [...(map.get(k) ?? []), r]);
    }
    return [...map.entries()];
  }, [rows]);

  const points: MapPoint[] = rows
    .filter((r) => r.lat != null && r.lng != null)
    .map((r) => ({
      id: r.id,
      lat: Number(r.lat),
      lng: Number(r.lng),
      label: r.client_nom,
      statut: r.statut,
    }));

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

  return (
    <ProShell>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-mono text-primary">Planning</p>
          <h1 className="text-2xl font-medium tracking-tight mt-1">Rendez-vous & tournées</h1>
          <p className="text-sm text-muted-foreground mt-1">
            L'adresse saisie est géolocalisée automatiquement : distance et temps de trajet depuis
            Nantes.
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
          className="bg-card border border-border rounded-sm p-5 mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
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
          <Field label="Date & heure" name="date_debut" type="datetime-local" required />
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

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <section className="space-y-6">
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
                <ul className="space-y-3">
                  {items.map((r) => (
                    <li
                      key={r.id}
                      onMouseEnter={() => setActive(r.id)}
                      className={`bg-card border rounded-sm p-4 ${
                        active === r.id ? "border-primary" : "border-border"
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
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </section>

        <aside className="bg-card border border-border rounded-sm p-5 lg:sticky lg:top-24 h-fit">
          <h2 className="text-mono text-muted-foreground mb-3 flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" /> Carte des rendez-vous
          </h2>
          <FranceMap points={points} activeId={active} onSelect={setActive} />
        </aside>
      </div>
    </ProShell>
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
