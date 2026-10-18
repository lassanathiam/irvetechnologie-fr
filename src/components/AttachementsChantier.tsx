import { statutAttachement } from "@/lib/attachement-classement";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { ClipboardList, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

export function AttachementsChantier({ rendezvousId }: { rendezvousId: string }) {
  const query = useQuery({
    queryKey: ["attachements-chantier", rendezvousId],
    queryFn: async () => {
      const lignes = await supabase.from("attachement_items")
        .select("attachement_id").eq("rendezvous_id", rendezvousId);
      if (lignes.error) throw new Error(lignes.error.message);
      const ids = [...new Set(lignes.data.map((ligne) => ligne.attachement_id))];
      const filtre = ids.length
        ? `rendezvous_id.eq.${rendezvousId},id.in.(${ids.join(",")})`
        : `rendezvous_id.eq.${rendezvousId}`;
      const result = await supabase.from("attachements_travaux")
        .select("id, numero, statut, facture_id").or(filtre).order("created_at", { ascending: false });
      if (result.error) throw new Error(result.error.message);
      return result.data;
    },
  });

  return <div className="mt-3 space-y-2">
    <p className="text-xs font-semibold text-muted-foreground">Attachements du chantier</p>
    {query.isPending ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      : query.isError ? <Button variant="outline" size="sm" onClick={() => void query.refetch()}>Réessayer le suivi des attachements</Button>
      : query.data.length ? <div className="flex flex-wrap gap-2">{query.data.map((attachement) => (
        <Button key={attachement.id} asChild variant="outline" size="sm" className="h-auto min-h-9 whitespace-normal">
          <Link to="/attachements/$id" params={{ id: attachement.id }}>
            <ClipboardList className="h-4 w-4 shrink-0" /> {attachement.numero} · {statutAttachement(attachement)}
          </Link>
        </Button>
      ))}</div>
      : <Button asChild variant="outline" size="sm"><Link to="/attachements" search={{ rdv: rendezvousId }}><ClipboardList className="h-4 w-4" /> Préparer l’attachement</Link></Button>}
  </div>;
}