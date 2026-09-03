import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  CalendarClock,
  Euro,
  FileText,
  Inbox,
  Loader2,
  MapPin,
  Route as RouteIcon,
  Zap,
} from "lucide-react";
import { getDashboard } from "@/lib/planning.functions";
import { ProShell } from "@/components/ProShell";
import { FranceMap, type MapPoint } from "@/components/FranceMap";
import { dureeFr } from "@/lib/geo";
import { euro } from "@/lib/company";

export const Route = createFileRoute("/_authenticated/espace/")({
  head: () => ({
    meta: [
      { title: "Tableau de bord — Espace pro Borne de l'Ouest" },
      {
        name: "description",
        content:
          "Pilotage de l'activité IRVE Technologie : rendez-vous à venir, demandes, devis et carte des interventions.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EspacePage,
});

const dateTimeFr = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

function EspacePage() {
  const fetchDashboard = useServerFn(getDashboard);
  const q = useQuery({ queryKey: ["dashboard"], queryFn: () => fetchDashboard() });
  const [active, setActive] = useState<string | null>(null);

  const rdv = q.data?.rendezvous ?? [];
  const aVenir = rdv
    .filter((r) => new Date(r.date_debut).getTime() >= Date.now() - 36e5 && r.statut !== "annule")
    .slice(0, 8);
  const points: MapPoint[] = rdv
    .filter((r) => r.lat != null && r.lng != null)
    .map((r) => ({
      id: r.id,
      lat: Number(r.lat),
      lng: Number(r.lng),
      label: r.client_nom,
      sub: r.cp_ville,
      statut: r.statut,
    }));

  return (
    <ProShell>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-mono text-primary">Espace pro</p>
          <h1 className="text-2xl font-medium tracking-tight mt-1">Pilotage de l'activité</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Borne de l'Ouest — marque commerciale d'IRVE Technologie
          </p>
        </div>
        <Link
          to="/planning"
          className="hero-grad text-primary-foreground text-mono text-xs px-4 py-2.5 rounded-sm inline-flex items-center gap-2"
        >
          <CalendarClock className="h-4 w-4" /> Nouveau rendez-vous
        </Link>
      </div>

      {q.isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            <Stat
              icon={CalendarClock}
              label="RDV à venir"
              value={String(q.data?.stats.rdvAVenir ?? 0)}
              hint={`${q.data?.stats.rdvSemaine ?? 0} dans les 7 jours`}
            />
            <Stat
              icon={RouteIcon}
              label="Km planifiés"
              value={`${Math.round(q.data?.stats.kmPlanifies ?? 0)} km`}
              hint="depuis la base de Nantes"
            />
            <Stat
              icon={Inbox}
              label="Demandes"
              value={String(q.data?.demandes.length ?? 0)}
              hint={`${q.data?.stats.demandesNouvelles ?? 0} nouvelles`}
            />
            <Stat
              icon={Euro}
              label="Devis récents"
              value={euro(q.data?.stats.caDevis ?? 0)}
              hint={`${q.data?.devis.length ?? 0} devis`}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
            <section className="bg-card border border-border rounded-sm p-5">
              <h2 className="text-mono text-muted-foreground mb-4 flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-primary" /> Prochains rendez-vous
              </h2>
              {!aVenir.length ? (
                <p className="text-sm text-muted-foreground">
                  Aucun rendez-vous planifié.{" "}
                  <Link to="/planning" className="text-primary">
                    En créer un
                  </Link>
                  .
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {aVenir.map((r) => (
                    <li
                      key={r.id}
                      onMouseEnter={() => setActive(r.id)}
                      onMouseLeave={() => setActive(null)}
                      className="py-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {r.client_nom}
                          <span className="text-muted-foreground font-normal"> — {r.titre}</span>
                        </p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <MapPin className="h-3 w-3" /> {r.cp_ville || r.adresse}
                          {r.distance_km != null && (
                            <span className="text-mono">
                              · {Math.round(Number(r.distance_km))} km ·{" "}
                              {dureeFr(Number(r.duree_trajet_min ?? 0))} de trajet
                            </span>
                          )}
                        </p>
                      </div>
                      <span className="text-mono text-xs text-primary whitespace-nowrap">
                        {dateTimeFr(r.date_debut)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="bg-card border border-border rounded-sm p-5">
              <h2 className="text-mono text-muted-foreground mb-3 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" /> Carte des interventions
              </h2>
              <FranceMap points={points} activeId={active} onSelect={setActive} />
              <p className="text-mono text-[10px] text-muted-foreground mt-2">
                {points.length} point{points.length > 1 ? "s" : ""} géolocalisé
                {points.length > 1 ? "s" : ""} · distances estimées depuis Nantes
              </p>
            </section>
          </div>

          <div className="grid gap-6 lg:grid-cols-2 mt-6">
            <section className="bg-card border border-border rounded-sm p-5">
              <h2 className="text-mono text-muted-foreground mb-4 flex items-center gap-2">
                <Inbox className="h-4 w-4 text-primary" /> Dernières demandes
              </h2>
              {!q.data?.demandes.length ? (
                <p className="text-sm text-muted-foreground">Aucune demande.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {q.data.demandes.map((d) => (
                    <li key={d.id} className="flex items-baseline justify-between gap-3">
                      <span className="truncate">
                        {d.nom}{" "}
                        <span className="text-muted-foreground text-mono text-xs">
                          {d.code_postal}
                        </span>
                      </span>
                      <span className="text-mono text-xs text-muted-foreground">{d.status}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Link to="/demandes" className="text-mono text-xs text-primary mt-4 inline-block">
                Voir la boîte de réception
              </Link>
            </section>

            <section className="bg-card border border-border rounded-sm p-5">
              <h2 className="text-mono text-muted-foreground mb-4 flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" /> Devis récents
              </h2>
              {!q.data?.devis.length ? (
                <p className="text-sm text-muted-foreground">Aucun devis.</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {q.data.devis.map((d) => (
                    <li key={d.id} className="flex items-baseline justify-between gap-3">
                      <Link
                        to="/devis/$id"
                        params={{ id: d.id }}
                        className="truncate hover:text-primary"
                      >
                        <span className="text-mono text-xs text-primary">{d.numero}</span>{" "}
                        {d.client_nom}
                      </Link>
                      <span className="text-mono text-xs">{euro(Number(d.total_ttc))}</span>
                    </li>
                  ))}
                </ul>
              )}
              <Link to="/devis" className="text-mono text-xs text-primary mt-4 inline-block">
                Gérer les devis
              </Link>
            </section>
          </div>
        </>
      )}
    </ProShell>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Zap;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="bg-card border border-border rounded-sm p-5">
      <p className="text-mono text-xs text-muted-foreground flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 text-primary" /> {label}
      </p>
      <p className="text-2xl font-medium tracking-tight mt-2">{value}</p>
      {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
    </div>
  );
}
