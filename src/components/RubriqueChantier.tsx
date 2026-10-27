import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export function RubriqueChantier({ titre, resume, children }: { titre: string; resume?: string; children: ReactNode }) {
  const [ouverte, setOuverte] = useState(false);
  return <Collapsible open={ouverte} onOpenChange={setOuverte} className="mb-5 border-b border-border pb-4" aria-label={titre}>
    <CollapsibleTrigger asChild><Button variant="ghost" className="h-auto w-full justify-between gap-3 whitespace-normal px-0 text-left font-bold">
      <span className="min-w-0">{titre}{resume && <span className="mt-1 block text-xs font-normal text-muted-foreground">{resume}</span>}</span>
      <ChevronDown className={`h-5 w-5 shrink-0 transition-transform ${ouverte ? "rotate-180" : ""}`} />
    </Button></CollapsibleTrigger>
    <CollapsibleContent className="pt-3">{children}</CollapsibleContent>
  </Collapsible>;
}