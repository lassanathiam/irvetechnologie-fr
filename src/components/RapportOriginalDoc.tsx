import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import type { ModeleStructure, PlacementRapport } from "@/lib/rapport-modeles";

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
  if (type === "ouinon") return v === "oui" ? "Oui" : v === "non" ? "Non" : v === "na" ? "N/A" : "";
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
      const viewport = page.getViewport({ scale: (width / base.width) * (window.devicePixelRatio || 1) });
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const context = canvas.getContext("2d");
      if (!context) return;
      await page.render({ canvasContext: context, viewport, canvas }).promise;
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
      className={`absolute flex touch-none items-center overflow-hidden px-1 text-[clamp(7px,1.45vw,13px)] font-semibold text-slate-950 ${edit ? "cursor-move border-2 border-dashed border-blue-600 bg-blue-50/85" : "print:border-0"}`}
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
  }, [original]);
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
        return (
          <Calque key={champ.id} placement={placement} edit={edit} onMove={(next) => {
            if (!onChange) return;
            const copy = structuredClone(structure);
            const target = copy.sections[sectionIndex]?.champs[champIndex];
            if (target) target.placement = next;
            onChange(copy);
          }}>
            {edit ? champ.label : value}
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
            const copy = structuredClone(structure);
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
      <div data-report-page={0} className="relative mx-auto w-full max-w-[210mm] overflow-hidden bg-white">
        <img src={original.data_url} alt="Document original" className="block h-auto w-full" />
        {overlay(0)}
      </div>
    );
  }
  if (!pdf) return <div className="flex min-h-40 items-center justify-center bg-white text-slate-600"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Chargement du document original…</div>;
  return <div className="mx-auto w-full max-w-[210mm] space-y-4 print:space-y-0">{Array.from({ length: pdf.numPages }, (_, page) => <PagePdf key={page} pdf={pdf} index={page}>{overlay(page)}</PagePdf>)}</div>;
}