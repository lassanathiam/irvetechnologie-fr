import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2, Trash2 } from "lucide-react";
import { ProShell } from "@/components/ProShell";
import { dateFr, euro } from "@/lib/company";
import { deleteFacture, listFactures } from "@/lib/factures.functions";

export const Route = createFileRoute("/_authenticated/factures/")({
  head: () => ({
    meta: [
      { title: "Factures — Espace pro Borne de l'Ouest" },
      { name: "description", content: "Suivi des factures, encaissements et envois clients." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FacturesPage,
});

const STATUT_LABEL: Record<string, string> = {
  brouillon: "Brouillon",
  envoyee: "Envoyée",
  payee: "Payée",
  annulee: "Annulée",
};

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
            Les factures sont créées depuis un devis accepté.
          </p>
        </div>
        <Link
          to="/devis"
          className="text-mono text-xs border border-border rounded-sm px-4 py-2.5 hover:border-primary hover:text-primary inline-flex items-center gap-2"
        >
          <FileText className="h-3.5 w-3.5" /> Devis
        </Link>
      </div>
      </div>

      <div className="mt-8 grid sm:grid-cols-3 gap-4">
        <Stat label="Factures" value={String(list.length)} />
        <Stat label="Total facturé TTC" value={euro(total)} />
        <Stat label="Reste à encaisser" value={euro(impaye)} accent />
      </div>

      <div className="mt-8 border border-border rounded-sm bg-card divide-y divide-border overflow-hidden">
        {factures.isLoading && (
          <div className="p-6">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          </div>
        )}
        {!factures.isLoading && list.length === 0 && (
          <p className="p-6 text-sm text-muted-foreground">
            Aucune facture. Ouvrez un devis puis « Convertir en facture ».
          </p>
        )}
        {list.map((f) => (
          <div key={f.id} className="p-4 flex items-center gap-4 flex-wrap hover:bg-muted/30 transition">
            <Link to="/factures/$id" params={{ id: f.id }} className="text-mono text-xs text-primary hover:underline">
              {f.numero}
            </Link>
            <span className="font-medium">{f.client_nom}</span>
            <span className="text-sm text-muted-foreground hidden sm:block">{f.objet}</span>
            <span className="text-mono text-xs text-muted-foreground">
              {dateFr(f.date_emission)} → {dateFr(f.date_echeance)}
            </span>
            <span className="ml-auto text-mono">{euro(Number(f.total_ttc))}</span>
            <span
              className={`text-mono text-[11px] px-2 py-1 rounded-sm border ${
                f.statut === "payee"
                  ? "border-primary text-primary"
                  : "border-border text-muted-foreground"
              }`}
            >
              {STATUT_LABEL[f.statut] ?? f.statut}
            </span>
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
        ))}
      </div>
    </ProShell>
  );
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
