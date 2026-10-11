import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { ModeleStructure, PlacementRapport } from "@/lib/rapport-modeles";
import { RapportTexteCalibre } from "./RapportTexteCalibre";

type Valeurs = Record<string, string | boolean | null>;
type PdfDoc = { numPages: number; getPage: (n: number) => Promise<any> };

async function chargerPdf(dataUrl: string): Promise<PdfDoc> {
  const pdfjs: any = await import("pdfjs-dist");
  const worker: any = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const base64 = dataUrl.split(",")[1] ?? "";
  const raw = atob(base64);
  const bytes = Uint8Array.from(raw, (c) => c.charCodeAt(0));
  return await pdfjs.getDocument({ data: bytes }).promise;
}

function valeurAffichee(v: string | boolean | null | undefined, type: string) {
  if (type === "case") return v === true || v === "true" ? "✓" : "";
  if (type === "ouinon") return v === "oui" ? "OUI" : v === "non" ? "NON" : v === "na" ? "N/A" : "";
  return v == null ? "" : String(v);
}

function PagePdf({ pdf, index, children }: { pdf: PdfDoc; index: number; children: React.ReactNode }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [ratio, setRatio] = useState(1.414);
  useEffect(() => {
    let annule = false;
    (async () => {
      const page = await pdf.getPage(index + 1);
      const canvas = canvasRef.current;
      if (!canvas || annule) return;
      const base = page.getViewport({ scale: 1 });
      setRatio(base.height / base.width);
      const width = canvas.parentElement?.clientWidth ?? 794;
      const viewport = page.getViewport({ scale: (width / base.width) * Math.max(window.devicePixelRatio || 1, 1600 / width) });
      canvas.dataset.rendu = "0";
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext("2d");
      if (!context) return;
      await page.render({ canvasContext: context, viewport, canvas }).promise;
      canvas.dataset.rendu = "1";
      canvas.dispatchEvent(new Event("rendu"));
    })().catch(() => undefined);
    return () => { annule = true; };
  }, [pdf, index]);
  return (
    <div data-report-page={index} className="relative w-full overflow-hidden bg-white print:break-after-page" style={{ aspectRatio: `1 / ${ratio}` }}>
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {children}
    </div>
  );
}

function Calque({ placement, children, edit, onMove }: { placement: PlacementRapport; children: React.ReactNode; edit?: boolean; onMove?: (p: PlacementRapport) => void }) {
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  return (
    <div
      className={`absolute flex touch-none items-center font-semibold text-foreground ${edit ? "cursor-move overflow-hidden border-2 border-dashed border-primary bg-card/85" : "overflow-visible print:border-0"}`}
      style={{ left: `${placement.x * 100}%`, top: `${placement.y * 100}%`, width: `${placement.w * 100}%`, height: `${placement.h * 100}%` }}
      onPointerDown={(event) => {
        if (!edit || !onMove) return;
        const rect = event.currentTarget.getBoundingClientRect();
        drag.current = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (!drag.current || !onMove) return;
        const page = event.currentTarget.closest("[data-report-page]")?.getBoundingClientRect();
        if (!page) return;
        onMove({ ...placement, x: Math.max(0, Math.min(1 - placement.w, (event.clientX - drag.current.dx - page.left) / page.width)), y: Math.max(0, Math.min(1 - placement.h, (event.clientY - drag.current.dy - page.top) / page.height)) });
      }}
      onPointerUp={() => { drag.current = null; }}
      onPointerCancel={() => { drag.current = null; }}
    >
      {children}
    </div>
  );
}

export function RapportOriginalDoc({ structure, valeurs, signatureClient, signatureTechnicien, edit = false, onChange }: {
  structure: ModeleStructure;
  valeurs: Valeurs;
  signatureClient?: string | null;
  signatureTechnicien?: string | null;
  edit?: boolean;
  onChange?: (structure: ModeleStructure) => void;
}) {
  const original = structure.original;
  const [pdf, setPdf] = useState<PdfDoc | null>(null);
  useEffect(() => {
    if (!original || original.type !== "pdf") { setPdf(null); return; }
    let actif = true;
    chargerPdf(original.data_url).then((doc) => actif && setPdf(doc)).catch(() => actif && setPdf(null));
    return () => { actif = false; };
  }, [original?.type, original?.data_url]);
  if (!original) return null;

  const fields = structure.sections.flatMap((section, sectionIndex) =>
    section.champs.map((champ, champIndex) => ({ champ, sectionIndex, champIndex })),
  );
  const overlay = (page: number) => (
    <>
      {fields.filter(({ champ }) => champ.placement?.page === page).map(({ champ, sectionIndex, champIndex }) => {
        const placement = champ.placement;
        if (!placement) return null;
        const value = valeurAffichee(valeurs[champ.id], champ.type);
        // Les anciens modèles ciblent les choix imprimés : réserver une zone
        // de réponse distincte à leur droite sans modifier le document original.
        const reponseX = placement.w > 0.4
          ? 0.82
          : Math.min(0.82, Math.max(0.60, placement.x + placement.w + 0.025));
        const affichage = champ.type === "ouinon" && !edit
          ? { ...placement, x: reponseX, w: 0.93 - reponseX }
          : placement;
        return (
          <Calque key={champ.id} placement={affichage} edit={edit} onMove={(next) => {
            if (!onChange) return;
            const copy = { ...structure, sections: structure.sections.map((s, i) => i !== sectionIndex ? s : { ...s, champs: s.champs.map((c, j) => j !== champIndex ? c : { ...c }) }) };
            const target = copy.sections[sectionIndex]?.champs[champIndex];
            if (target) target.placement = next;
            onChange(copy);
          }}>
            {edit ? <RapportTexteCalibre valeur={champ.label} /> : <RapportTexteCalibre valeur={value} multiligne={champ.type === "zone"} reponse={champ.type === "ouinon"} />}
          </Calque>
        );
      })}
      {(["technicien", "client"] as const).map((role) => {
        const placement = structure.signatures?.[role];
        if (!placement || placement.page !== page) return null;
        const signature = role === "client" ? signatureClient : signatureTechnicien;
        return (
          <Calque key={role} placement={placement} edit={edit} onMove={(next) => {
            if (!onChange) return;
            const copy = { ...structure };
            copy.signatures = { ...(copy.signatures ?? {}), [role]: next };
            onChange(copy);
          }}>
            {signature ? <img src={signature} alt={`Signature ${role}`} className="h-full w-full object-contain" /> : edit ? `Signature ${role}` : ""}
          </Calque>
        );
      })}
    </>
  );

  if (original.type === "image") {
    return (
      <div data-report-page={0} className="rapport-original relative mx-auto w-full max-w-[210mm] overflow-hidden">
        <img src={original.data_url} alt="Document original" className="block h-auto w-full" />
        {overlay(0)}
      </div>
    );
  }
  if (!pdf) return <div className="flex min-h-40 items-center justify-center bg-white text-slate-600"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Chargement du document original…</div>;
  return <div className="rapport-original mx-auto w-full max-w-[210mm] space-y-4 print:space-y-0">{Array.from({ length: pdf.numPages }, (_, page) => <PagePdf key={page} pdf={pdf} index={page}>{overlay(page)}</PagePdf>)}</div>;
}