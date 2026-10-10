import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText } from "lucide-react";
import { listFichesTechniques } from "@/lib/fiches-techniques.functions";

/** Fiches techniques rangées sur un chantier. */
export function FichesChantier({ rendezvousId }: { rendezvousId: string }) {
  const lister = useServerFn(listFichesTechniques);
  const q = useQuery({ queryKey: ["fiches-techniques", rendezvousId], queryFn: () => lister({ data: { rendezvous_id: rendezvousId } }) });
  if (!q.data?.length) return null;
  return (
    <div className="mt-3">
      <p className="text-xs text-muted-foreground">Fiches techniques</p>
      <ul className="mt-1 space-y-1">
        {q.data.map((f) => (
          <li key={f.id}>
            <a href={f.url ?? undefined} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary underline-offset-2 hover:underline break-all">
              <FileText className="h-4 w-4 shrink-0" /> {f.nom}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
