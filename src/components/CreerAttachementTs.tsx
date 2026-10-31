import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FilePlus2, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { LignesAttachement, nouvelleLigne, type LigneAtt, type PrestationBpu } from "@/components/LignesAttachement";
import { creerAttachementTs } from "@/lib/attachements.functions";
import { lignesTsDepuisTes, type LigneTesBase } from "@/lib/attachement-ts";
import { euro } from "@/lib/company";

/**
 * Bouton + fenêtre de création d'un document TS séparé.
 * `lignesInitiales` : lignes TES déjà marquées sur l'attachement initial, reprises
 * dans la fenêtre pour ne pas les ressaisir. L'attachement initial n'est jamais modifié.
 */
export function CreerAttachementTs({ id, numero, chantiers, catalogue, disabled, lignesInitiales = [], label = "Créer un TS séparé", variant = "outline", size = "default", className }: {
  id: string; numero: string; chantiers: Map<string, string>; catalogue: PrestationBpu[]; disabled?: boolean;
  lignesInitiales?: LigneTesBase[]; label?: string; variant?: "outline" | "secondary" | "ghost"; size?: "default" | "sm"; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [documentId, setDocumentId] = useState("");
  const [lines, setLines] = useState<LigneAtt[]>([]);
  const [commande, setCommande] = useState("");
  const [chantier, setChantier] = useState("");
  const [reprises, setReprises] = useState(0);
  const fn = useServerFn(creerAttachementTs);
  const navigate = useNavigate(); const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => fn({ data: { initial_id: id, document_id: documentId, bon_commande: commande || null,
      items: lines.map((l) => ({ libelle: l.libelle, description: l.description || null, quantite: Number(l.quantite), prix_unitaire: Number(l.prix), rendezvous_id: l.rendezvous_id || chantier || null, tes: true })) } }),
    onSuccess: (r) => { setOpen(false); void qc.invalidateQueries({ queryKey: ["attachements"] }); void qc.invalidateQueries({ queryKey: ["attachement", id] }); void navigate({ to: "/attachements/$id", params: { id: r.id } }); },
  });
  const ouvrir = () => {
    mutation.reset();
    setDocumentId(crypto.randomUUID());
    setCommande("");
    setChantier(chantiers.size === 1 ? [...chantiers.keys()][0] ?? "" : "");
    const pre = lignesTsDepuisTes(lignesInitiales);
    setReprises(pre.length);
    setLines(pre.length ? pre.map((l) => nouvelleLigne(l)) : [nouvelleLigne({ tes: true })]);
    setOpen(true);
  };
  const total = lines.reduce((s, l) => s + (Number(l.quantite) || 0) * (Number(l.prix) || 0), 0);
  const invalid = !lines.length || lines.some((l) => !l.libelle.trim() || !l.prix.trim() || !Number.isFinite(Number(l.prix)) || Number(l.prix) < 0 || !Number.isFinite(Number(l.quantite)) || Number(l.quantite) <= 0);
  return <>
    <Button variant={variant} size={size} className={className} disabled={disabled} onClick={(e) => { e.preventDefault(); e.stopPropagation(); ouvrir(); }}><FilePlus2 /> {label}</Button>
    <Dialog open={open} onOpenChange={(v) => { if (!mutation.isPending) setOpen(v); }}>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto">
        <DialogHeader><DialogTitle>Travaux supplémentaires · TS</DialogTitle><DialogDescription>Attachement initial : {numero} · inchangé. Nouveau document à faire valider séparément.</DialogDescription></DialogHeader>
        {reprises > 0 && <p className="rounded-md border border-amber-500/60 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">Reprend {reprises} ligne{reprises > 1 ? "s" : ""} d’écart{reprises > 1 ? "s" : ""} déjà marquée{reprises > 1 ? "s" : ""} sur l’attachement initial. Modifiez, ajoutez ou retirez des lignes avant de créer le document.</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">Bon de commande TS<Input className="mt-1" value={commande} onChange={(e) => setCommande(e.target.value)} placeholder="À renseigner lorsqu’il est reçu" /></label>
          {chantiers.size > 0 && <label className="text-sm">Chantier<select aria-label="Chantier du TS" className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3" value={chantier} onChange={(e) => setChantier(e.target.value)}><option value="">Plusieurs chantiers / référence dans la description</option>{[...chantiers].map(([rdv, label2]) => <option key={rdv} value={rdv}>{label2}</option>)}</select></label>}
        </div>
        <LignesAttachement lines={lines} setLines={(l) => setLines(l.map((i) => ({ ...i, tes: true })))} catalogue={catalogue} />
        {mutation.error && <p role="alert" className="text-sm text-destructive">{mutation.error instanceof Error ? mutation.error.message : "Création impossible."}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3"><strong>Total TS : {euro(total)} HT</strong><Button disabled={invalid || mutation.isPending} onClick={() => mutation.mutate()}>{mutation.isPending ? <Loader2 className="animate-spin" /> : <Save />} Créer le document TS</Button></div>
      </DialogContent>
    </Dialog>
  </>;
}
