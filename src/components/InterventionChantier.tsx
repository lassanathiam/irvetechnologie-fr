import { ClipboardCheck } from "lucide-react";
import { INTERVENTIONS, interventionLibelle } from "@/lib/chantier-intervention";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function InterventionBadge({ rdv }: { rdv: { nature_dossier?: string | null; type?: string | null } }) {
  return <span className="my-1 inline-flex max-w-full items-center gap-1.5 rounded-md border border-primary bg-card px-2 py-1 text-sm font-bold text-primary"><ClipboardCheck className="h-4 w-4 shrink-0" /><span className="break-words">{interventionLibelle(rdv)}</span></span>;
}

export function NatureInterventionField({ value, onChange, disabled, name = "nature_dossier" }: { value?: string | null; onChange?: (value: string | null) => void; disabled?: boolean; name?: string }) {
  return <div className="min-w-0"><span className="mb-2 block text-xs font-semibold text-muted-foreground">Nature de l’intervention</span><Select name={name} defaultValue={onChange ? undefined : value || "a_preciser"} value={onChange ? value || "a_preciser" : undefined} onValueChange={(v) => onChange?.(v === "a_preciser" ? null : v)} disabled={disabled}><SelectTrigger aria-label="Nature de l’intervention" className="h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="a_preciser">À préciser</SelectItem>{INTERVENTIONS.map((n) => <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>)}</SelectContent></Select></div>;
}