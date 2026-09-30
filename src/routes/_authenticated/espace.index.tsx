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
  HeartPulse,
  Hand,
  Loader2,
  MapPin,
  Receipt,
  TrendingUp,
} from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { getDashboard } from "@/lib/planning.functions";
import { updateFactureStatut } from "@/lib/factures.functions";
import { ProShell } from "@/components/ProShell";
import { euro } from "@/lib/company";
import { Button } from "@/components/ui/button";
import borneHero from "@/assets/borne-hero.jpg";

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
    const formatter = new Intl.DateTimeFormat("fr-FR", { weekday: "short" });
    const jours = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setHours(0, 0, 0, 0);
      date.setDate(date.getDate() - (6 - index));
      return {
        key: date.toISOString().slice(0, 10),
        jour: formatter.format(date).replace(".", ""),
        interventions: 0,
      };
    });
    const index = new Map(jours.map((item) => [item.key, item]));
    for (const rendezvousTermine of rendezvous) {
      if (!rendezvousTermine.termine_at || (rendezvousTermine.statut !== "termine" && rendezvousTermine.statut !== "realise")) continue;
      const date = new Date(rendezvousTermine.termine_at);
      const item = index.get(date.toISOString().slice(0, 10));
      if (item) item.interventions += 1;
    }
    return jours;
  }, [rendezvous]);

  return (
    <ProShell dashboardReference>
      <div className="dashboard-reference -m-3 min-h-[calc(100vh-4rem)] bg-dashboard-canvas p-3 sm:-m-5 sm:p-5 lg:-m-6 lg:p-6">
        <div className="mx-auto max-w-[1500px] space-y-4">
          {q.isLoading ? (
            <div className="flex min-h-72 items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-dashboard-blue" />
            </div>
          ) : (
            <>
              <DashboardHeader />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
                  icon={FileCheck2}
                  label="Chantiers à facturer"
                  value={String(q.data?.stats.chantiersTerminesAFacturer ?? 0)}
                  detail="Terminés et prêts à facturer"
                  to="/facturation"
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

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(250px,.84fr)_minmax(240px,.82fr)]">
                <ActivityChart data={activite} />
                <QuickOverview aFacturer={q.data?.stats.chantiersTerminesAFacturer ?? 0} factures={facturesEnAttente.length} rendezvous={q.data?.stats.rdvAVenir ?? 0} termines={q.data?.stats.chantiersValides ?? 0} />
                <div className="grid gap-4">
                  <PromoCard />
                  <NextAppointments rendezvous={aVenir.slice(0, 1)} />
                  <HealthCard />
                </div>
              </div>
              <RecentQuotes devis={devisActifs.slice(0, 4)} />
            </>
          )}
        </div>
      </div>
    </ProShell>
  );
}

function DashboardHeader() {
  return (
    <header className="flex flex-col gap-3 py-1 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-dashboard-copy sm:text-3xl">Bonjour Lassana <Hand className="h-6 w-6 text-dashboard-orange" aria-hidden="true" /></h1>
        <p className="mt-1 text-sm text-dashboard-copy-muted">Voici un aperçu de votre activité IRVE aujourd’hui.</p>
      </div>
      <div className="rounded-md border border-dashboard-rule bg-card px-4 py-2 text-sm font-semibold text-dashboard-copy shadow-sm">{new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "2-digit", month: "short", year: "numeric" }).format(new Date())}</div>
    </header>
  );
}

const metricClasses = {
  green: "border-dashboard-green bg-dashboard-green-soft",
  blue: "border-dashboard-blue bg-dashboard-blue-soft",
  violet: "border-dashboard-purple bg-dashboard-purple-soft",
  orange: "border-dashboard-orange bg-dashboard-orange-soft",
} as const;

const metricIconClasses = {
  green: "bg-dashboard-green",
  blue: "bg-dashboard-blue",
  violet: "bg-dashboard-purple",
  orange: "bg-dashboard-orange",
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
    <Link to={to as any} className={`group block min-h-32 min-w-0 rounded-md border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${metricClasses[tone]}`}>
      <div className="flex items-start justify-between gap-2">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-dashboard-on-navy ${metricIconClasses[tone]}`}>
          <Icon className="h-5 w-5 stroke-[2.25]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-dashboard-copy-muted">{label}</p>
          <p className="mt-1 whitespace-nowrap text-2xl font-extrabold leading-none text-dashboard-copy">{value}</p>
        </div>
      </div>
      <p className="mt-5 text-xs font-semibold leading-relaxed text-dashboard-green">↗ {detail}</p>
    </Link>
  );
}

function ActivityChart({ data }: { data: Array<{ jour: string; interventions: number }> }) {
  return (
    <DashboardPanel title="Interventions terminées" icon={TrendingUp}>
      <div className="h-60 w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: -10, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--dashboard-rule)" strokeDasharray="4 4" />
            <XAxis dataKey="jour" axisLine={false} tickLine={false} tick={{ fill: "var(--dashboard-copy-muted)", fontSize: 11 }} />
            <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: "var(--dashboard-copy-muted)", fontSize: 11 }} />
            <Tooltip formatter={(value) => [`${Number(value)} chantier${Number(value) > 1 ? "s" : ""}`, "Terminés"]} contentStyle={{ borderRadius: 6, border: "1px solid var(--dashboard-rule)" }} />
            <Bar dataKey="interventions" fill="var(--dashboard-green)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </DashboardPanel>
  );
}

function QuickOverview({ aFacturer, factures, rendezvous, termines }: { aFacturer: number; factures: number; rendezvous: number; termines: number }) {
  const items = [
    { icon: FileCheck2, label: "À facturer", value: aFacturer, tone: "text-dashboard-blue bg-dashboard-blue-soft" },
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
    <DashboardPanel title="Prochain rendez-vous" icon={CalendarDays}>
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
    <DashboardPanel title="Devis récents" icon={FileText} action={{ to: "/devis", label: "Tout afficher" }}>
      {!devis.length ? <Empty>Aucun devis récent.</Empty> : (
        <div className="overflow-x-auto"><table className="w-full min-w-[620px] text-left text-xs"><thead className="text-[10px] uppercase text-dashboard-copy-muted"><tr><th className="pb-3">Référence</th><th className="pb-3">Client</th><th className="pb-3">Statut</th><th className="pb-3 text-right">Montant TTC</th><th className="pb-3 text-right">Date</th></tr></thead><tbody className="divide-y divide-dashboard-rule">
          {devis.map((document) => (
            <tr key={document.id}><td className="py-3 font-bold text-dashboard-green"><Link to="/devis/$id" params={{ id: document.id }}>{document.numero}</Link></td><td className="py-3 font-semibold text-dashboard-copy">{document.client_nom}</td><td className="py-3"><span className="rounded bg-dashboard-blue-soft px-3 py-1 font-semibold text-dashboard-blue">Envoyé</span></td><td className="py-3 text-right font-bold text-dashboard-copy">{euro(Number(document.total_ttc ?? 0))}</td><td className="py-3 text-right text-dashboard-copy-muted">{dateFr(document.created_at)}</td></tr>
          ))}
        </tbody></table></div>
      )}
    </DashboardPanel>
  );
}

function PromoCard() {
  return <section className="relative min-h-32 overflow-hidden rounded-md bg-dashboard-green p-5 text-dashboard-on-navy shadow-sm"><img src={borneHero} alt="Borne de recharge IRVE" className="absolute inset-0 h-full w-full object-cover opacity-40" /><div className="absolute inset-0 bg-dashboard-promo" /><div className="relative ml-auto max-w-[68%]"><h2 className="font-bold">IRVE Technologie</h2><p className="mt-1 text-xs leading-relaxed">Des solutions de recharge pour aujourd’hui et demain</p><Button asChild size="sm" className="mt-3 bg-card text-dashboard-green hover:bg-card/90"><Link to="/devis"><FilePlus2 /> Nouveau devis</Link></Button></div></section>;
}

function HealthCard() {
  return <section className="flex min-h-20 items-center gap-3 rounded-md border border-dashboard-health-line bg-dashboard-health p-4 text-dashboard-green"><CheckCircle2 className="h-7 w-7 shrink-0" /><div><h2 className="text-sm font-bold">Votre activité est en bonne santé</h2><p className="mt-1 text-xs text-dashboard-copy-muted">Aucun incident à signaler</p></div><HeartPulse className="ml-auto h-7 w-7" /></section>;
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
    <section className="min-w-0 rounded-md border border-dashboard-rule bg-card p-4 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="flex min-w-0 items-center gap-2 text-base font-bold text-dashboard-copy"><Icon className="h-5 w-5 shrink-0 text-dashboard-green" />{title}</h2>
        {action && <Link to={action.to} className="flex shrink-0 items-center gap-1 text-xs font-semibold text-dashboard-blue hover:underline">{action.label}<ArrowRight className="h-3.5 w-3.5" /></Link>}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-center text-sm text-dashboard-copy-muted">{children}</p>;
}