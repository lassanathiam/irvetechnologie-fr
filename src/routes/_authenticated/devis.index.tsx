import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ArrowRight, FileText, Loader2, LogOut, Minus, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { COMPANY, dateFr, euro } from "@/lib/company";
import { computeTotals, createDevis, deleteDevis, listDevis, listPrestations } from "@/lib/devis.functions";

export const Route = createFileRoute("/_authenticated/devis/")({
  head: () => ({
    meta: [
      { title: "Devis — Espace pro IRVE Technologie" },
      { name: "description", content: "Créer, consulter et envoyer les devis IRVE Technologie." },
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

  const create = useMutation({
    mutationFn: async () => {
      return createFn({
        data: {
          ...client,
          client_email: client.client_email || null,
          client_telephone: client.client_telephone || null,
          client_adresse: client.client_adresse || null,
          client_cp_ville: client.client_cp_ville || null,
          objet: client.objet || null,
          notes: client.notes || null,
          remise_pct: remise,
          items: lines.map(({ libelle, description, quantite, prix_unitaire, tva }) => ({
            libelle,
            description,
            quantite,
            prix_unitaire,
            tva,
          })),
        },
      });
    },
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["devis"] });
      navigate({ to: "/devis/$id", params: { id: res.id } });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Création impossible."),
  });

  function addPrestation(p: { libelle: string; description: string | null; prix_unitaire: number; tva: number }) {
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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="hero-grad text-primary-foreground p-1.5 rounded-sm">
              <FileText className="h-4 w-4" />
            </span>
            <div>
              <div className="font-semibold tracking-tight leading-none">Espace devis</div>
              <div className="text-xs text-muted-foreground">{COMPANY.raisonSociale}</div>
            </div>
          </div>
          <button
            type="button"
            onClick={async () => {
              await supabase.auth.signOut();
              qc.clear();
              navigate({ to: "/auth" });
            }}
            className="text-mono text-muted-foreground hover:text-primary inline-flex items-center gap-2"
          >
            <LogOut className="h-4 w-4" /> Déconnexion
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-12 space-y-16">
        <section className="grid lg:grid-cols-[1fr_360px] gap-8 items-start">
          <div className="space-y-8">
            <div>
              <h1 className="text-3xl font-medium tracking-tight">Nouveau devis</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Choisissez les prestations du catalogue, ajustez les quantités et la remise.
              </p>
            </div>

            <div className="border border-border rounded-sm bg-card p-6 space-y-4">
              <h2 className="text-mono text-primary">01 · Client</h2>
              <div className="grid sm:grid-cols-2 gap-4">
                <Input label="Nom / société *" value={client.client_nom} onChange={(v) => setClient({ ...client, client_nom: v })} />
                <Input label="Objet" value={client.objet} onChange={(v) => setClient({ ...client, objet: v })} />
                <Input label="Email" type="email" value={client.client_email} onChange={(v) => setClient({ ...client, client_email: v })} />
                <Input label="Téléphone" value={client.client_telephone} onChange={(v) => setClient({ ...client, client_telephone: v })} />
                <Input label="Adresse" value={client.client_adresse} onChange={(v) => setClient({ ...client, client_adresse: v })} />
                <Input label="Code postal / ville" value={client.client_cp_ville} onChange={(v) => setClient({ ...client, client_cp_ville: v })} />
              </div>
            </div>

            <div className="border border-border rounded-sm bg-card p-6 space-y-5">
              <h2 className="text-mono text-primary">02 · Prestations</h2>
              <div className="flex flex-wrap gap-2">
                {(prestations.data ?? []).map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addPrestation(p)}
                    className="text-left border border-border rounded-sm px-3 py-2 hover:border-primary hover:text-primary transition text-sm inline-flex items-center gap-2"
                  >
                    <Plus className="h-3.5 w-3.5" /> {p.libelle}
                    <span className="text-mono text-muted-foreground">{euro(Number(p.prix_unitaire))}</span>
                  </button>
                ))}
                {prestations.isLoading && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              </div>

              {lines.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucune ligne. Ajoutez une prestation ci-dessus.</p>
              ) : (
                <div className="space-y-3">
                  {lines.map((line) => (
                    <div key={line.key} className="border border-border rounded-sm p-4 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium">{line.libelle}</div>
                          {line.description && (
                            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{line.description}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setLines((l) => l.filter((x) => x.key !== line.key))}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label="Retirer la ligne"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="flex flex-wrap items-end gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-mono text-muted-foreground">Qté</span>
                          <button type="button" className="border border-border rounded-sm p-1.5 hover:border-primary" onClick={() => updateLine(line.key, { quantite: Math.max(1, line.quantite - 1) })}>
                            <Minus className="h-3 w-3" />
                          </button>
                          <input
                            type="number"
                            min={1}
                            value={line.quantite}
                            onChange={(e) => updateLine(line.key, { quantite: Number(e.target.value) || 1 })}
                            className="w-16 bg-input border border-border rounded-sm px-2 py-1.5 text-center"
                          />
                          <button type="button" className="border border-border rounded-sm p-1.5 hover:border-primary" onClick={() => updateLine(line.key, { quantite: line.quantite + 1 })}>
                            <Plus className="h-3 w-3" />
                          </button>
                        </div>
                        <label className="flex items-center gap-2">
                          <span className="text-mono text-muted-foreground">PU HT</span>
                          <input
                            type="number"
                            step="0.01"
                            value={line.prix_unitaire}
                            onChange={(e) => updateLine(line.key, { prix_unitaire: Number(e.target.value) || 0 })}
                            className="w-24 bg-input border border-border rounded-sm px-2 py-1.5"
                          />
                        </label>
                        <label className="flex items-center gap-2">
                          <span className="text-mono text-muted-foreground">TVA %</span>
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
            </div>

            <div className="border border-border rounded-sm bg-card p-6 space-y-4">
              <h2 className="text-mono text-primary">03 · Remise & notes</h2>
              <label className="flex items-center gap-3">
                <span className="text-mono text-muted-foreground">Remise sur le total (%)</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.5"
                  value={remise}
                  onChange={(e) => setRemise(Number(e.target.value) || 0)}
                  className="w-24 bg-input border border-border rounded-sm px-3 py-2"
                />
              </label>
              <label className="block">
                <span className="text-mono text-muted-foreground">Notes affichées sur le devis</span>
                <textarea
                  rows={3}
                  value={client.notes}
                  onChange={(e) => setClient({ ...client, notes: e.target.value })}
                  className="mt-2 w-full bg-input border border-border rounded-sm px-4 py-3 resize-none"
                />
              </label>
            </div>
          </div>

          <aside className="lg:sticky lg:top-8 border border-border rounded-sm bg-card p-6 space-y-4">
            <h2 className="text-mono text-primary">Récapitulatif</h2>
            <Row label="Total HT" value={euro(totals.total_ht)} />
            {remise > 0 && <Row label={`Remise (${remise} %)`} value={`-${euro(totals.remise)}`} />}
            <Row label="Total HT net" value={euro(totals.total_ht_net)} />
            <Row label="TVA" value={euro(totals.total_tva)} />
            <div className="pt-4 border-t border-border flex items-baseline justify-between">
              <span className="font-medium">Total TTC</span>
              <span className="text-2xl font-medium">{euro(totals.total_ttc)}</span>
            </div>
            {error && <p className="text-mono text-destructive">{error}</p>}
            <button
              type="button"
              disabled={!client.client_nom || lines.length === 0 || create.isPending}
              onClick={() => {
                setError(null);
                create.mutate();
              }}
              className="w-full hero-grad text-primary-foreground text-mono px-5 py-3.5 rounded-sm inline-flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              Créer le devis
            </button>
          </aside>
        </section>

        <section>
          <h2 className="text-2xl font-medium tracking-tight">Devis récents</h2>
          <div className="mt-6 border border-border rounded-sm bg-card divide-y divide-border">
            {(devis.data ?? []).length === 0 && (
              <p className="p-6 text-sm text-muted-foreground">Aucun devis pour le moment.</p>
            )}
            {(devis.data ?? []).map((d) => (
              <div key={d.id} className="p-4 flex items-center gap-4 flex-wrap">
                <Link to="/devis/$id" params={{ id: d.id }} className="text-mono text-primary hover:underline">
                  {d.numero}
                </Link>
                <span className="font-medium">{d.client_nom}</span>
                <span className="text-sm text-muted-foreground">{d.objet}</span>
                <span className="text-mono text-muted-foreground">{dateFr(d.date_emission)}</span>
                <span className="ml-auto text-mono">{euro(Number(d.total_ttc))}</span>
                <span className="text-mono text-muted-foreground">{d.sent_at ? "Envoyé" : d.statut}</span>
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
      </main>
    </div>
  );
}

function Input({
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
      <span className="text-mono text-muted-foreground">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 w-full bg-input border border-border rounded-sm px-4 py-3 focus:outline-none focus:border-primary"
      />
    </label>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-mono">{value}</span>
    </div>
  );
}
