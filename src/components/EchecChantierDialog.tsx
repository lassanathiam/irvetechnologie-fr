import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Send, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { envoyerEchecChantier } from "@/lib/planning.functions";
import { MOTIFS_ECHEC, motifEchec, type MotifEchec } from "@/lib/echec-chantier";

/** Fenêtre « Chantier non réalisé » : motif, message préparé modifiable, envoi au donneur d'ordre avec lien photos. */
export function EchecChantierDialog({ rdv, onClose, onSent }: { rdv: { id: string; client_nom: string; partenaire?: string | null }; onClose: () => void; onSent: () => void }) {
  const [cle, setCle] = useState<MotifEchec>("non_conforme");
  const [message, setMessage] = useState<string>(motifEchec("non_conforme").message);
  const envoyerFn = useServerFn(envoyerEchecChantier);
  const envoyer = useMutation({
    mutationFn: () => envoyerFn({ data: { id: rdv.id, motif: motifEchec(cle).label, message } }),
    onSuccess: (r) => {
      if (r.sansDonneur) toast.warning("Aucun email donneur d'ordre sur la fiche partenaire : envoyé seulement en copie à l'équipe.");
      toast.success(r.envoyes.length ? `Rapport envoyé à ${r.envoyes.join(", ")}` : "Chantier signalé (aucun email envoyé).");
      onSent();
      onClose();
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Envoi impossible."),
  });
  return (
    <div className="fixed inset-0 z-[2000] flex items-end justify-center bg-background/80 p-3 sm:items-center" role="dialog" aria-modal="true">
      <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl border bg-card p-4 shadow-xl">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-red-600">Chantier non réalisé</h2>
            <p className="text-sm text-muted-foreground">{rdv.client_nom}{rdv.partenaire ? ` · ${rdv.partenaire}` : ""}</p>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} aria-label="Fermer"><X /></Button>
        </div>
        <p className="mt-3 text-sm font-semibold">Motif</p>
        <div className="mt-1 grid gap-2 sm:grid-cols-2">
          {MOTIFS_ECHEC.map((m) => (
            <Button key={m.cle} type="button" variant={cle === m.cle ? "default" : "outline"} className="h-auto min-h-11 whitespace-normal text-left" onClick={() => { setCle(m.cle); setMessage(m.message); }}>
              {m.label}
            </Button>
          ))}
        </div>
        <label htmlFor="echec-message" className="mt-3 block text-sm font-semibold">Message (modifiable)</label>
        <textarea id="echec-message" value={message} onChange={(e) => setMessage(e.target.value)} rows={7} maxLength={3000} className="mt-1 w-full rounded-md border bg-background p-2 text-sm" placeholder="Expliquez pourquoi le chantier n'a pas pu être réalisé…" />
        <p className="mt-2 text-xs text-muted-foreground">Les photos déjà prises sur ce chantier sont jointes via un lien. Envoi au donneur d'ordre (email principal et copie) et à l'équipe en copie.</p>
        <Button className="mt-3 h-12 w-full bg-red-600 font-bold text-slate-50 hover:bg-red-700" disabled={envoyer.isPending || !message.trim()} onClick={() => { if (window.confirm(`Envoyer le rapport « ${motifEchec(cle).label} » pour ${rdv.client_nom} ?`)) envoyer.mutate(); }}>
          <Send /> {envoyer.isPending ? "Envoi…" : "Envoyer le rapport"}
        </Button>
      </div>
    </div>
  );
}
