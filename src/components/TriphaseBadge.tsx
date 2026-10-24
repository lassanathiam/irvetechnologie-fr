import { Zap, TriangleAlert } from "lucide-react";
import { estChantierTriphase } from "@/lib/chantier-phase";

export function TriphaseBadge({ phase }: { phase?: string | null }) {
  if (!estChantierTriphase({ phase_installation: phase })) return null;
  return <span className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-neon-yellow px-2 py-1 text-xs font-extrabold text-premium-night"><Zap className="h-4 w-4 shrink-0" aria-hidden="true" />Triphasé · 3 phases</span>;
}

export function TriphasePreparation({ phase }: { phase?: string | null }) {
  if (!estChantierTriphase({ phase_installation: phase })) return null;
  return <div className="flex min-w-0 gap-3 rounded-lg border-2 border-neon-yellow bg-neon-yellow p-4 text-premium-night" role="note" aria-label="Préparation du chantier triphasé">
    <TriangleAlert className="h-6 w-6 shrink-0" aria-hidden="true" />
    <div className="min-w-0"><p className="font-extrabold">Chantier triphasé — matériel spécifique</p><p className="mt-1 break-words text-sm font-medium">Avant de partir : vérifier la borne, les protections, le câble et les accessoires adaptés au triphasé, selon la fiche technique.</p></div>
  </div>;
}