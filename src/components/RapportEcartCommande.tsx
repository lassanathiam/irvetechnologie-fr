import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, FileWarning, Send, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { preparerRapportEcartCommande, envoyerRapportEcartCommande } from "@/lib/commande-ecart.functions";
import { useEnvoiConfirme } from "@/lib/confirm-envoi";
import { euro } from "@/lib/company";

export function RapportEcartCommande({ id, numero, montantHt }: { id: string; numero: string; montantHt: number }) {
  const preparer = useServerFn(preparerRapportEcartCommande);
  const envoyer = useEnvoiConfirme(envoyerRapportEcartCommande, "Envoyer ce rapport d’écart au donneur d’ordre, avec copie à l’équipe et copie ENSIO si concerné ?");
  const [rapport, setRapport] = useState<Awaited<ReturnType<typeof preparerRapportEcartCommande>> | null>(null);
  const [commentaire, setCommentaire] = useState("");
  const [busy, setBusy] = useState(false);
  const [envoye, setEnvoye] = useState(false);
  const [envoiId, setEnvoiId] = useState("");
  const demande = { id, numero, montantHt, commentaire };
  async function ouvrir() {
    setBusy(true);
    try { setRapport(await preparer({ data: demande })); setEnvoiId(crypto.randomUUID()); setEnvoye(false); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Rapport indisponible."); }
    finally { setBusy(false); }
  }
  async function transmettre() {
    setBusy(true);
    try {
      const result = await envoyer({ data: { ...demande, envoiId } });
      if (result.sent) { setEnvoye(true); toast.success("Rapport transmis au donneur d’ordre, copies incluses."); }
      else toast.error(result.reason === "recipient_suppressed" ? "Le destinataire ne peut pas recevoir cet email. Le rapport n’a pas été envoyé." : "L’envoi d’email n’est pas disponible.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Envoi impossible."); }
    finally { setBusy(false); }
  }
  async function telecharger() {
    if (!rapport) return;
    setBusy(true);
    try { const { telechargerRapportEcart } = await import("@/lib/commande-ecart-pdf"); await telechargerRapportEcart({ ...rapport.rapport, commentaire }); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Téléchargement impossible."); }
    finally { setBusy(false); }
  }
  return <>
    <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void ouvrir()}>{busy ? <Loader2 className="animate-spin" /> : <FileWarning />} Rapport d’écart</Button>
    <Dialog open={!!rapport} onOpenChange={(open) => { if (!open) setRapport(null); }}>
      <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto">
        <DialogHeader><DialogTitle>Rapport d’écart — {numero}</DialogTitle><DialogDescription>{rapport?.rapport.donneur} · {rapport?.rapport.attachement}</DialogDescription></DialogHeader>
        {rapport && <>
          <p className="text-sm">{rapport.rapport.client} · Ticket {rapport.rapport.ticket}</p>
          <dl className="grid grid-cols-1 gap-2 border-y border-border py-3 text-sm sm:grid-cols-3">
            <div><dt className="text-muted-foreground">Commande HT</dt><dd className="font-semibold">{euro(montantHt)}</dd></div>
            <div><dt className="text-muted-foreground">Attachement HT</dt><dd className="font-semibold">{euro(rapport.rapport.attachementHt)}</dd></div>
            <div><dt className="text-muted-foreground">Écart HT (att. − commande)</dt><dd className="font-semibold text-destructive">{euro(rapport.rapport.ecartHt)}</dd></div>
          </dl>
          <div className="space-y-3 text-sm">{rapport.rapport.lignes.map((l, i) => <div key={i} className="border-b border-border pb-2"><strong>{l.libelle}</strong><p className="whitespace-pre-wrap text-muted-foreground">{l.description}</p><p>{l.quantite} × {euro(l.prixUnitaire)} = {euro(l.totalHt)} HT</p></div>)}</div>
          <label className="space-y-2 text-sm">Constat / demande de régularisation<textarea className="mt-2 min-h-24 w-full rounded-md border border-input bg-background p-3" maxLength={2000} value={commentaire} onChange={(e) => { setCommentaire(e.target.value); setEnvoye(false); setEnvoiId(crypto.randomUUID()); }} /></label>
          <p className="text-xs text-muted-foreground">Comparaison des totaux HT ; détail des prestations de l’attachement, sans rapprochement automatique des lignes de la commande.</p>
          <p className="text-sm">Destinataire : {rapport.destinataire || "Email manquant sur l’attachement"}<br /><span className="text-muted-foreground">Copie équipe · copie ENSIO si concerné</span></p>
          <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={busy} onClick={() => void telecharger()}><Download /> Télécharger PDF</Button><Button disabled={busy || envoye || !rapport.destinataire} onClick={() => void transmettre()}><Send />{envoye ? "Rapport transmis" : "Envoyer le rapport"}</Button></div>
        </>}
      </DialogContent>
    </Dialog>
  </>;
}