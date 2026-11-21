import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FileDown, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AttachementPrint } from "@/components/AttachementPrint";
import { supabase } from "@/integrations/supabase/client";
import { getAttachement } from "@/lib/attachements.functions";
import { getFacture } from "@/lib/factures.functions";
import { listerCommandesImportees } from "@/lib/commandes-memoire.functions";
import { creerFacturePdf } from "@/lib/facture-pdf";
import { creerPdfAttachements } from "@/lib/pdf-attachements";
import { nomDossier } from "@/lib/bloc-dossiers";
import type { LigneSuivi } from "@/lib/etape-chantier";

function enregistrer(blob: Blob, nom: string) {
  const url = URL.createObjectURL(blob); const a = document.createElement("a");
  a.href = url; a.download = nom; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * Télécharge en un seul ZIP les PDF des chantiers choisis du Suivi : facture, attachement et bon de commande reçu (signé si présent),
 * un dossier par facture (ou par attachement s'il n'est pas encore facturé). Ne modifie rien.
 */
export function TelechargerPdfSuivi({ lignes, disabled }: { lignes: LigneSuivi[]; disabled?: boolean }) {
  const lireAtt = useServerFn(getAttachement); const lireFacture = useServerFn(getFacture); const lireCommandes = useServerFn(listerCommandesImportees);
  const [busy, setBusy] = useState<string | null>(null);
  const [docs, setDocs] = useState<Awaited<ReturnType<typeof getAttachement>>[]>([]);
  const [pret, setPret] = useState<{ blob: Blob; nom: string } | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const avecDocs = lignes.filter((l) => l.attId || l.factureId);

  async function preparer() {
    if (!avecDocs.length) { toast.error("Aucun attachement ni facture parmi ces chantiers."); return; }
    setPret(null);
    try {
      // Un dossier par facture, sinon par attachement ; noms des clients finaux réunis.
      const groupes = new Map<string, { factureId: string | null; attIds: Set<string>; noms: Set<string>; commande: string | null }>();
      for (const l of avecDocs) {
        const k = l.factureId ?? l.attId!;
        const g = groupes.get(k) ?? { factureId: l.factureId, attIds: new Set<string>(), noms: new Set<string>(), commande: null };
        if (l.attId) g.attIds.add(l.attId);
        if (l.client) g.noms.add(l.client);
        g.commande ??= l.commande;
        groupes.set(k, g);
      }
      const attIds = [...new Set([...groupes.values()].flatMap((g) => [...g.attIds]))];
      setBusy("Lecture des bons de commande…");
      const commandes = await lireCommandes();
      const cmdParAtt = new Map<string, string>();
      for (const c of commandes as { original_path: string; signe_path: string | null; saisie: any }[]) { const id = c.saisie?.attId; if (id) cmdParAtt.set(id, c.signe_path || c.original_path); }

      const lus = [];
      for (const [i, id] of attIds.entries()) { setBusy(`Lecture des attachements ${i + 1}/${attIds.length}…`); lus.push(await lireAtt({ data: { id } })); }
      setDocs(lus);
      await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
      await document.fonts.ready;
      const els = Array.from(stage.current?.querySelectorAll<HTMLElement>(".print-doc") ?? []);
      await Promise.all(els.flatMap((e) => Array.from(e.querySelectorAll("img"))).map((img) => img.decode().catch(() => undefined)));
      const attPdf = new Map<string, { numero: string; pdf: Blob }>();
      for (const [i, el] of els.entries()) {
        setBusy(`PDF attachement ${i + 1}/${els.length}…`);
        const a = lus[i]?.attachement; if (a) attPdf.set(a.id, { numero: a.numero, pdf: await creerPdfAttachements([el]) });
      }

      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      let n = 0;
      for (const g of groupes.values()) {
        n += 1; setBusy(`Préparation du dossier ${n}/${groupes.size}…`);
        let facture: Awaited<ReturnType<typeof getFacture>> | null = null;
        if (g.factureId) facture = await lireFacture({ data: { id: g.factureId } });
        const premierAtt = attPdf.get([...g.attIds][0] ?? "")?.numero;
        const dossier = nomDossier(g.commande || facture?.facture.numero || premierAtt || `dossier-${n}`, [...g.noms].join(" "));
        if (facture) {
          const pdf = await creerFacturePdf({ ...facture.facture, date_limite: facture.facture.date_echeance }, facture.items);
          zip.file(`${dossier}/Facture_${facture.facture.numero}.pdf`, pdf);
          zip.file(`Toutes_les_factures/Facture_${facture.facture.numero}_${dossier}.pdf`, pdf);
        }
        for (const id of g.attIds) {
          const a = attPdf.get(id); if (a) zip.file(`${dossier}/Attachement_${a.numero}.pdf`, a.pdf);
          const chemin = cmdParAtt.get(id);
          if (chemin) { const f = await supabase.storage.from("documents").download(chemin); if (f.data) zip.file(`${dossier}/Commande_${(g.commande ?? "").replace(/[^\p{L}\d_-]+/gu, "") || a?.numero || id}.pdf`, f.data); }
        }
      }
      setBusy("Création du fichier ZIP…");
      const blob = await zip.generateAsync({ type: "blob" });
      const nom = `chantiers-pdf-${groupes.size}-${new Date().toISOString().slice(0, 10)}.zip`;
      setPret({ blob, nom });
      enregistrer(blob, nom);
      toast.success(`${groupes.size} dossier(s) PDF prêts dans un seul fichier.`);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Téléchargement impossible."); }
    finally { setBusy(null); setDocs([]); }
  }

  return <>
    <Button size="sm" variant="outline" className="font-bold" disabled={disabled || !!busy || !avecDocs.length} onClick={() => void preparer()}>
      {busy ? <Loader2 className="animate-spin" /> : <FileDown />} {busy ?? `Télécharger les PDF (${new Set(avecDocs.map((l) => l.factureId ?? l.attId)).size})`}
    </Button>
    {pret && !busy && <Button size="sm" variant="ghost" onClick={() => enregistrer(pret.blob, pret.nom)}>Enregistrer à nouveau le ZIP</Button>}
    <div ref={stage} className="attachment-export-stage" aria-hidden="true">{docs.map((d) => <AttachementPrint key={d.attachement.id} doc={d.attachement} items={d.items} />)}</div>
  </>;
}
