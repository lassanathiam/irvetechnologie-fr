import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { lienFicheTechnique, listFichesTechniques } from "@/lib/fiches-techniques.functions";
import { Button } from "@/components/ui/button";

/** Fiches techniques rangées sur un chantier. */
export function FichesChantier({ rendezvousId }: { rendezvousId: string }) {
  const lister = useServerFn(listFichesTechniques);
  const lien = useServerFn(lienFicheTechnique);
  const [ouverture, setOuverture] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["fiches-techniques", rendezvousId],
    queryFn: () => lister({ data: { rendezvous_id: rendezvousId } }),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2,
    throwOnError: false,
  });
  if (q.isError && !q.data) return (
    <div className="mt-3" role="status">
      <p className="text-sm text-muted-foreground">Fiches techniques temporairement indisponibles.</p>
      <Button type="button" variant="outline" size="sm" onClick={() => void q.refetch()} disabled={q.isFetching} className="mt-2">
        {q.isFetching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
        Réessayer
      </Button>
    </div>
  );
  if (!q.data?.length) return null;

  async function ouvrir(id: string) {
    // Fenêtre ouverte tout de suite (sinon bloquée sur téléphone), puis lien frais.
    const w = window.open("", "_blank");
    setOuverture(id);
    try {
      const { url } = await lien({ data: { id } });
      if (w) w.location.href = url;
      else window.location.href = url;
    } catch (e) {
      w?.close();
      toast.error(e instanceof Error ? e.message : "Ouverture impossible.");
    } finally {
      setOuverture(null);
    }
  }

  return (
    <div className="mt-3">
      <p className="text-xs text-muted-foreground">Fiches techniques</p>
      <ul className="mt-1 space-y-1">
        {q.data.map((f) => (
          <li key={f.id}>
            <button type="button" onClick={() => ouvrir(f.id)} disabled={ouverture === f.id} className="inline-flex items-center gap-1.5 text-left text-sm font-semibold text-primary underline-offset-2 hover:underline break-all">
              {ouverture === f.id ? <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> : <FileText className="h-4 w-4 shrink-0" />} {f.nom}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
