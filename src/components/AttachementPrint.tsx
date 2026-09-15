import { BrandLogo } from "@/components/BrandLogo";
import { COMPANY, dateFr, euro } from "@/lib/company";

type Line = { libelle: string; description?: string | null; quantite: number | string; prix_unitaire: number | string };
type Attachment = {
  numero: string; numero_ticket: string; numero_affaire?: string | null; bon_commande?: string | null;
  client_nom: string; client_email?: string | null; client_telephone?: string | null; client_adresse?: string | null; client_cp_ville?: string | null;
  objet?: string | null; notes?: string | null; date_emission: string; date_echeance: string; autoliquidation: boolean;
  total_ht: number | string; total_tva: number | string; total_ttc: number | string;
};

export function AttachementPrint({ doc, items }: { doc: Attachment; items: Line[] }) {
  return <div className="print-doc rounded-sm border border-border bg-card p-6 text-[13px] leading-relaxed sm:p-8">
    <div className="flex flex-wrap items-start justify-between gap-6 border-b-2 border-primary pb-4">
      <div className="flex items-start gap-4"><BrandLogo className="h-16 w-16" /><div><div className="text-xl font-extrabold uppercase">{COMPANY.raisonSociale}</div><div className="text-[11px] font-bold uppercase text-primary">Attachement de travaux · Fibre optique</div><div className="mt-2 text-[11px] text-muted-foreground">{COMPANY.adresse}, {COMPANY.cpVille}<br />{COMPANY.email} · {COMPANY.telephone}<br />SIRET {COMPANY.siret} · TVA {COMPANY.tva}<br />{COMPANY.qualifications}</div></div></div>
      <div className="min-w-[240px] rounded-sm border border-border bg-muted/40 p-4"><div className="text-[10px] font-bold uppercase text-muted-foreground">Destinataire</div><div className="mt-2 text-base font-extrabold">{doc.client_nom}</div><div className="text-[12px] text-muted-foreground">{doc.client_adresse}<br />{doc.client_cp_ville}<br />{doc.client_email}<br />{doc.client_telephone}</div></div>
    </div>
    <div className="mt-4 grid gap-2 sm:grid-cols-2"><Ref label="Attachement" value={doc.numero} /><Ref label="Ticket intervention" value={doc.numero_ticket} important /><Ref label="Numéro d’affaire" value={doc.numero_affaire} /><Ref label="Bon de commande" value={doc.bon_commande} /><Ref label="Date" value={dateFr(doc.date_emission)} /><Ref label="Échéance" value={dateFr(doc.date_echeance)} /></div>
    <div className="mt-5 font-extrabold">Objet : {doc.objet || "Travaux fibre optique"}</div>
    <table className="mt-4 w-full border-collapse"><thead><tr className="bg-muted text-[10px] font-bold uppercase"><th className="p-3 text-left">Travaux réalisés</th><th className="p-3 text-right">Qté</th><th className="p-3 text-right">Prix HT</th><th className="p-3 text-right">Total HT</th></tr></thead><tbody>{items.map((item, index) => <tr key={index} className="border-b border-border"><td className="p-3"><strong>{item.libelle}</strong>{item.description ? <div className="text-muted-foreground">{item.description}</div> : null}</td><td className="p-3 text-right">{Number(item.quantite)}</td><td className="p-3 text-right">{euro(Number(item.prix_unitaire))}</td><td className="p-3 text-right font-bold">{euro(Number(item.quantite) * Number(item.prix_unitaire))}</td></tr>)}</tbody></table>
    <div className="mt-5 ml-auto w-full space-y-2 sm:w-80"><Total label="Total HT" value={Number(doc.total_ht)} /><Total label={doc.autoliquidation ? "TVA autoliquidée" : "TVA"} value={Number(doc.total_tva)} /><Total label="Total TTC" value={Number(doc.total_ttc)} strong /></div>
    {doc.autoliquidation ? <div className="mt-5 rounded-sm border-2 border-primary p-4 font-bold">Autoliquidation — TVA due par le preneur. Autoliquidation de la TVA en application de l’article 283-2 nonies du CGI.</div> : null}
    {doc.notes ? <div className="mt-5 whitespace-pre-line text-[12px]"><strong>Notes : </strong>{doc.notes}</div> : null}
  </div>;
}

function Ref({ label, value, important }: { label: string; value?: string | null; important?: boolean }) { return value ? <div className={important ? "rounded-sm border border-primary bg-primary/10 p-3" : "p-1"}><span className="text-[10px] font-bold uppercase text-muted-foreground">{label} : </span><strong>{value}</strong></div> : null; }
function Total({ label, value, strong }: { label: string; value: number; strong?: boolean }) { return <div className={`flex justify-between ${strong ? "border-t border-border pt-2 text-lg font-extrabold text-primary" : "text-sm"}`}><span>{label}</span><span>{euro(value)}</span></div>; }