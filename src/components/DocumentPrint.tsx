import { COMPANY, dateFr, euro } from "@/lib/company";
import { acompteAmount, computeTotals, MENTIONS_DEVIS, MENTIONS_FACTURE } from "@/lib/billing";
import { BrandLogo } from "@/components/BrandLogo";
import { CompanySeal } from "@/components/CompanySeal";

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

export type DocSignature = {
  signature_client?: string | null;
  signataire_nom?: string | null;
  signed_at?: string | null;
};

/** Rendu papier A4 partagé pour les devis et les factures. */
export function DocumentPrint({
  type,
  doc,
  items,
  signature,
}: {
  type: "devis" | "facture";
  doc: DocHeader;
  items: DocLine[];
  signature?: DocSignature | null;
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
    <div className="print-doc bg-card border border-border rounded-sm p-6 sm:p-8 text-[13px] leading-relaxed">
      {/* En-tête : émetteur à gauche, client en face à droite */}
      <div className="flex flex-wrap items-start justify-between gap-6 pb-4 border-b-2 border-primary/70">
        <div className="flex items-start gap-4">
          <BrandLogo className="h-16 w-16" />
          <div>
            <div className="text-xl font-extrabold tracking-tight uppercase">
              {COMPANY.raisonSociale}
            </div>
            <div className="text-mono text-[11px] font-bold text-primary uppercase tracking-[0.18em]">
              Borne de l&apos;Ouest
            </div>
            <div className="mt-1.5 inline-block border border-primary/60 rounded-sm px-2 py-1 text-mono text-[10px] font-bold text-primary">
              {COMPANY.qualifications}
            </div>
            <div className="mt-2 text-[12px] text-muted-foreground space-y-0.5">
              <div>{COMPANY.adresse}</div>
              <div>{COMPANY.cpVille}</div>
              <div className="font-semibold text-foreground">{COMPANY.email}</div>
              <div>{COMPANY.telephone} · {COMPANY.telephone2}</div>
              <div className="text-mono text-[10px] pt-1">
                SIRET {COMPANY.siret} · TVA {COMPANY.tva} · {COMPANY.site}
              </div>
            </div>
          </div>
        </div>

        {/* Client en face, à droite */}
        <div className="bg-muted/40 border border-border rounded-sm p-4 min-w-[240px]">
          <div className="text-mono text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">
            {isFacture ? "Facturé à" : "Client"}
          </div>
          <div className="mt-2 text-base font-extrabold tracking-tight">{doc.client_nom}</div>
          <div className="text-[12px] text-muted-foreground mt-1 space-y-0.5">
            {doc.client_adresse && <div>{doc.client_adresse}</div>}
            {doc.client_cp_ville && <div>{doc.client_cp_ville}</div>}
            {doc.client_email && <div>{doc.client_email}</div>}
            {doc.client_telephone && <div>{doc.client_telephone}</div>}
          </div>
        </div>
      </div>

      {/* Infos du document, juste sous l'en-tête */}
      <div className="mt-3 flex flex-wrap items-baseline gap-x-6 gap-y-1 text-[12px]">
        <div>
          <span className="text-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {isFacture ? "Facture n° " : "Devis n° "}
          </span>
          <span className="text-base font-extrabold tracking-tight">{doc.numero}</span>
        </div>
        <div>
          <span className="text-muted-foreground">Date : </span>
          <span className="font-bold">{dateFr(doc.date_emission)}</span>
        </div>
        <div>
          <span className="text-muted-foreground">
            {isFacture ? "Échéance : " : "Valable jusqu'au : "}
          </span>
          <span className="font-bold">{dateFr(doc.date_limite)}</span>
        </div>
      </div>

      {/* Objet en gras, juste au-dessus des prestations */}
      <div className="mt-4 text-[13px] font-extrabold tracking-tight">
        Objet : {doc.objet || "Installation de borne de recharge"}
      </div>

      {/* Lignes */}
      <table className="mt-5 w-full border-collapse">
        <thead>
          <tr className="bg-muted text-mono text-[10px] font-bold uppercase tracking-[0.14em]">
            <th className="text-left py-2.5 px-3 w-8">#</th>
            <th className="text-left py-2.5 px-3">Prestation</th>
            <th className="text-right py-2.5 px-3 w-16">Qté</th>
            <th className="text-right py-2.5 px-3 w-28">Prix unitaire HT</th>
            <th className="text-right py-2.5 px-3 w-20">Taux TVA</th>
            <th className="text-right py-2.5 px-3 w-28">Total HT</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line, i) => (
            <tr key={i} className="border-b border-border align-top">
              <td className="py-3 px-3 text-mono text-[11px] text-muted-foreground">{i + 1}</td>
              <td className="py-3 px-3">
                <div className="font-bold">{line.libelle}</div>
                {line.description && (
                  <div className="text-muted-foreground text-[12px] mt-0.5 whitespace-pre-line">{line.description}</div>
                )}
              </td>
              <td className="py-3 px-3 text-right text-mono font-semibold">{line.quantite}</td>
              <td className="py-3 px-3 text-right text-mono">{euro(line.prix_unitaire)}</td>
              <td className="py-3 px-3 text-right text-mono">{line.tva} %</td>
              <td className="py-3 px-3 text-right text-mono font-bold">
                {euro(line.quantite * line.prix_unitaire)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Totaux */}
      <div className="mt-4 flex justify-end">
        <div className="w-full sm:w-80 space-y-1.5">
          <TotalRow label="Total HT" value={euro(totals.total_ht_brut)} />
          {totals.total_remise > 0 && (
            <TotalRow
              label={`Remise ${Number(doc.remise_pct)} %`}
              value={`- ${euro(totals.total_remise)}`}
            />
          )}
          {totals.total_remise > 0 && (
            <TotalRow label="Total HT net" value={euro(totals.total_ht)} strong />
          )}
          {totals.tva_par_taux.map((t) => (
            <TotalRow key={t.taux} label={`TVA (${t.taux} %)`} value={euro(t.montant)} />
          ))}
          <div className="mt-2 bg-muted border border-border rounded-sm px-3 py-2.5 flex items-baseline justify-between">
            <span className="font-extrabold uppercase text-mono text-[11px] tracking-[0.14em]">
              Total TTC
            </span>
            <span className="text-xl font-extrabold text-primary">{euro(totals.total_ttc)}</span>
          </div>
          {!isFacture && acompte > 0 && (
            <div className="pt-1 text-[12px] flex justify-between">
              <span className="text-muted-foreground">Acompte {Number(doc.acompte_pct)} %</span>
              <span className="text-mono font-bold">{euro(acompte)}</span>
            </div>
          )}
        </div>
      </div>

      {/* CGV / conditions */}
      <div className="mt-5">
        <div className="space-y-2">
          <div className="text-mono text-[10px] font-bold uppercase tracking-[0.2em]">
            Conditions générales de vente (CGV)
          </div>
          {doc.conditions_paiement && (
            <p className="text-[12px]">
              <span className="font-bold">Modalités de paiement : </span>
              {doc.conditions_paiement}
            </p>
          )}
          {doc.notes && (
            <p className="text-[12px] whitespace-pre-line">
              <span className="font-bold">Notes : </span>
              {doc.notes}
            </p>
          )}
          <ul className="text-[11px] text-muted-foreground grid sm:grid-cols-2 gap-x-6 gap-y-0.5">
            {(isFacture ? MENTIONS_FACTURE : MENTIONS_DEVIS).map((m) => (
              <li key={m}>
                <span className="text-primary font-bold">·</span> {m}
              </li>
            ))}
          </ul>
        </div>

        {/* Signatures côte à côte (horizontal) */}
        {!isFacture && (
          <div className="mt-5 grid grid-cols-2 gap-4">
            <div className="border-2 border-primary/70 rounded-sm p-3">
              <div className="text-mono text-[10px] font-extrabold uppercase tracking-[0.14em] text-primary">
                {signature?.signature_client ? "Devis signé — bon pour accord" : "Client — bon pour accord"}
              </div>
              {signature?.signature_client ? (
                <div className="mt-1">
                  <img
                    src={signature.signature_client}
                    alt="Signature du client"
                    className="h-12 w-full object-contain object-left"
                  />
                  <div className="text-[10px] text-muted-foreground">
                    {signature.signataire_nom}
                    {signature.signed_at
                      ? ` — signé le ${new Date(signature.signed_at).toLocaleString("fr-FR")}`
                      : null}
                  </div>
                </div>
              ) : (
                <div className="mt-1 h-12 text-[10px] text-muted-foreground">
                  Date &amp; signature
                </div>
              )}
            </div>
            <div className="border border-border rounded-sm p-3">
              <div className="text-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {COMPANY.raisonSociale}
              </div>
              <div className="mt-1">
                <CompanySeal className="max-w-[170px]" />
              </div>
              <div className="mt-2 text-[10px] text-muted-foreground">Cachet et signature</div>
            </div>
          </div>
        )}
      </div>


      {/* Encart de partage */}
      <div className="mt-5 border border-primary/40 rounded-sm p-4 bg-muted/30 text-[11px] leading-relaxed">
        <div className="text-mono text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
          Recommandez Borne de l'Ouest
        </div>
        <p className="mt-1.5 text-muted-foreground">
          Si quelqu'un de votre entourage a besoin d'installer ou d'entretenir sa borne de recharge,
          partagez notre lien : <span className="font-semibold text-foreground">{COMPANY.siteUrl}</span>
        </p>
        <p className="mt-1 text-muted-foreground">
          Contact : {COMPANY.email} · {COMPANY.telephone} · {COMPANY.telephone2}
        </p>
      </div>
    </div>
  );
}

function TotalRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between text-[12px]">
      <span className={strong ? "font-bold" : "text-muted-foreground"}>{label}</span>
      <span className={`text-mono ${strong ? "font-bold" : ""}`}>{value}</span>
    </div>
  );
}
