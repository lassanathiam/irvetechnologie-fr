import { COMPANY } from "@/lib/company";

/** Encadré RIB imprimé sur les devis, factures et attachements (documents blancs). */
export function RibBloc({ className = "" }: { className?: string }) {
  const rib = COMPANY.rib;
  return (
    <div className={`rib-bloc rounded-sm border border-border px-3 py-2 text-[11px] leading-snug ${className}`}>
      <div className="text-[10px] font-bold uppercase tracking-[0.14em]">Règlement par virement · Coordonnées bancaires</div>
      <div className="mt-1 grid gap-x-4 gap-y-0.5 sm:grid-cols-[auto_auto_1fr]">
        <div><span className="text-muted-foreground">IBAN : </span><strong className="whitespace-nowrap">{rib.iban}</strong></div>
        <div><span className="text-muted-foreground">BIC : </span><strong>{rib.bic}</strong></div>
        <div><span className="text-muted-foreground">Titulaire : </span><strong>{rib.titulaire}</strong></div>
      </div>
      <div className="text-[10px] text-muted-foreground">Banque : {rib.domiciliation}</div>
    </div>
  );
}
