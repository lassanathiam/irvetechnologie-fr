import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  CalendarClock,
  CheckCircle2,
  Euro,
  FileText,
  Inbox,
  Loader2,
  MapPin,
  Receipt,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { getDashboard } from "@/lib/planning.functions";
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

const dateTimeFr = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));

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
  const [docTab, setDocTab] = useState<"devis" | "factures">("devis");

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
  const acceptees = demandes.filter((d) => d.status === "accepte").slice(0, 6);


  return (
    <ProShell>
      <div className="pro-workspace neo-dashboard overflow-hidden rounded-lg p-4 sm:p-7">
      <div className="grid gap-5 border-b border-dashboard-line pb-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
        <div className="min-w-0">
          <div className="mb-3 flex items-center gap-2 text-dashboard-foreground">
            <span className="h-2 w-2 rounded-full bg-dashboard-raised animate-pulse" />
            <span className="text-mono text-[11px]">Pilotage en direct</span>
          </div>
          <h1 className="pro-title text-3xl leading-tight sm:text-5xl">Tableau de bord</h1>
          <p className="neo-dashboard-muted mt-2 text-sm">
            Activité, chiffre d'affaires et interventions en un coup d'œil
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            to="/planning"
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-dashboard-line bg-dashboard-raised px-4 py-2.5 text-xs font-bold text-dashboard-foreground transition hover:border-dashboard-muted"
          >
            <CalendarClock className="h-4 w-4" /> Planifier un rendez-vous
          </Link>
          <Link
            to="/devis"
            className="inline-flex min-h-11 items-center gap-2 rounded-md border border-dashboard-line bg-dashboard-panel px-4 py-2.5 text-xs font-bold text-dashboard-foreground transition hover:border-dashboard-muted"
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
            <div className="neo-dashboard-panel mt-6 rounded-md border-l-4 border-l-dashboard-line p-5">
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
                        {new Date(r.demarre_at!).toLocaleTimeString("fr-FR", {
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

          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              icon={Euro}
              label="Encaissé"
              value={euro(q.data?.stats.caEncaisse ?? 0)}
              hint={`${euro(q.data?.stats.caMois ?? 0)} ce mois`}
              to="/factures"
              accent="cyan"
            />
            <Stat
              icon={Receipt}
              label="À encaisser"
              value={euro(q.data?.stats.caEnAttente ?? 0)}
              hint="Factures en attente"
              to="/factures"
              accent="violet"
            />
            <Stat
              icon={FileText}
              label="Devis établis"
              value={euro(q.data?.stats.caDevis ?? 0)}
              hint={`${q.data?.devis.length ?? 0} devis récents`}
              to="/devis"
            />
            <Stat
              icon={CalendarClock}
              label="Rendez-vous"
              value={String(q.data?.stats.rdvAVenir ?? 0)}
              hint={`${q.data?.stats.rdvSemaine ?? 0} dans les 7 jours`}
              to="/planning"
            />
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
            <section className="neo-dashboard-panel overflow-hidden rounded-md lg:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-dashboard-line px-5 py-4">
                <div>
                  <p className="text-mono text-[10px] text-dashboard-foreground">Flux financier</p>
                  <h2 className="mt-1 text-lg font-bold">Derniers devis et factures</h2>
                </div>
                <Link to="/factures" className="inline-flex min-h-11 items-center gap-1 text-xs font-bold text-dashboard-foreground">
                  Tout afficher <ArrowUpRight className="h-4 w-4" />
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px] text-left text-sm">
                  <thead className="neo-dashboard-muted bg-dashboard-raised text-mono text-[10px]">
                    <tr><th className="px-5 py-3">Document</th><th className="px-4 py-3">Client</th><th className="px-4 py-3">État</th><th className="px-5 py-3 text-right">Montant TTC</th></tr>
                  </thead>
                  <tbody className="divide-y divide-dashboard-line">
                    {(q.data?.factures ?? []).slice(0, 4).map((f) => (
                      <tr key={`facture-${f.id}`} className="transition hover:bg-dashboard-raised">
                        <td className="px-5 py-3.5"><Link to="/factures/$id" params={{ id: f.id }} className="font-mono text-xs text-dashboard-foreground">{f.numero}</Link></td>
                        <td className="px-4 py-3.5 font-semibold">{f.client_nom}</td>
                        <td className="px-4 py-3.5"><span className={f.statut === "payee" ? "text-dashboard-foreground" : "text-dashboard-muted"}>{f.statut === "payee" ? "Payée" : "En attente"}</span></td>
                        <td className="px-5 py-3.5 text-right font-mono font-bold">{euro(Number(f.total_ttc))}</td>
                      </tr>
                    ))}
                    {(q.data?.devis ?? []).slice(0, 3).map((d) => (
                      <tr key={`devis-${d.id}`} className="transition hover:bg-dashboard-raised">
                        <td className="px-5 py-3.5"><Link to="/devis/$id" params={{ id: d.id }} className="font-mono text-xs text-dashboard-muted">{d.numero}</Link></td>
                        <td className="px-4 py-3.5 font-semibold">{d.client_nom}</td>
                        <td className="px-4 py-3.5 neo-dashboard-muted">Devis · {d.statut}</td>
                        <td className="px-5 py-3.5 text-right font-mono font-bold">{euro(Number(d.total_ttc))}</td>
                      </tr>
                    ))}
                    {!q.data?.factures.length && !q.data?.devis.length && <tr><td colSpan={4} className="neo-dashboard-muted px-5 py-8 text-center">Aucun document financier.</td></tr>}
                  </tbody>
                </table>
              </div>
            </section>
            <Panel
              icon={CalendarClock}
              title="Prochains rendez-vous"
              action={{ to: "/planning", label: "Voir le planning" }}
            >
              {!aVenir.length ? (
                <Empty>Aucun rendez-vous planifié.</Empty>
              ) : (
                <ul className="divide-y divide-border">
                  {aVenir.map((r) => (
                    <li key={r.id}>
                      <Link
                        to="/planning"
                        search={{ rdv: r.id }}
                        className="py-3.5 flex flex-wrap items-baseline justify-between gap-3 hover:text-primary"
                      >
                        <span className="min-w-0">
                          <span className="block text-base font-semibold truncate">
                            {r.client_nom}
                          </span>
                          <span className="mt-1 block text-sm text-muted-foreground truncate">
                            <MapPin className="inline h-3.5 w-3.5 mr-1" />
                            {r.cp_ville || r.adresse}
                          </span>
                        </span>
                        <span className="text-mono text-sm font-bold text-primary whitespace-nowrap">
                          {dateTimeFr(r.date_debut)}
                        </span>
                      </Link>
                    </li>
                  ))}
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
                <ul className="divide-y divide-border">
                  {nouvelles.map((d) => (
                    <li key={d.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {d.nom}{" "}
                          <span className="text-mono text-xs font-normal text-muted-foreground">
                            {d.code_postal}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Reçue le {dateCourteFr(d.created_at)}
                          {d.formule ? ` · formule ${d.formule}` : ""}
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => accepter.mutate(d.id)}
                        disabled={accepter.isPending}
                        className="min-h-11 border-dashboard-line bg-dashboard-raised text-dashboard-foreground hover:border-dashboard-muted"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Accepter
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel
              icon={ShieldCheck}
              title="Clients validés — prêts pour un devis"
              action={{ to: "/demandes", label: "Toutes les demandes" }}
            >
              {!acceptees.length ? (
                <Empty>
                  Acceptez une demande pour créer son devis en un clic, coordonnées client déjà
                  remplies.
                </Empty>
              ) : (
                <ul className="divide-y divide-border">
                  {acceptees.map((d) => (
                    <li key={d.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">{d.nom}</p>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {d.email} · {d.telephone} · {d.code_postal}
                        </p>
                      </div>
                      <Link
                        to="/devis"
                        search={{ demande: d.id }}
                        className="hero-grad text-primary-foreground text-mono text-[11px] font-bold rounded-full px-3 py-1.5 inline-flex items-center gap-1.5 transition hover:brightness-110"
                      >
                        Créer le devis <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
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

            <Panel icon={FileText} title="Devis récents" action={{ to: "/devis", label: "Gérer les devis" }}>
              {!q.data?.devis.length ? (
                <Empty>Aucun devis.</Empty>
              ) : (
                <ul className="divide-y divide-border">
                  {q.data.devis.slice(0, 6).map((d) => (
                    <li key={d.id} className="py-3 flex items-baseline justify-between gap-4">
                      <Link
                        to="/devis/$id"
                        params={{ id: d.id }}
                        className="min-w-0 truncate text-sm font-semibold hover:text-primary"
                      >
                        <span className="text-mono text-xs text-primary">{d.numero}</span> {d.client_nom}
                      </Link>
                      <span className="text-mono text-xs font-bold whitespace-nowrap">
                        {euro(Number(d.total_ttc))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel icon={Receipt} title="Factures" action={{ to: "/factures", label: "Gérer les factures" }}>
              {!q.data?.factures.length ? (
                <Empty>Aucune facture.</Empty>
              ) : (
                <ul className="divide-y divide-border">
                  {q.data.factures.map((f) => (
                    <li key={f.id} className="py-3 flex items-baseline justify-between gap-4">
                      <Link
                        to="/factures/$id"
                        params={{ id: f.id }}
                        className="min-w-0 truncate text-sm font-semibold hover:text-primary"
                      >
                        <span className="text-mono text-xs text-primary">{f.numero}</span> {f.client_nom}
                      </Link>
                      <span className="text-mono text-xs font-bold whitespace-nowrap">
                        {euro(Number(f.total_ttc))}
                        <span
                          className={`ml-2 rounded-full px-2 py-0.5 text-[10px] ${
                            f.statut === "payee"
                              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {f.statut === "payee" ? "Payée" : "En attente"}
                        </span>
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

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  to,
  search,
  accent,
}: {
  icon: typeof Euro;
  label: string;
  value: string;
  hint?: string;
  to?: string;
  search?: Record<string, string>;
  accent?: "cyan" | "violet";
}) {
  const contenu = (
    <>
      <p className="neo-dashboard-muted flex items-center gap-2 text-mono text-[10px]">
        <Icon className={`h-4 w-4 ${accent === "violet" ? "text-dashboard-muted" : "text-dashboard-foreground"}`} /> {label}
      </p>
      <p className={`mt-4 font-mono text-2xl font-bold sm:text-3xl ${accent === "violet" ? "text-dashboard-muted" : accent === "cyan" ? "text-dashboard-foreground" : "text-dashboard-foreground"}`}>{value}</p>
      {hint && <p className="neo-dashboard-muted mt-2 text-xs">{hint}</p>}
    </>
  );
  const cls =
    "group block neo-dashboard-kpi rounded-md p-5 transition hover:-translate-y-0.5 hover:border-dashboard-muted";
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
