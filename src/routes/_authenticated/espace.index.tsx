import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleDollarSign,
  Clock3,
  Euro,
  FileCheck2,
  FilePlus2,
  FileText,
  Loader2,
  Receipt,
  TrendingUp,
} from "lucide-react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getDashboard } from "@/lib/planning.functions";
import { updateFactureStatut } from "@/lib/factures.functions";
import { ProShell } from "@/components/ProShell";
import { euro } from "@/lib/company";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/espace/")({
  head: () => ({
    meta: [
      { title: "Tableau de bord — Espace pro Borne de l'Ouest" },
      {
        name: "description",
        content: "Tableau de bord professionnel IRVE Technologie pour suivre l’activité, les devis, les factures et les rendez-vous.",
      },
      { property: "og:title", content: "Tableau de bord — Espace pro Borne de l'Ouest" },
      { property: "og:description", content: "Pilotage de l’activité, des devis, des factures et des rendez-vous IRVE Technologie." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: EspacePage,
});

type FactureSuivi = {
  id: string;
  numero: string;
  client_nom: string;
  total_ttc: number | string | null;
  date_echeance: string | null;
  paid_at: string | null;
  bon_commande: string | null;
  numero_affaire: string | null;
};

const dateFr = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(iso));

const moisJour = (iso: string) => {
  const date = new Date(iso);
  return {
    mois: date.toLocaleDateString("fr-FR", { month: "short" }).replace(".", ""),
    jour: date.toLocaleDateString("fr-FR", { day: "2-digit" }),
    heure: date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }),
  };
};

function EspacePage() {
  const fetchDashboard = useServerFn(getDashboard);
  const setFactureStatut = useServerFn(updateFactureStatut);
  const qc = useQueryClient();
  const q = useQuery({ queryKey: ["dashboard"], queryFn: () => fetchDashboard() });
  const encaisser = useMutation({
    mutationFn: (id: string) => setFactureStatut({ data: { id, statut: "payee" } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["dashboard"] }),
  });

  const rendezvous = q.data?.rendezvous ?? [];
  const aVenir = rendezvous
    .filter((rdv) => new Date(rdv.date_debut).getTime() >= Date.now() - 36e5 && rdv.statut !== "annule")
    .slice(0, 4);
  const devis = q.data?.devis ?? [];
  const devisActifs = devis.filter((document) => document.statut !== "annule");
  const facturesEnAttente = q.data?.aEncaisser ?? [];

  const activite = useMemo(() => {
    const formatter = new Intl.DateTimeFormat("fr-FR", { month: "short" });
    const mois = Array.from({ length: 6 }, (_, index) => {
      const date = new Date();
      date.setDate(1);
      date.setMonth(date.getMonth() - (5 - index));
      return {
        key: `${date.getFullYear()}-${date.getMonth()}`,
        mois: formatter.format(date).replace(".", ""),
        devis: 0,
        factures: 0,
      };
    });
    const index = new Map(mois.map((item) => [item.key, item]));
    for (const document of devis) {
      const date = new Date(document.created_at);
      const item = index.get(`${date.getFullYear()}-${date.getMonth()}`);
      if (item) item.devis += Number(document.total_ttc ?? 0);
    }
    for (const facture of q.data?.factures ?? []) {
      const date = new Date(facture.date_emission);
      const item = index.get(`${date.getFullYear()}-${date.getMonth()}`);
      if (item) item.factures += Number(facture.total_ttc ?? 0);
    }
    return mois;
  }, [devis, q.data?.factures]);

  return (
    <ProShell>
      <div className="dashboard-reference -m-3 min-h-[calc(100vh-4rem)] bg-dashboard-canvas sm:-m-5 lg:-m-6">
        <DashboardHeader />

        <div className="mx-auto max-w-[1440px] space-y-6 px-4 py-5 sm:px-6 sm:py-7 lg:px-8 lg:py-8">
          {q.isLoading ? (
            <div className="flex min-h-72 items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-dashboard-blue" />
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                  tone="green"
                  icon={Euro}
                  label="Chiffre d’affaires"
                  value={euro(q.data?.stats.caEncaisse ?? 0)}
                  detail={`${euro(q.data?.stats.caMois ?? 0)} encaissé ce mois`}
                  to="/factures"
                />
                <MetricCard
                  tone="blue"
                  icon={FileText}
                  label="Devis émis"
                  value={String(devisActifs.length)}
                  detail={`${euro(q.data?.stats.caDevis ?? 0)} proposés`}
                  to="/devis"
                />
                <MetricCard
                  tone="violet"
                  icon={Receipt}
                  label="Factures en attente"
                  value={euro(q.data?.stats.caEnAttente ?? 0)}
                  detail={`${facturesEnAttente.length} facture(s) à encaisser`}
                  to="/facturation"
                />
                <MetricCard
                  tone="orange"
                  icon={CalendarDays}
                  label="Rendez-vous"
                  value={String(q.data?.stats.rdvAVenir ?? 0)}
                  detail={`${q.data?.stats.rdvSemaine ?? 0} dans les 7 prochains jours`}
                  to="/planning"
                />
              </div>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,.72fr)]">
                <ActivityChart data={activite} />
                <QuickOverview
                  devis={devisActifs.length}
                  factures={facturesEnAttente.length}
                  rendezvous={q.data?.stats.rdvAVenir ?? 0}
                  termines={q.data?.stats.chantiersValides ?? 0}
                />
              </div>

              <div className="grid gap-6 xl:grid-cols-[minmax(0,1.18fr)_minmax(0,.82fr)]">
                <NextAppointments rendezvous={aVenir} />
                <RecentQuotes devis={devisActifs.slice(0, 5)} />
              </div>

              <InvoiceTracking
                invoices={facturesEnAttente}
                paid={q.data?.encaissees ?? []}
                onPaid={(id) => encaisser.mutate(id)}
                pendingId={encaisser.isPending ? encaisser.variables : undefined}
              />
            </>
          )}
        </div>
      </div>
    </ProShell>
  );
}

function DashboardHeader() {
  return (
    <header className="bg-dashboard-navy text-dashboard-on-navy shadow-sm">
      <div className="mx-auto flex min-h-40 max-w-[1440px] flex-col justify-center gap-6 px-4 py-8 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
        <div>
          <p className="mb-2 text-sm font-bold text-dashboard-green">IRVE Technologie</p>
          <h1 className="text-3xl font-extrabold sm:text-4xl">Tableau de bord</h1>
          <p className="mt-2 text-sm text-dashboard-on-navy-muted sm:text-base">Votre activité en un coup d’œil</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button asChild className="min-h-12 bg-dashboard-green px-6 font-bold text-dashboard-on-green shadow-sm hover:bg-dashboard-green/90">
            <Link to="/devis"><FilePlus2 /> Nouveau devis</Link>
          </Button>
          <Button asChild variant="outline" className="min-h-12 border-dashboard-navy-line bg-dashboard-navy-raised px-6 text-dashboard-on-navy hover:bg-dashboard-navy-raised/80 hover:text-dashboard-on-navy">
            <Link to="/planning"><CalendarDays /> Nouveau rendez-vous</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

const metricClasses = {
  green: "border-dashboard-green bg-dashboard-green-soft text-dashboard-green",
  blue: "border-dashboard-blue bg-dashboard-blue-soft text-dashboard-blue",
  violet: "border-dashboard-purple bg-dashboard-purple-soft text-dashboard-purple",
  orange: "border-dashboard-orange bg-dashboard-orange-soft text-dashboard-orange",
} as const;

function MetricCard({ tone, icon: Icon, label, value, detail, to }: {
  tone: keyof typeof metricClasses;
  icon: typeof Euro;
  label: string;
  value: string;
  detail: string;
  to: string;
}) {
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Link to={to as any} className={`group block min-w-0 rounded-md border-l-[5px] bg-card p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${metricClasses[tone]}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-dashboard-copy-muted">{label}</p>
          <p className="mt-2 break-words text-[1.7rem] font-extrabold leading-none text-dashboard-copy 2xl:text-3xl">{value}</p>
        </div>
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-current/10">
          <Icon className="h-5 w-5 stroke-[2.25]" />
        </span>
      </div>
      <p className="mt-4 text-xs leading-relaxed text-dashboard-copy-muted">{detail}</p>
    </Link>
  );
}

function ActivityChart({ data }: { data: Array<{ mois: string; devis: number; factures: number }> }) {
  return (
    <DashboardPanel title="Évolution de l’activité" icon={TrendingUp}>
      <div className="mb-4 flex flex-wrap gap-4 text-xs text-dashboard-copy-muted">
        <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-dashboard-blue" />Devis</span>
        <span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-dashboard-green" />Factures</span>
      </div>
      <div className="h-72 w-full min-w-0 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="devisFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--dashboard-blue)" stopOpacity={0.26} />
                <stop offset="100%" stopColor="var(--dashboard-blue)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--dashboard-rule)" strokeDasharray="4 4" />
            <XAxis dataKey="mois" axisLine={false} tickLine={false} tick={{ fill: "var(--dashboard-copy-muted)", fontSize: 11 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: "var(--dashboard-copy-muted)", fontSize: 11 }} tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
            <Tooltip formatter={(value) => euro(Number(value))} contentStyle={{ borderRadius: 6, border: "1px solid var(--dashboard-rule)" }} />
            <Area isAnimationActive={false} type="monotone" dataKey="devis" stroke="var(--dashboard-blue)" strokeWidth={3} fill="url(#devisFill)" />
            <Area isAnimationActive={false} type="monotone" dataKey="factures" stroke="var(--dashboard-green)" strokeWidth={3} fill="transparent" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </DashboardPanel>
  );
}

function QuickOverview({ devis, factures, rendezvous, termines }: { devis: number; factures: number; rendezvous: number; termines: number }) {
  const items = [
    { icon: FileCheck2, label: "Devis en cours", value: devis, tone: "text-dashboard-blue bg-dashboard-blue-soft" },
    { icon: CircleDollarSign, label: "À encaisser", value: factures, tone: "text-dashboard-purple bg-dashboard-purple-soft" },
    { icon: CalendarDays, label: "À venir", value: rendezvous, tone: "text-dashboard-orange bg-dashboard-orange-soft" },
    { icon: CheckCircle2, label: "Chantiers validés", value: termines, tone: "text-dashboard-green bg-dashboard-green-soft" },
  ];
  return (
    <DashboardPanel title="Aperçu rapide" icon={Clock3}>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
        {items.map(({ icon: Icon, label, value, tone }) => (
          <div key={label} className="flex min-h-14 items-center gap-3 rounded-md border border-dashboard-rule bg-dashboard-subtle p-3">
            <span className={`flex h-10 w-10 items-center justify-center rounded-md ${tone}`}><Icon className="h-4 w-4" /></span>
            <span className="min-w-0 flex-1 text-sm font-medium text-dashboard-copy">{label}</span>
            <strong className="text-lg text-dashboard-copy">{value}</strong>
          </div>
        ))}
      </div>
    </DashboardPanel>
  );
}

function NextAppointments({ rendezvous }: { rendezvous: Array<{ id: string; date_debut: string; client_nom: string; titre: string; cp_ville: string | null; adresse: string }> }) {
  return (
    <DashboardPanel title="Prochains rendez-vous" icon={CalendarDays} action={{ to: "/planning", label: "Voir le planning" }}>
      {!rendezvous.length ? <Empty>Aucun rendez-vous planifié.</Empty> : (
        <ul className="divide-y divide-dashboard-rule">
          {rendezvous.map((rdv) => {
            const date = moisJour(rdv.date_debut);
            return (
              <li key={rdv.id}>
                <Link to="/planning" search={{ rdv: rdv.id }} className="group flex items-center gap-3 py-3">
                  <span className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-md bg-dashboard-blue-soft text-dashboard-blue">
                    <strong className="text-lg leading-none">{date.jour}</strong><span className="text-[10px] font-bold uppercase">{date.mois}</span>
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-dashboard-copy">{rdv.client_nom}</span>
                    <span className="mt-0.5 block truncate text-xs text-dashboard-copy-muted">{date.heure} · {rdv.cp_ville || rdv.adresse}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-dashboard-copy-muted group-hover:text-dashboard-blue" />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </DashboardPanel>
  );
}

function RecentQuotes({ devis }: { devis: Array<{ id: string; numero: string; client_nom: string; total_ttc: number | string | null; statut: string; created_at: string }> }) {
  return (
    <DashboardPanel title="Devis récents" icon={FileText} action={{ to: "/devis", label: "Tous les devis" }}>
      {!devis.length ? <Empty>Aucun devis récent.</Empty> : (
        <ul className="divide-y divide-dashboard-rule">
          {devis.map((document) => (
            <li key={document.id}>
              <Link to="/devis/$id" params={{ id: document.id }} className="group flex items-center gap-3 py-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-dashboard-green-soft text-dashboard-green"><FileText className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-dashboard-copy">{document.client_nom}</span>
                  <span className="block truncate text-xs text-dashboard-copy-muted">{document.numero} · {dateFr(document.created_at)}</span>
                </span>
                <strong className="whitespace-nowrap text-sm text-dashboard-copy">{euro(Number(document.total_ttc ?? 0))}</strong>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardPanel>
  );
}

function InvoiceTracking({ invoices, paid, onPaid, pendingId }: { invoices: FactureSuivi[]; paid: FactureSuivi[]; onPaid: (id: string) => void; pendingId?: string }) {
  const [tab, setTab] = useState<"waiting" | "paid">("waiting");
  const rows = tab === "waiting" ? invoices : paid;
  return (
    <DashboardPanel title="Suivi des factures" icon={Receipt} action={{ to: "/factures", label: "Toutes les factures" }}>
      <div className="mb-3 flex gap-1 border-b border-dashboard-rule">
        <Button type="button" variant="ghost" onClick={() => setTab("waiting")} className={`rounded-none border-b-2 px-3 ${tab === "waiting" ? "border-dashboard-blue text-dashboard-blue" : "border-transparent text-dashboard-copy-muted"}`}>À encaisser ({invoices.length})</Button>
        <Button type="button" variant="ghost" onClick={() => setTab("paid")} className={`rounded-none border-b-2 px-3 ${tab === "paid" ? "border-dashboard-green text-dashboard-green" : "border-transparent text-dashboard-copy-muted"}`}>Encaissées ({paid.length})</Button>
      </div>
      {!rows.length ? <Empty>{tab === "waiting" ? "Aucune facture à encaisser." : "Aucune facture encaissée."}</Empty> : (
        <ul className="divide-y divide-dashboard-rule">
          {rows.slice(0, 6).map((facture) => (
            <li key={facture.id} className="flex flex-wrap items-center gap-3 py-3 sm:flex-nowrap">
              <Link to="/factures/$id" params={{ id: facture.id }} className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-dashboard-copy">{facture.client_nom}</span>
                <span className="block truncate text-xs text-dashboard-copy-muted">{facture.numero}{facture.date_echeance ? ` · échéance ${dateFr(facture.date_echeance)}` : ""}</span>
              </Link>
              <strong className="whitespace-nowrap text-sm text-dashboard-copy">{euro(Number(facture.total_ttc ?? 0))}</strong>
              {tab === "waiting" && (
                <Button size="sm" variant="outline" disabled={pendingId === facture.id} onClick={() => onPaid(facture.id)} className="border-dashboard-green text-dashboard-green hover:bg-dashboard-green-soft">
                  {pendingId === facture.id ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Encaissée
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </DashboardPanel>
  );
}

function DashboardPanel({ title, icon: Icon, action, children }: { title: string; icon: typeof Euro; action?: { to: string; label: string }; children: React.ReactNode }) {
  return (
    <section className="min-w-0 rounded-md border border-dashboard-rule bg-card p-5 shadow-sm sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2 text-lg font-bold text-dashboard-copy"><Icon className="h-5 w-5 shrink-0 text-dashboard-blue" />{title}</h2>
        {action && <Link to={action.to} className="flex shrink-0 items-center gap-1 text-xs font-semibold text-dashboard-blue hover:underline">{action.label}<ArrowRight className="h-3.5 w-3.5" /></Link>}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-center text-sm text-dashboard-copy-muted">{children}</p>;
}