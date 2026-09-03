import { COMPANY, dateFr, euro } from "@/lib/company";
import { acompteAmount, computeTotals, MENTIONS_DEVIS, MENTIONS_FACTURE } from "@/lib/billing";

export type DocLine = {
  libelle: string;
  description?: string | null;
  quantite: number | string;
  prix_unitaire: number | string;
  tva: number | string;
};

export type DocHeader = {
  numero: string;
  date_emission: string;
  date_limite: string;
  client_nom: string;
  client_email?: string | null;
  client_telephone?: string | null;
  client_adresse?: string | null;
  client_cp_ville?: string | null;
  objet?: string | null;
  remise_pct: number | string;
  acompte_pct?: number | string | null;
  conditions_paiement?: string | null;
  notes?: string | null;
};

/** Rendu papier A4 partagé pour les devis et les factures. */
export function DocumentPrint({
  type,
  doc,
  items,
}: {
  type: "devis" | "facture";
  doc: DocHeader;
  items: DocLine[];
}) {
  const lines = items.map((i) => ({
    ...i,
    quantite: Number(i.quantite),
    prix_unitaire: Number(i.prix_unitaire),
    tva: Number(i.tva),
  }));
  const totals = computeTotals(lines, Number(doc.remise_pct) || 0);
  const isFacture = type === "facture";
  const acompte = acompteAmount(totals.total_ttc, Number(doc.acompte_pct) || 0);

  return (
    <div className="print-doc bg-card border border-border rounded-sm p-8 sm:p-12 text-[13px] leading-relaxed">
      <div className="flex flex-wrap items-start justify-between gap-8">
        <div>
          <div className="text-2xl font-semibold tracking-tight">
            Borne<span className="text-muted-foreground"> de l&apos;Ouest</span>
          </div>
          <div className="mt-3 text-muted-foreground space-y-0.5">
            <div>
              {COMPANY.raisonSociale} · {COMPANY.forme}
            </div>
            <div>{COMPANY.adresse}</div>
            <div>{COMPANY.cpVille}</div>
            <div>{COMPANY.email}</div>
            <div>{COMPANY.telephone}</div>
            <div className="text-mono text-[11px] pt-1">
              SIRET {COMPANY.siret} · TVA {COMPANY.tva}
            </div>
          </div>
        </div>

        <div className="text-right">
          <div className="text-mono text-primary uppercase tracking-[0.2em] text-[11px]">
            {isFacture ? "Facture" : "Devis"}
          </div>
          <div className="text-3xl font-medium tracking-tight mt-1">{doc.numero}</div>
          <div className="mt-3 text-muted-foreground space-y-0.5 text-[12px]">
            <div>Émis le {dateFr(doc.date_emission)}</div>
            <div>
              {isFacture ? "Échéance" : "Valable jusqu'au"} {dateFr(doc.date_limite)}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-10 grid sm:grid-cols-2 gap-6">
        <div className="border border-border rounded-sm p-4">
          <div className="text-mono text-[11px] text-muted-foreground uppercase tracking-[0.15em]">
            Client
          </div>
          <div className="mt-2 font-medium">{doc.client_nom}</div>
          <div className="text-muted-foreground">
            {doc.client_adresse && <div>{doc.client_adresse}</div>}
            {doc.client_cp_ville && <div>{doc.client_cp_ville}</div>}
            {doc.client_email && <div>{doc.client_email}</div>}
            {doc.client_telephone && <div>{doc.client_telephone}</div>}
          </div>
        </div>
        <div className="border border-border rounded-sm p-4">
          <div className="text-mono text-[11px] text-muted-foreground uppercase tracking-[0.15em]">
            Objet
          </div>
          <div className="mt-2">{doc.objet || "Installation de borne de recharge"}</div>
        </div>
      </div>

      <table className="mt-10 w-full border-collapse">
        <thead>
          <tr className="border-b border-border text-mono text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
            <th className="text-left py-2">Prestation</th>
            <th className="text-right py-2 w-16">Qté</th>
            <th className="text-right py-2 w-24">PU HT</th>
            <th className="text-right py-2 w-16">TVA</th>
            <th className="text-right py-2 w-28">Total HT</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr key={i} className="border-b border-border/60 align-top">
              <td className="py-3 pr-4">
                <div className="font-medium">{line.libelle}</div>
                {line.description && (
                  <div className="text-muted-foreground text-[12px] mt-1">{line.description}</div>
                )}
              </td>
              <td className="py-3 text-right text-mono">{line.quantite}</td>
              <td className="py-3 text-right text-mono">{euro(line.prix_unitaire)}</td>
              <td className="py-3 text-right text-mono">{line.tva} %</td>
              <td className="py-3 text-right text-mono">
                {euro(line.quantite * line.prix_unitaire)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-8 flex flex-wrap gap-8 justify-between">
        <div className="max-w-sm space-y-4">
          {doc.conditions_paiement && (
            <div>
              <div className="text-mono text-[11px] text-muted-foreground uppercase tracking-[0.15em]">
                Conditions de paiement
              </div>
              <p className="mt-1 text-[12px] text-muted-foreground">{doc.conditions_paiement}</p>
            </div>
          )}
          {doc.notes && (
            <div>
              <div className="text-mono text-[11px] text-muted-foreground uppercase tracking-[0.15em]">
                Notes
              </div>
              <p className="mt-1 text-[12px] text-muted-foreground whitespace-pre-line">{doc.notes}</p>
            </div>
          )}
          <ul className="text-[11px] text-muted-foreground space-y-1 list-disc pl-4">
            {(isFacture ? MENTIONS_FACTURE : MENTIONS_DEVIS).map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>

        <div className="ml-auto w-full sm:w-72 space-y-2">
          <TotalRow label="Total HT" value={euro(totals.total_ht_brut)} />
          {totals.total_remise > 0 && (
            <TotalRow
              label={`Remise ${Number(doc.remise_pct)} %`}
              value={`- ${euro(totals.total_remise)}`}
            />
          )}
          <TotalRow label="Total HT net" value={euro(totals.total_ht)} />
          {totals.tva_par_taux.map((t) => (
            <TotalRow key={t.taux} label={`TVA ${t.taux} %`} value={euro(t.montant)} />
          ))}
          <div className="pt-3 border-t border-border flex items-baseline justify-between">
            <span className="font-medium">Total TTC</span>
            <span className="text-2xl font-medium text-primary">{euro(totals.total_ttc)}</span>
          </div>
          {!isFacture && acompte > 0 && (
            <div className="pt-2 text-[12px] text-muted-foreground flex justify-between">
              <span>Acompte {Number(doc.acompte_pct)} %</span>
              <span className="text-mono">{euro(acompte)}</span>
            </div>
          )}
        </div>
      </div>

      {!isFacture && (
        <div className="mt-12 grid sm:grid-cols-2 gap-8">
          <div className="border border-dashed border-border rounded-sm p-4 h-28">
            <div className="text-mono text-[11px] text-muted-foreground">
              Bon pour accord — date et signature du client
            </div>
          </div>
          <div className="border border-dashed border-border rounded-sm p-4 h-28">
            <div className="text-mono text-[11px] text-muted-foreground">
              {COMPANY.raisonSociale} — signature
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TotalRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between text-[12px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-mono">{value}</span>
    </div>
  );
}
