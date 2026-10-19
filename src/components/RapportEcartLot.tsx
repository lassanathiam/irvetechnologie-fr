import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Copy, Download, FileWarning, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { preparerRapportEcartCommande } from "@/lib/commande-ecart.functions";
import type { RapportEcart } from "@/lib/commande-ecart";
import { contenuRapportLot, type CouleursRapport } from "@/lib/commande-ecart-lot";

export type CommandePourRapport = { id: string; numero: string; montantHt: number };
function couleursDocument(): CouleursRapport {
  const style = getComputedStyle(document.documentElement);
  const lire = (cle: string) => style.getPropertyValue(`--rapport-${cle}`).trim();
  return { texte: lire("texte"), deplacement: lire("deplacement"), supplement: lire("supplement"), ecart: lire("ecart") };
}
export function RapportEcartLot({ commandes, disabled }: { commandes: CommandePourRapport[]; disabled?: boolean }) {
  const preparer = useServerFn(preparerRapportEcartCommande);
  const [rapports, setRapports] = useState<RapportEcart[]>([]);
  const [couleurs, setCouleurs] = useState<CouleursRapport | null>(null);
  const [commentaire, setCommentaire] = useState("");
  const [busy, setBusy] = useState(false);
  const [copieManuelle, setCopieManuelle] = useState(false);
  const contenu = couleurs ? contenuRapportLot(rapports, commentaire, couleurs) : null;
  async function ouvrir() {
    setBusy(true);
    try {
      if (new Set(commandes.map((c) => c.id)).size !== commandes.length) throw new Error("Deux commandes ciblent le même attachement : vérifiez leur association.");
      const resultats: RapportEcart[] = [];
      for (const commande of commandes) resultats.push((await preparer({ data: { ...commande, commentaire: "" } })).rapport);
      setCouleurs(couleursDocument()); setRapports(resultats); setCommentaire(""); setCopieManuelle(false);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Rapport indisponible."); }
    finally { setBusy(false); }
  }
  async function copier() {
    if (!contenu) return;
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([contenu.html], { type: "text/html" }), "text/plain": new Blob([contenu.texte], { type: "text/plain" }) })]);
        toast.success("Rapport copié avec les couleurs pour votre email.");
      } else { setCopieManuelle(true); }
    } catch { setCopieManuelle(true); toast.info("Sélectionnez le rapport ci-dessous pour le copier."); }
  }
  async function telecharger() {
    if (!couleurs) return;
    setBusy(true);
    try {
      const { telechargerRapportEcartLot } = await import("@/lib/commande-ecart-pdf");
      await telechargerRapportEcartLot(rapports, commentaire, couleurs);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Téléchargement impossible."); }
    finally { setBusy(false); }
  }
  return <>
    <Button variant="outline" disabled={disabled || busy || !commandes.length} onClick={() => void ouvrir()}>{busy ? <Loader2 className="animate-spin" /> : <FileWarning />} Rapport groupé ({commandes.length})</Button>
    <Dialog open={rapports.length > 0} onOpenChange={(open) => { if (!open && !busy) setRapports([]); }}>
      <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
        <DialogHeader><DialogTitle>Rapport d’écart groupé — {rapports.length} commande(s)</DialogTitle><DialogDescription>{[...new Set(rapports.map((r) => r.donneur))].join(" · ")}</DialogDescription></DialogHeader>
        <label className="text-sm">Constat / demande de régularisation<textarea className="mt-2 min-h-24 w-full rounded-md border border-input bg-background p-3" maxLength={2000} value={commentaire} onChange={(e) => setCommentaire(e.target.value)} /></label>
        {new Set(rapports.map((r) => r.donneur)).size > 1 && <p className="text-sm text-destructive">Plusieurs donneurs d’ordre sont inclus : ne transmettez ce rapport qu’aux personnes autorisées à voir tous ces dossiers.</p>}
        <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => void telecharger()}><Download /> Télécharger PDF</Button><Button disabled={busy} onClick={() => void copier()}><Copy /> Copier pour email</Button></div>
        {copieManuelle && <textarea aria-label="Rapport à copier" readOnly value={contenu?.texte ?? ""} onFocus={(e) => e.target.select()} className="min-h-48 w-full rounded-md border border-input bg-background p-3 text-sm" />}
        {contenu && <div className="rapport-commande-preview min-w-0 break-words rounded-md border border-border p-4" dangerouslySetInnerHTML={{ __html: contenu.html }} />}
      </DialogContent>
    </Dialog>
  </>;
}