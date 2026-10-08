import { Building2 } from "lucide-react";
import { nomReseauClient } from "@/lib/reseau-client";

export function ReseauClientBadge({ nom }: { nom?: string | null }) {
  const reseau = nomReseauClient(nom);
  return <span className="my-1 inline-flex max-w-full items-center gap-2 rounded-md border border-primary/50 bg-primary px-2.5 py-1.5 text-sm font-bold text-primary-foreground">
    <Building2 className="h-4 w-4 shrink-0" />
    <span className="min-w-0 break-words">Donneur d’ordre principal : {reseau ?? "à préciser"}</span>
  </span>;
}