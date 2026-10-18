import { useState } from "react";
import { Check, Loader2, Save } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { modifierCommentairePhoto } from "@/lib/planning.functions";

export default function PhotoCommentaire({ id, rdvId, legende, enLigne }: {
  id: string; rdvId: string; legende: string | null; enLigne: boolean;
}) {
  const [texte, setTexte] = useState(legende ?? "");
  const [enregistre, setEnregistre] = useState(legende ?? "");
  const saveFn = useServerFn(modifierCommentairePhoto);
  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (commentaire: string) => saveFn({ data: { id, rendezvous_id: rdvId, legende: commentaire } }),
    onSuccess: async (_, commentaire) => {
      setEnregistre(commentaire.trim());
      toast.success("Commentaire enregistré.");
      await qc.invalidateQueries({ queryKey: ["photos-chantier", rdvId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Commentaire non enregistré."),
  });
  const modifie = texte.trim() !== enregistre;
  return <div className="mt-2 w-full">
    <label className="block text-xs text-muted-foreground">
      Commentaire de la photo
      <textarea aria-label="Commentaire de la photo" value={texte} onChange={(e) => setTexte(e.target.value)}
        maxLength={160} rows={2} disabled={save.isPending}
        className="mt-1 w-full resize-y rounded-md border border-border bg-background p-2 text-sm text-foreground" />
    </label>
    <Button type="button" size="sm" variant="outline" disabled={!modifie || save.isPending || !enLigne}
      onClick={() => save.mutate(texte)} className="mt-1 w-full gap-1.5">
      {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : modifie ? <Save className="h-3.5 w-3.5" /> : <Check className="h-3.5 w-3.5" />}
      {save.isPending ? "Enregistrement…" : modifie ? "Enregistrer" : "Enregistré"}
    </Button>
    {!enLigne && modifie && <p role="status" className="mt-1 text-xs text-muted-foreground">Commentaire non enregistré : attendez le retour du réseau.</p>}
  </div>;
}