import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, FileText, Loader2, Trash2 } from "lucide-react";
import { ProShell } from "@/components/ProShell";
import { dateFr, euro } from "@/lib/company";
import { deleteFacture, listFactures, updateFactureDepot } from "@/lib/factures.functions";
import {
  periodeDepuisCle,
  totauxParClient,
  type PeriodeCle,
} from "@/lib/factures-par-client";
import { etapeDepotFacture, peutDeposerFacture, type EtapeDepotFacture } from "@/lib/suivi-facturation";

export const Route = createFileRoute("/_authenticated/factures/")({
  head: () => ({
    meta: [
      { title: "Factures — Espace pro Borne de l'Ouest" },
      {
        name: "description",
        content:
          "Suivi des factures, encaissements, envois clients et dépôts sur la plateforme du client.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FacturesPage,
});

const STATUT_LABEL: Record<string, string> = {
  brouillon: "Brouillon",
  validee: "Validée",
  envoyee: "Envoyée",
  payee: "Payée",
  annulee: "Annulée",
};

type FiltreDepot = "toutes" | EtapeDepotFacture;

const FILTRES: { cle: FiltreDepot; label: string }[] = [
  { cle: "toutes", label: "Toutes" },
  { cle: "a_deposer", label: "À déposer" },
  { cle: "deposee", label: "Déposées" },
  { cle: "payee", label: "Payées" },
];

const PERIODES: { cle: PeriodeCle; label: string }[] = [
  { cle: "tout", label: "Depuis le début" },
  { cle: "mois_courant", label: "Ce mois-ci" },
  { cle: "mois_precedent", label: "Mois dernier" },
  { cle: "personnalise", label: "Dates choisies" },
];

function FacturesPage() {
  const qc = useQueryClient();
  const fetchFactures = useServerFn(listFactures);
  const deleteFn = useServerFn(deleteFacture);
  const factures = useQuery({ queryKey: ["factures"], queryFn: () => fetchFactures() });

  const list = factures.data ?? [];
  const total = list.reduce((s, f) => s + Number(f.total_ttc), 0);
  const impaye = list
    .filter((f) => f.statut !== "payee" && f.statut !== "annulee")
    .reduce((s, f) => s + Number(f.total_ttc), 0);

  const [filtre, setFiltre] = useState<FiltreDepot>("toutes");

  // Total par client : période choisie + client dont on a déplié la liste.
  const [periode, setPeriode] = useState<PeriodeCle>("tout");
  const [duPerso, setDuPerso] = useState("");
  const [auPerso, setAuPerso] = useState("");
  const [clientOuvert, setClientOuvert] = useState<string | null>(null);

  const parClient = useMemo(
    () => totauxParClient(list, periodeDepuisCle(periode, new Date(), duPerso, auPerso)),
    [list, periode, duPerso, auPerso],
  );
  const libellePeriode = periodeDepuisCle(periode, new Date(), duPerso, auPerso).libelle;


  const parEtape = useMemo(() => {
    const m = new Map<EtapeDepotFacture, number>([
      ["a_deposer", 0],
      ["deposee", 0],
      ["payee", 0],
    ]);
    for (const f of list) {
      if (!peutDeposerFacture(f)) continue;
      const e = etapeDepotFacture(f);
      m.set(e, (m.get(e) ?? 0) + 1);
    }
    return m;
  }, [list]);

  const aDeposer = useMemo(
    () =>
      list
        .filter((f) => peutDeposerFacture(f) && etapeDepotFacture(f) === "a_deposer")
        .reduce((s, f) => s + Number(f.total_ttc), 0),
    [list],
  );

  const rows = useMemo(
    () =>
      filtre === "toutes"
        ? list
        : list.filter((f) => peutDeposerFacture(f) && etapeDepotFacture(f) === filtre),
    [list, filtre],
  );

  return (
    <ProShell>
      <div className="pro-workspace">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-mono text-[11px] uppercase tracking-[0.2em] text-primary">
            Facturation
          </div>
          <h1 className="mt-2 text-3xl font-medium tracking-tight">Factures</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Depuis un devis accepté, ou directement (prestations au BPU). Cochez « Déposée » dès que la
            facture est sur la plateforme du client.
          </p>
        </div>
        <div className="flex gap-2">
        <Link to="/factures/nouvelle" className="hero-grad text-primary-foreground text-mono text-xs rounded-sm px-4 py-2.5 inline-flex items-center gap-2">
          + Nouvelle facture
        </Link>
        <Link
          to="/devis"
          className="text-mono text-xs border border-border rounded-sm px-4 py-2.5 hover:border-primary hover:text-primary inline-flex items-center gap-2"
        >
          <FileText className="h-3.5 w-3.5" /> Devis
        </Link>
        </div>
      </div>
      </div>

      <div className="mt-8 grid sm:grid-cols-2 lg:grid-cols-5 gap-4">
        <Stat label="Factures" value={String(list.length)} />
        <Stat label="Total facturé TTC" value={euro(total)} />
        <Stat label="À déposer" value={`${parEtape.get("a_deposer") ?? 0} · ${euro(aDeposer)}`} accent />
        <Stat
          label="Consultées par le client"
          value={String(list.filter((f) => f.viewed_at).length)}
        />
        <Stat label="Reste à encaisser" value={euro(impaye)} accent />
      </div>

      <section className="mt-8 overflow-hidden rounded-md border border-border bg-card">
        <h2 className="border-b border-border p-4 text-sm font-bold uppercase tracking-wide text-primary">
          Montant total par client · {libellePeriode}
        </h2>
        <div className="flex flex-wrap items-center gap-2 border-b border-border p-3">
          {PERIODES.map((p) => (
            <button
              key={p.cle}
              type="button"
              aria-pressed={periode === p.cle}
              onClick={() => setPeriode(p.cle)}
              className={`text-mono text-xs rounded-sm border px-3 py-2 ${
                periode === p.cle
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border text-muted-foreground hover:border-primary hover:text-primary"
              }`}
            >
              {p.label}
            </button>
          ))}
          {periode === "personnalise" && (
            <span className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
              <label className="flex items-center gap-1.5">
                Du
                <input
                  type="date"
                  value={duPerso}
                  onChange={(e) => setDuPerso(e.target.value)}
                  className="rounded-sm border border-border bg-background px-2 py-1.5"
                />
              </label>
              <label className="flex items-center gap-1.5">
                au
                <input
                  type="date"
                  value={auPerso}
                  onChange={(e) => setAuPerso(e.target.value)}
                  className="rounded-sm border border-border bg-background px-2 py-1.5"
                />
              </label>
            </span>
          )}
        </div>

        {parClient.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            Aucune facture sur cette période. Les factures annulées ne sont jamais comptées.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground">
                  <th className="p-3">Client</th>
                  <th className="p-3 text-right">Factures</th>
                  <th className="p-3 text-right">Total HT</th>
                  <th className="p-3 text-right">Total TTC</th>
                  <th className="p-3 text-right">Dont payées</th>
                  <th className="p-3 text-right">Payé TTC</th>
                  <th className="p-3 text-right">Reste TTC</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {parClient.map((t) => (
                  <Fragment key={t.nom}>
                    <tr>
                      <td className="p-3 font-medium">
                        <button
                          type="button"
                          onClick={() => setClientOuvert((v) => (v === t.nom ? null : t.nom))}
                          aria-expanded={clientOuvert === t.nom}
                          className="flex min-w-0 items-center gap-1.5 text-left hover:underline"
                        >
                          {clientOuvert === t.nom ? (
                            <ChevronDown className="h-4 w-4 shrink-0 text-primary" />
                          ) : (
                            <ChevronRight className="h-4 w-4 shrink-0 text-primary" />
                          )}
                          <span className="min-w-0 break-words">{t.nom}</span>
                          <span className="shrink-0 whitespace-nowrap rounded-full border border-border px-1.5 py-0.5 text-xs font-normal text-muted-foreground">
                            {t.nb} facture{t.nb > 1 ? "s" : ""}
                          </span>
                        </button>
                      </td>
                      <td className="p-3 text-right">{t.nb}</td>
                      <td className="p-3 text-right font-mono font-semibold">{euro(t.ht)}</td>
                      <td className="p-3 text-right font-mono">{euro(t.ttc)}</td>
                      <td className="p-3 text-right">{t.nbPayees}</td>
                      <td className="p-3 text-right font-mono text-primary">{euro(t.ttcPaye)}</td>
                      <td className="p-3 text-right font-mono">{euro(t.ttc - t.ttcPaye)}</td>
                    </tr>
                    {clientOuvert === t.nom && (
                      <tr className="bg-muted/20">
                        <td colSpan={7} className="p-3">
                          <ul className="divide-y divide-border rounded-md border border-border bg-card">
                            {t.factures.map((f) => (
                              <li key={f.id}>
                                <Link
                                  to="/factures/$id"
                                  params={{ id: f.id }}
                                  className="grid gap-1 px-3 py-2 hover:bg-muted/40"
                                >
                                  <span className="flex items-baseline justify-between gap-3">
                                    <strong className="min-w-0 break-words font-mono text-xs">
                                      {f.numero}
                                    </strong>
                                    <span className="shrink-0 font-mono">{euro(Number(f.total_ttc))}</span>
                                  </span>
                                  <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                                    <span>{dateFr(f.date_emission)}</span>
                                    <span className="min-w-0 break-words">{f.objet || "objet non renseigné"}</span>
                                    <span>{STATUT_LABEL[f.statut] ?? f.statut}</span>
                                    <span className="font-mono">{euro(Number(f.total_ht))} HT</span>
                                  </span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-bold">
                  <td className="p-3">Total · {libellePeriode}</td>
                  <td className="p-3 text-right">{parClient.reduce((s, t) => s + t.nb, 0)}</td>
                  <td className="p-3 text-right font-mono">
                    {euro(parClient.reduce((s, t) => s + t.ht, 0))}
                  </td>
                  <td className="p-3 text-right font-mono">
                    {euro(parClient.reduce((s, t) => s + t.ttc, 0))}
                  </td>
                  <td className="p-3 text-right">
                    {parClient.reduce((s, t) => s + t.nbPayees, 0)}
                  </td>
                  <td className="p-3 text-right font-mono text-primary">
                    {euro(parClient.reduce((s, t) => s + t.ttcPaye, 0))}
                  </td>
                  <td className="p-3 text-right font-mono">
                    {euro(parClient.reduce((s, t) => s + t.ttc - t.ttcPaye, 0))}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <p className="border-t border-border p-3 text-xs text-muted-foreground">
          Les montants suivent la date d'émission de la facture. Touchez un nom de client pour lister
          ses factures de la période et les ouvrir. Les factures annulées ne sont jamais comptées.
        </p>
      </section>


      <div className="mt-8 flex flex-wrap gap-2" role="group" aria-label="Filtres de dépôt">
        {FILTRES.map((f) => (
          <button
            key={f.cle}
            type="button"
            aria-pressed={filtre === f.cle}
            onClick={() => setFiltre(f.cle)}
            className={`text-mono text-xs rounded-sm border px-3 py-2 ${
              filtre === f.cle
                ? "border-primary bg-primary/15 text-primary"
                : "border-border text-muted-foreground hover:border-primary hover:text-primary"
            }`}
          >
            {f.label}
            {f.cle !== "toutes" ? ` (${parEtape.get(f.cle) ?? 0})` : ` (${list.length})`}
          </button>
        ))}
      </div>

      <div className="mt-4 border border-border rounded-sm bg-card divide-y divide-border overflow-hidden">
        {factures.isLoading && (
          <div className="p-6">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          </div>
        )}
        {!factures.isLoading && rows.length === 0 && (
          <p className="p-6 text-sm text-muted-foreground">
            {list.length === 0
              ? "Aucune facture. Ouvrez un devis puis « Convertir en facture »."
              : "Aucune facture dans ce filtre."}
          </p>
        )}
        {rows.map((f) => (
          <div key={f.id} className="p-4 flex flex-wrap items-center gap-x-4 gap-y-2 hover:bg-muted/30 transition">
            <div className="min-w-0 flex-1">
              <Link to="/factures/$id" params={{ id: f.id }} className="block truncate text-lg font-extrabold hover:underline">
                {nomClientFacture(f)}
              </Link>
              <span className="block truncate text-xs text-muted-foreground">
                <span className="text-mono text-primary">{f.numero}</span>
                {nomClientFacture(f) !== f.client_nom ? ` · ${f.client_nom}` : ""} · {dateFr(f.date_emission)} → {dateFr(f.date_echeance)}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-right">
                <strong className="block text-xl font-extrabold text-dashboard-green">{euro(Number(f.total_ht))} <span className="text-xs font-normal text-muted-foreground">HT</span></strong>
                <span className="block text-[11px] text-muted-foreground">{euro(Number(f.total_ttc))} TTC</span>
              </span>
              <DepotChip
                f={{
                  id: f.id,
                  numero: f.numero,
                  statut: f.statut,
                  depose_at: f.depose_at,
                  depose_reference: f.depose_reference,
                }}
              />
              <span
                className={`text-mono text-[11px] px-2 py-1 rounded-sm border ${
                  f.statut === "payee"
                    ? "border-primary text-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                {STATUT_LABEL[f.statut] ?? f.statut}
              </span>
              {f.viewed_at && (
                <span className="text-[11px] font-semibold text-primary" title={`Vu ${f.view_count} fois`}>
                  Consultée le {dateFr(f.last_viewed_at ?? f.viewed_at)}
                  {f.view_count > 1 ? ` · ${f.view_count} vues` : ""}
                </span>
              )}
              <button
                type="button"
                onClick={async () => {
                  if (!confirm(`Supprimer la facture ${f.numero} ?`)) return;
                  await deleteFn({ data: { id: f.id } });
                  qc.invalidateQueries({ queryKey: ["factures"] });
                }}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Supprimer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}

      </div>
    </ProShell>
  );
}

/** Case « déposée sur la plateforme du client », cochable directement depuis la liste. */
function DepotChip({
  f,
}: {
  f: {
    id: string;
    numero: string;
    statut: string;
    depose_at: string | null;
    depose_reference: string | null;
  };
}) {
  const qc = useQueryClient();
  const marquer = useServerFn(updateFactureDepot);
  const [enCours, setEnCours] = useState(false);
  if (!peutDeposerFacture(f)) return null;
  const deposee = Boolean(f.depose_at);
  return (
    <button
      type="button"
      disabled={enCours}
      title={
        deposee
          ? `Déposée le ${new Date(f.depose_at as string).toLocaleDateString("fr-FR")}${
              f.depose_reference ? ` · référence ${f.depose_reference}` : ""
            } — cliquer pour décocher`
          : "Marquer comme déposée sur la plateforme du client"
      }
      onClick={async () => {
        setEnCours(true);
        try {
          await marquer({ data: { id: f.id, valeur: !deposee } });
          await qc.invalidateQueries({ queryKey: ["factures"] });
        } finally {
          setEnCours(false);
        }
      }}
      className={`text-mono text-[11px] rounded-sm border px-2 py-1 disabled:opacity-50 ${
        deposee
          ? "border-primary bg-primary/15 font-semibold text-primary"
          : "border-dashed border-border text-muted-foreground hover:bg-muted"
      }`}
    >
      {deposee ? "✓ " : "☐ "}
      {deposee ? `Déposée ${f.depose_reference ? `· ${f.depose_reference}` : ""}` : "Déposer"}
    </button>
  );
}

/** Nom du client final : pour une facture de donneur d'ordre, le nom après « — » dans l'objet. */
function nomClientFacture(f: { client_nom: string; objet?: string | null }): string {
  const fin = String(f.objet ?? "").split(" — ").slice(1).join(" — ").trim();
  return fin || f.client_nom;
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="border border-border rounded-sm bg-card p-5">
      <div className="text-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </div>
      <div className={`mt-2 text-2xl font-medium ${accent ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}
