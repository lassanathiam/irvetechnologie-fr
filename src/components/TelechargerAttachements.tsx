import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { AttachementPrint } from "@/components/AttachementPrint";
import { getAttachement } from "@/lib/attachements.functions";
import { creerPdfAttachements, enregistrerPdfAttachements } from "@/lib/pdf-attachements";

export function TelechargerAttachements({ ids, label = "Télécharger PDF" }: { ids: string[]; label?: string }) {
  const get = useServerFn(getAttachement);
  const [busy, setBusy] = useState(false);
  const [documents, setDocuments] = useState<Awaited<ReturnType<typeof getAttachement>>[]>([]);
  const [ready, setReady] = useState<{ blob: Blob; key: string; filename: string } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const key = ids.join(".");
  async function download() {
    if (ready?.key === key) {
      const file = new File([ready.blob], ready.filename, { type: "application/pdf" });
      if (matchMedia("(pointer: coarse)").matches && navigator.canShare?.({ files: [file] })) {
        try { await navigator.share({ files: [file], title: ready.filename }); return; }
        catch (error) { if ((error as DOMException).name === "AbortError") return; }
      }
      enregistrerPdfAttachements(ready.blob, ready.filename);
      return;
    }
    setBusy(true);
    try {
      const docs = [];
      for (const id of ids) docs.push(await get({ data: { id } }));
      setDocuments(docs);
      await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
      await document.fonts.ready;
      const elements = Array.from(root.current?.querySelectorAll<HTMLElement>(".print-doc") ?? []);
      if (elements.length !== ids.length) throw new Error("Le document n’est pas encore prêt. Réessayez.");
      await Promise.all(elements.flatMap((element) => Array.from(element.querySelectorAll("img"))).map((img) => img.decode()));
      const blob = await creerPdfAttachements(elements);
      const filename = docs.length === 1 ? `${docs[0].attachement.numero}.pdf` : `attachements-${docs.length}.pdf`;
      setReady({ blob, key, filename });
      if (!matchMedia("(pointer: coarse)").matches) enregistrerPdfAttachements(blob, filename);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Téléchargement impossible."); }
    finally { setBusy(false); setDocuments([]); }
  }
  return <>
    <Button type="button" variant="outline" size="sm" disabled={busy || !ids.length} onClick={(event) => { event.preventDefault(); event.stopPropagation(); void download(); }}>
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      {busy ? "Préparation du PDF…" : ready?.key === key ? "Enregistrer PDF" : label}
    </Button>
    <div ref={root} className="attachment-export-stage" aria-hidden="true">{documents.map((doc) => <AttachementPrint key={doc.attachement.id} doc={doc.attachement} items={doc.items} />)}</div>
  </>;
}