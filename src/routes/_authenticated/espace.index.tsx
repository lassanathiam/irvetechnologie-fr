import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Euro,
  FileText,
  Inbox,
  Loader2,
  
  Receipt,
  Wrench,
} from "lucide-react";
import { getDashboard, getSuiviFacturation } from "@/lib/planning.functions";
import { updateStatutDemande } from "@/lib/demandes-admin.functions";
import { ProShell } from "@/components/ProShell";
import { euro } from "@/lib/company";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/espace/")({
  head: () => ({
    meta: [
      { title: "Tableau de bord — Espace pro Borne de l'Ouest" },
      {
        name: "description",
        content:
          "Pilotage de l'activité IRVE Technologie : rendez-vous à venir, travaux réalisés, chiffre d'affaires et demandes clients.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EspacePage,
});

const dateCourteFr = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short" }).format(new Date(iso));

const STATUT_DEMANDE: Record<string, { label: string; cls: string }> = {
  nouveau: { label: "Nouvelle", cls: "bg-primary/15 text-primary" },
  en_cours: { label: "En cours", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  accepte: { label: "Acceptée", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  refuse: { label: "Refusée", cls: "bg-destructive/15 text-destructive" },
  clos: { label: "Clôturée", cls: "bg-muted text-muted-foreground" },
};

const DEVIS_BADGE: Record<string, { label: string; cls: string }> = {
  brouillon: { label: "Brouillon", cls: "bg-slate-500/15 text-dashboard-muted border-dashboard-line" },
  envoye: { label: "Envoyé", cls: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/25" },
  accepte: { label: "Accepté", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25" },
  signe: { label: "Signé", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/25" },
  refuse: { label: "Refusé", cls: "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/25" },
};

const moisJour = (iso: string) => {
  const d = new Date(iso);
  return {
    mois: d.toLocaleDateString("fr-FR", { month: "short" }).replace(".", ""),
    jour: d.toLocaleDateString("fr-FR", { day: "2-digit" }),
    heure: d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
  };
};

function EspacePage() {
  const fetchDashboard = useServerFn(getDashboard);
  const setStatut = useServerFn(updateStatutDemande);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["dashboard"], queryFn: () => fetchDashboard() });
  const chargerFacturation = useServerFn(getSuiviFacturation);
  const facturation = useQuery({
    queryKey: ["suivi-facturation-dashboard"],
    queryFn: () => chargerFacturation({ data: {} }),
  });

  const accepter = useMutation({
    mutationFn: (id: string) => setStatut({ data: { id, status: "accepte" } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dashboard"] }),
  });

  const rdv = q.data?.rendezvous ?? [];
  const enCours = rdv.filter((r) => r.demarre_at && !r.termine_at);
  const aVenir = rdv
    .filter((r) => new Date(r.date_debut).getTime() >= Date.now() - 36e5 && r.statut !== "annule")
    .slice(0, 6);
  const realises = rdv
    .filter((r) => r.statut === "realise" || r.statut === "termine")
    .sort((a, b) => new Date(b.date_debut).getTime() - new Date(a.date_debut).getTime())
    .slice(0, 5);
  const demandes = q.data?.demandes ?? [];
  const nouvelles = demandes.filter((d) => d.status === "nouveau" || d.status === "en_cours").slice(0, 6);
  const devisRecents = (q.data?.devis ?? []).slice(0, 5);


  return (
    <ProShell>
      <div className="pro-workspace neo-dashboard">
      <div className="grid gap-5 pb-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="min-w-0">
          <h1 className="pro-heading text-3xl font-bold leading-tight sm:text-4xl">Tableau de bord</h1>
          <p className="neo-dashboard-muted mt-2 text-sm">
            Activité, chiffre d'affaires et interventions en un coup d'œil
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/planning"
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-dashboard-line bg-dashboard-panel px-4 py-2.5 text-xs font-bold text-dashboard-foreground shadow-sm transition hover:border-primary hover:text-primary"
          >
            <CalendarClock className="h-4 w-4" /> Planifier un rendez-vous
          </Link>
          <Link
            to="/devis"
            className="inline-flex min-h-11 items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            <FileText className="h-3.5 w-3.5" /> Nouveau devis
          </Link>
        </div>
      </div>

      {q.isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      ) : (
        <>
          {enCours.length > 0 && (
            <div className="neo-dashboard-panel mt-2 rounded-md border-l-4 border-l-primary p-5">
              <p className="text-mono text-xs font-bold text-dashboard-muted">
                Travaux en cours
              </p>
              <ul className="mt-3 grid gap-2">
                {enCours.map((r) => (
                  <li key={r.id}>
                    <Link
                      to="/planning"
                      search={{ rdv: r.id }}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-md bg-dashboard-raised px-4 py-3 text-base font-semibold hover:text-dashboard-foreground"
                    >
                      <span className="truncate">
                        {r.client_nom}
                        <span className="neo-dashboard-muted font-normal"> · {r.cp_ville || r.adresse}</span>
                      </span>
                      <span className="text-mono text-sm text-dashboard-muted">
                        Démarré à{" "}
                        {new Date(r.demarre_at ?? r.date_debut).toLocaleTimeString("fr-FR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SimpleStat
              icon={Euro}
              label="Encaissé"
              value={euro(q.data?.stats.caEncaisse ?? 0)}
              hint={`${euro(q.data?.stats.caMois ?? 0)} ce mois`}
              to="/factures"
            />
            <SimpleStat
              icon={Receipt}
              label="À encaisser"
              value={euro(q.data?.stats.caEnAttente ?? 0)}
              hint="Factures en attente"
              to="/factures"
            />
            <SimpleStat
              icon={CalendarClock}
              label="Rendez-vous à venir"
              value={String(q.data?.stats.rdvAVenir ?? 0)}
              hint={`${q.data?.stats.rdvSemaine ?? 0} dans les 7 jours`}
              to="/planning"
            />
            <SimpleStat
              icon={AlertTriangle}
              label="Retards de règlement"
              value={String(facturation.data?.totaux.retard_nb ?? 0)}
              hint={euro(facturation.data?.totaux.retard_ht ?? 0)}
              to="/facturation"
            />
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-3">
            <section className="neo-dashboard-panel p-5 lg:col-span-2">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="pro-heading text-base font-bold">Devis récents</h2>
                <Link to="/devis" className="text-mono text-xs text-dashboard-muted hover:text-primary">
                  Voir tout
                </Link>
              </div>
              {!devisRecents.length ? (
                <Empty>Aucun devis à afficher.</Empty>
              ) : (
                <ul className="divide-y divide-dashboard-line/70">
                  {devisRecents.map((d) => {
                    const badge = DEVIS_BADGE[d.statut] ?? DEVIS_BADGE.brouillon;
                    return (
                      <li key={d.id}>
                        <Link
                          to="/devis/$id"
                          params={{ id: d.id }}
                          className="flex items-center justify-between gap-3 px-1 py-3 transition hover:bg-dashboard-raised/50"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-dashboard-foreground">
                              {d.client_nom}
                            </span>
                            <span className="block text-mono text-[11px] text-dashboard-muted">{d.numero}</span>
                          </span>
                          <span className="flex items-center gap-2">
                            <span className={`inline-flex items-center rounded border px-2 py-0.5 text-[11px] font-bold ${badge.cls}`}>
                              {badge.label}
                            </span>
                            <span className="text-mono text-xs font-bold text-dashboard-foreground">
                              {euro(Number(d.total_ttc))}
                            </span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <Panel
              icon={CalendarClock}
              title="Prochains rendez-vous"
              action={{ to: "/planning", label: "Voir le planning" }}
            >
              {!aVenir.length ? (
                <Empty>Aucun rendez-vous planifié.</Empty>
              ) : (
                <ul className="divide-y divide-dashboard-line/60">
                  {aVenir.slice(0, 4).map((r) => {
                    const dj = moisJour(r.date_debut);
                    return (
                      <li key={r.id}>
                        <Link
                          to="/planning"
                          search={{ rdv: r.id }}
                          className="flex items-center gap-4 rounded-md px-1 py-3 transition hover:bg-dashboard-raised/60"
                        >
                          <span className="flex h-12 w-12 flex-shrink-0 flex-col items-center justify-center rounded-2xl bg-primary/15 text-primary">
                            <span className="text-xl font-bold leading-none">{dj.jour}</span>
                            <span className="text-[9px] font-bold uppercase leading-none">{dj.mois}</span>
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-semibold">{r.client_nom}</span>
                            <span className="mt-0.5 block truncate text-xs text-dashboard-muted">
                              {dj.heure} — {r.cp_ville || r.adresse}
                            </span>
                          </span>
                          <ArrowUpRight className="h-4 w-4 flex-shrink-0 text-primary" />
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Panel>

            <Panel
              icon={Inbox}
              title="Demandes qui viennent d'arriver"
              action={{ to: "/demandes", label: "Boîte de réception" }}
            >
              {!nouvelles.length ? (
                <Empty>Aucune nouvelle demande.</Empty>
              ) : (
                <ul className="space-y-3">
                  {nouvelles.map((d) => (
                    <li
                      key={d.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashboard-line/60 bg-dashboard-raised/60 p-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold">
                          {d.nom}{" "}
                          <span className="font-mono text-xs font-normal text-dashboard-muted">
                            {d.code_postal}
                          </span>
                        </p>
                        <p className="mt-1 text-xs text-dashboard-muted">
                          Reçue le {dateCourteFr(d.created_at)}
                          {d.formule ? ` · formule ${d.formule}` : ""}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => accepter.mutate(d.id)}
                        disabled={accepter.isPending}
                        className="min-h-11 rounded-md bg-dashboard-cyan font-bold text-dashboard-panel hover:brightness-110"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Accepter
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel
              icon={Wrench}
              title="Derniers travaux réalisés"
              action={{ to: "/rapports", label: "Rapports" }}
            >
              {!realises.length ? (
                <Empty>Aucun chantier réalisé pour l'instant.</Empty>
              ) : (
                <ul className="divide-y divide-border">
                  {realises.map((r) => (
                    <li key={r.id} className="py-3 flex items-baseline justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{r.client_nom}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {r.titre} · {r.cp_ville || r.adresse}
                        </p>
                      </div>
                      <span className="text-mono text-xs whitespace-nowrap text-emerald-600 dark:text-emerald-400">
                        {r.chantier_valide ? "Validé" : "Réalisé"} · {dateCourteFr(r.date_debut)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

          </div>

          <p className="neo-dashboard-muted mt-6 text-mono text-[10px]">
            Chiffre d'affaires du mois en cours : {euro(q.data?.stats.caMois ?? 0)} · la carte des
            interventions se trouve dans l'onglet Planning.
          </p>
        </>
      )}
      </div>
    </ProShell>
  );
}

function SimpleStat({
  icon: Icon,
  label,
  value,
  hint,
  to,
  search,
}: {
  icon: typeof Euro;
  label: string;
  value: string;
  hint?: string;
  to?: string;
  search?: Record<string, string>;
}) {
  const contenu = (
    <div className="space-y-2">
      <p className="neo-dashboard-muted flex items-center gap-2 text-mono text-[10px] uppercase tracking-[0.12em]">
          <Icon className="h-4 w-4" /> {label}
      </p>
      <p className="truncate font-mono text-2xl font-bold text-dashboard-foreground">{value}</p>
      {hint && <p className="text-xs text-dashboard-muted">{hint}</p>}
    </div>
  );
  const cls = "group block rounded-md border border-dashboard-line bg-dashboard-panel p-5";
  if (!to) return <div className={cls}>{contenu}</div>;
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Link to={to as any} search={search as any} className={cls}>
      {contenu}
    </Link>
  );
}


function Panel({
  icon: Icon,
  title,
  action,
  children,
}: {
  icon: typeof Euro;
  title: string;
  action?: { to: string; label: string };
  children: React.ReactNode;
}) {
  return (
    <section className="neo-dashboard-panel rounded-md p-5">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-sm font-bold flex items-center gap-2">
          <Icon className="h-4 w-4 text-dashboard-foreground" /> {title}
        </h2>
        {action && (
          <Link
            to={action.to}
            className="text-mono text-[10px] font-bold text-dashboard-foreground hover:underline whitespace-nowrap"
          >
            {action.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="neo-dashboard-muted py-2 text-sm">{children}</p>;
}

export { STATUT_DEMANDE };
