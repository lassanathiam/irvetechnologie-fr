import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Loader2,
  Minus,
  Plus,
  Receipt,
  Search,
  Trash2,
} from "lucide-react";
import { ProShell } from "@/components/ProShell";
import { dateFr, euro } from "@/lib/company";
import { acompteAmount, computeTotals, CONDITIONS_DEFAUT } from "@/lib/billing";
import { createDevis, deleteDevis, listDevis, listPrestations } from "@/lib/devis.functions";

export const Route = createFileRoute("/_authenticated/devis/")({
  head: () => ({
    meta: [
      { title: "Devis — Espace pro Borne de l'Ouest" },
      { name: "description", content: "Créer, éditer et envoyer les devis Borne de l'Ouest." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DevisPage,
});

type LineState = {
  key: string;
  libelle: string;
  description: string | null;
  quantite: number;
  prix_unitaire: number;
  tva: number;
};

const today = () => new Date().toISOString().slice(0, 10);
const plusDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);

const STATUT_LABEL: Record<string, string> = {
  brouillon: "Brouillon",
  envoye: "Envoyé",
  accepte: "Accepté",
  refuse: "Refusé",
  expire: "Expiré",
};

function DevisPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetchPrestations = useServerFn(listPrestations);
  const fetchDevis = useServerFn(listDevis);
  const createFn = useServerFn(createDevis);
  const deleteFn = useServerFn(deleteDevis);

  const prestations = useQuery({ queryKey: ["prestations"], queryFn: () => fetchPrestations() });
  const devis = useQuery({ queryKey: ["devis"], queryFn: () => fetchDevis() });

  const [lines, setLines] = useState<LineState[]>([]);
  const [remise, setRemise] = useState(0);
  const [acompte, setAcompte] = useState(30);
  const [dates, setDates] = useState({ emission: today(), expiration: plusDays(30) });
  const [conditions, setConditions] = useState(CONDITIONS_DEFAUT);
  const [search, setSearch] = useState("");
  const [client, setClient] = useState({
    client_nom: "",
    client_email: "",
    client_telephone: "",
    client_adresse: "",
    client_cp_ville: "",
    objet: "Installation de borne de recharge",
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(() => computeTotals(lines, remise), [lines, remise]);
  const acompteTtc = acompteAmount(totals.total_ttc, acompte);

  const create = useMutation({
    mutationFn: async () =>
      createFn({
        data: {
          ...client,
          client_email: client.client_email || null,
          client_telephone: client.client_telephone || null,
          client_adresse: client.client_adresse || null,
          client_cp_ville: client.client_cp_ville || null,
          objet: client.objet || null,
          notes: client.notes || null,
          date_emission: dates.emission,
          date_expiration: dates.expiration,
          remise_pct: remise,
          acompte_pct: acompte,
          conditions_paiement: conditions || null,
          items: lines.map(({ libelle, description, quantite, prix_unitaire, tva }) => ({
            libelle,
            description,
            quantite,
            prix_unitaire,
            tva,
          })),
        },
      }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["devis"] });
      navigate({ to: "/devis/$id", params: { id: res.id } });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Création impossible."),
  });

  function addPrestation(p: {
    libelle: string;
    description: string | null;
    prix_unitaire: number | string;
    tva: number | string;
  }) {
    setLines((l) => [
      ...l,
      {
        key: crypto.randomUUID(),
        libelle: p.libelle,
        description: p.description,
        quantite: 1,
        prix_unitaire: Number(p.prix_unitaire),
        tva: Number(p.tva),
      },
    ]);
  }

  function updateLine(key: string, patch: Partial<LineState>) {
    setLines((l) => l.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  const catalogue = (prestations.data ?? []).filter((p) =>
    p.libelle.toLowerCase().includes(search.toLowerCase()),
  );

  const list = devis.data ?? [];

  return (
    <ProShell>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-mono text-[11px] uppercase tracking-[0.2em] text-primary">
            Facturation
          </div>
          <h1 className="mt-2 text-3xl font-medium tracking-tight">Nouveau devis</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Catalogue, quantités, remise, dates et acompte — totaux recalculés en direct.
          </p>
        </div>
        <Link
          to="/factures"
          className="text-mono text-xs border border-border rounded-sm px-4 py-2.5 hover:border-primary hover:text-primary inline-flex items-center gap-2"
        >
          <Receipt className="h-3.5 w-3.5" /> Factures
        </Link>
      </div>

      <div className="mt-8 grid lg:grid-cols-[1fr_340px] gap-6 items-start">
        <div className="space-y-5">
          <Card step="01" title="Client">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Nom / société *" value={client.client_nom} onChange={(v) => setClient({ ...client, client_nom: v })} />
              <Field label="Objet" value={client.objet} onChange={(v) => setClient({ ...client, objet: v })} />
              <Field label="Email" type="email" value={client.client_email} onChange={(v) => setClient({ ...client, client_email: v })} />
              <Field label="Téléphone" value={client.client_telephone} onChange={(v) => setClient({ ...client, client_telephone: v })} />
              <Field label="Adresse" value={client.client_adresse} onChange={(v) => setClient({ ...client, client_adresse: v })} />
              <Field label="Code postal / ville" value={client.client_cp_ville} onChange={(v) => setClient({ ...client, client_cp_ville: v })} />
            </div>
          </Card>

          <Card step="02" title="Dates & validité">
            <div className="grid sm:grid-cols-2 gap-4">
              <Field
                label="Date du devis"
                type="date"
                value={dates.emission}
                onChange={(v) => setDates({ ...dates, emission: v })}
              />
              <Field
                label="Valable jusqu'au"
                type="date"
                value={dates.expiration}
                onChange={(v) => setDates({ ...dates, expiration: v })}
              />
            </div>
          </Card>

          <Card step="03" title="Prestations">
            <label className="relative block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Rechercher dans le catalogue…"
                className="w-full bg-input border border-border rounded-sm pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-primary"
              />
            </label>

            <div className="flex flex-wrap gap-2">
              {catalogue.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => addPrestation(p)}
                  className="text-left border border-border rounded-sm px-3 py-2 hover:border-primary hover:text-primary transition text-sm inline-flex items-center gap-2"
                >
                  <Plus className="h-3.5 w-3.5" /> {p.libelle}
                  <span className="text-mono text-xs text-muted-foreground">
                    {euro(Number(p.prix_unitaire))}
                  </span>
                </button>
              ))}
              {prestations.isLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              <button
                type="button"
                onClick={() =>
                  addPrestation({ libelle: "Ligne libre", description: null, prix_unitaire: 0, tva: 20 })
                }
                className="border border-dashed border-border rounded-sm px-3 py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary inline-flex items-center gap-2"
              >
                <Plus className="h-3.5 w-3.5" /> Ligne libre
              </button>
            </div>

            {lines.length === 0 ? (
              <p className="text-sm text-muted-foreground">Aucune ligne. Ajoutez une prestation.</p>
            ) : (
              <div className="space-y-3">
                {lines.map((line) => (
                  <div key={line.key} className="border border-border rounded-sm p-4 space-y-3 bg-muted/20">
                    <div className="flex items-start justify-between gap-3">
                      <input
                        value={line.libelle}
                        onChange={(e) => updateLine(line.key, { libelle: e.target.value })}
                        className="font-medium bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => setLines((l) => l.filter((x) => x.key !== line.key))}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label="Retirer la ligne"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {line.description && (
                      <p className="text-xs text-muted-foreground leading-relaxed">{line.description}</p>
                    )}
                    <div className="flex flex-wrap items-end gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-mono text-xs text-muted-foreground">Qté</span>
                        <button
                          type="button"
                          className="border border-border rounded-sm p-1.5 hover:border-primary"
                          onClick={() => updateLine(line.key, { quantite: Math.max(1, line.quantite - 1) })}
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <input
                          type="number"
                          min={1}
                          value={line.quantite}
                          onChange={(e) => updateLine(line.key, { quantite: Number(e.target.value) || 1 })}
                          className="w-16 bg-input border border-border rounded-sm px-2 py-1.5 text-center"
                        />
                        <button
                          type="button"
                          className="border border-border rounded-sm p-1.5 hover:border-primary"
                          onClick={() => updateLine(line.key, { quantite: line.quantite + 1 })}
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                      <label className="flex items-center gap-2">
                        <span className="text-mono text-xs text-muted-foreground">PU HT</span>
                        <input
                          type="number"
                          step="0.01"
                          value={line.prix_unitaire}
                          onChange={(e) => updateLine(line.key, { prix_unitaire: Number(e.target.value) || 0 })}
                          className="w-24 bg-input border border-border rounded-sm px-2 py-1.5"
                        />
                      </label>
                      <label className="flex items-center gap-2">
                        <span className="text-mono text-xs text-muted-foreground">TVA %</span>
                        <input
                          type="number"
                          step="0.5"
                          value={line.tva}
                          onChange={(e) => updateLine(line.key, { tva: Number(e.target.value) || 0 })}
                          className="w-20 bg-input border border-border rounded-sm px-2 py-1.5"
                        />
                      </label>
                      <div className="ml-auto text-mono">{euro(line.quantite * line.prix_unitaire)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card step="04" title="Remise, acompte & conditions">
            <div className="grid sm:grid-cols-2 gap-4">
              <label className="block">
                <span className="text-mono text-xs text-muted-foreground">Remise globale (%)</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.5"
                  value={remise}
                  onChange={(e) => setRemise(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                  className="mt-2 w-full bg-input border border-border rounded-sm px-4 py-2.5"
                />
              </label>
              <label className="block">
                <span className="text-mono text-xs text-muted-foreground">Acompte à la commande (%)</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="5"
                  value={acompte}
                  onChange={(e) => setAcompte(Math.min(100, Math.max(0, Number(e.target.value) || 0)))}
                  className="mt-2 w-full bg-input border border-border rounded-sm px-4 py-2.5"
                />
              </label>
            </div>
            <label className="block">
              <span className="text-mono text-xs text-muted-foreground">Conditions de paiement</span>
              <textarea
                rows={3}
                value={conditions}
                onChange={(e) => setConditions(e.target.value)}
                className="mt-2 w-full bg-input border border-border rounded-sm px-4 py-3 resize-none text-sm"
              />
            </label>
            <label className="block">
              <span className="text-mono text-xs text-muted-foreground">Notes affichées sur le devis</span>
              <textarea
                rows={3}
                value={client.notes}
                onChange={(e) => setClient({ ...client, notes: e.target.value })}
                className="mt-2 w-full bg-input border border-border rounded-sm px-4 py-3 resize-none text-sm"
              />
            </label>
          </Card>
        </div>

        <aside className="lg:sticky lg:top-24 border border-border rounded-sm bg-card p-6 space-y-3">
          <h2 className="text-mono text-[11px] uppercase tracking-[0.2em] text-primary">
            Récapitulatif
          </h2>
          <Row label="Total HT" value={euro(totals.total_ht_brut)} />
          {remise > 0 && (
            <Row label={`Remise ${remise} %`} value={`- ${euro(totals.total_remise)}`} accent />
          )}
          <Row label="Total HT net" value={euro(totals.total_ht)} />
          {totals.tva_par_taux.map((t) => (
            <Row key={t.taux} label={`TVA ${t.taux} %`} value={euro(t.montant)} />
          ))}
          <div className="pt-3 border-t border-border flex items-baseline justify-between">
            <span className="font-medium">Total TTC</span>
            <span className="text-2xl font-medium text-primary">{euro(totals.total_ttc)}</span>
          </div>
          {acompte > 0 && (
            <Row label={`Acompte ${acompte} %`} value={euro(acompteTtc)} />
          )}
          {error && <p className="text-mono text-xs text-destructive">{error}</p>}
          <button
            type="button"
            disabled={!client.client_nom || lines.length === 0 || create.isPending}
            onClick={() => {
              setError(null);
              create.mutate();
            }}
            className="w-full hero-grad text-primary-foreground text-mono text-xs px-5 py-3.5 rounded-sm inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
            Créer le devis
          </button>
        </aside>
      </div>

      <section className="mt-16">
        <h2 className="text-2xl font-medium tracking-tight">Devis</h2>
        <div className="mt-5 border border-border rounded-sm bg-card divide-y divide-border overflow-hidden">
          {list.length === 0 && (
            <p className="p-6 text-sm text-muted-foreground">Aucun devis pour le moment.</p>
          )}
          {list.map((d) => (
            <div key={d.id} className="p-4 flex items-center gap-4 flex-wrap hover:bg-muted/30 transition">
              <Link to="/devis/$id" params={{ id: d.id }} className="text-mono text-xs text-primary hover:underline">
                {d.numero}
              </Link>
              <span className="font-medium">{d.client_nom}</span>
              <span className="text-sm text-muted-foreground hidden sm:block">{d.objet}</span>
              <span className="text-mono text-xs text-muted-foreground">{dateFr(d.date_emission)}</span>
              <span className="ml-auto text-mono">{euro(Number(d.total_ttc))}</span>
              <span className="text-mono text-[11px] px-2 py-1 rounded-sm border border-border text-muted-foreground">
                {STATUT_LABEL[d.statut] ?? d.statut}
              </span>
              {d.facture_id && (
                <Link
                  to="/factures/$id"
                  params={{ id: d.facture_id }}
                  className="text-mono text-[11px] text-primary inline-flex items-center gap-1"
                >
                  <CheckCircle2 className="h-3.5 w-3.5" /> Facturé
                </Link>
              )}
              <button
                type="button"
                onClick={async () => {
                  if (!confirm(`Supprimer le devis ${d.numero} ?`)) return;
                  await deleteFn({ data: { id: d.id } });
                  qc.invalidateQueries({ queryKey: ["devis"] });
                }}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Supprimer"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </section>
    </ProShell>
  );
}

function Card({ step, title, children }: { step: string; title: string; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-sm bg-card p-6 space-y-4">
      <h2 className="text-mono text-[11px] uppercase tracking-[0.2em] text-primary flex items-center gap-2">
        <FileText className="h-3.5 w-3.5" /> {step} · {title}
      </h2>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="text-mono text-xs text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full bg-input border border-border rounded-sm px-4 py-2.5 focus:outline-none focus:border-primary"
      />
    </label>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-baseline justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={accent ? "text-mono text-primary" : "text-mono"}>{value}</span>
    </div>
  );
}
