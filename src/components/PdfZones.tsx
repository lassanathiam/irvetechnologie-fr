import { useEffect, useRef, useState } from "react";
import { Loader2, X } from "lucide-react";
import { nouvelleZone, ZONE_LABEL, type Role, type Zone, type ZoneType } from "@/lib/documents";

type PdfDoc = { numPages: number; getPage: (n: number) => Promise<any> };

async function chargerPdfjs() {
  const pdfjs: any = await import("pdfjs-dist");
  const worker: any = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  return pdfjs;
}

export async function ouvrirPdf(url: string): Promise<PdfDoc> {
  const pdfjs = await chargerPdfjs();
  return await pdfjs.getDocument({ url }).promise;
}

/** Détection « intelligente » : repère les mots-clés du document et propose des zones. */
export async function detecterZones(pdf: PdfDoc, paraphes: boolean): Promise<Zone[]> {
  const zones: Zone[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    const items = (tc.items as any[]).filter((i) => typeof i.str === "string" && i.str.trim());
    const ctxRole = (x: number, txt: string): Role => {
      if (/client|preneur|ma[iî]tre d.ouvrage|acheteur|souscripteur|b[ée]n[ée]ficiaire/i.test(txt)) return "client";
      if (/prestataire|irve|installateur|entreprise|fournisseur|vendeur|soci[ée]t[ée]/i.test(txt)) return "irve";
      return x < 0.5 ? "irve" : "client";
    };
    for (let k = 0; k < items.length; k++) {
      const it = items[k];
      const s: string = it.str;
      const x = it.transform[4] / vp.width;
      const y = 1 - it.transform[5] / vp.height;
      const voisin = items.slice(Math.max(0, k - 3), k + 1).map((i) => i.str).join(" ");
      const role = ctxRole(x, voisin);
      const add = (type: ZoneType, zx: number, zy: number) => {
        const z = nouvelleZone(type, role, p - 1, Math.max(0, zx), Math.max(0, zy));
        if (!zones.some((o) => o.page === z.page && o.type === type && Math.abs(o.x - z.x) < 0.08 && Math.abs(o.y - z.y) < 0.05)) zones.push(z);
      };
      if (/lu et approuv/i.test(s)) add("mention", x, y + 0.012);
      else if (/signature|bon pour accord|signé|cachet/i.test(s)) add("signature", x, y + 0.015);
      else if (/^\s*(fait )?le\s*:?\s*$|^\s*date\s*:?/i.test(s)) add("date", x + 0.08, y - 0.02);
      else if (/^\s*nom( et pr[ée]nom)?\s*:?/i.test(s)) add("nom", x + 0.12, y - 0.02);
    }
  }
  if (!zones.some((z) => z.type === "signature")) {
    const last = pdf.numPages - 1;
    zones.push(nouvelleZone("signature", "irve", last, 0.08, 0.82), nouvelleZone("signature", "client", last, 0.6, 0.82));
    zones.push(nouvelleZone("nom", "client", last, 0.6, 0.78), nouvelleZone("date", "client", last, 0.6, 0.92));
  }
  if (paraphes) {
    for (let p = 0; p < pdf.numPages; p++) {
      if (p === pdf.numPages - 1) continue;
      zones.push(nouvelleZone("paraphe", "client", p, 0.86, 0.93));
      zones.push(nouvelleZone("paraphe", "irve", p, 0.74, 0.93));
    }
  }
  return zones;
}

function PageCanvas({ pdf, n, children }: { pdf: PdfDoc; n: number; children?: React.ReactNode }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const [ratio, setRatio] = useState(1.414);
  useEffect(() => {
    let annule = false;
    (async () => {
      const page = await pdf.getPage(n + 1);
      const c = ref.current;
      if (!c || annule) return;
      const base = page.getViewport({ scale: 1 });
      setRatio(base.height / base.width);
      const w = c.parentElement?.clientWidth || 800;
      const vp = page.getViewport({ scale: (w / base.width) * (window.devicePixelRatio || 1) });
      c.width = vp.width;
      c.height = vp.height;
      await page.render({ canvasContext: c.getContext("2d"), viewport: vp, canvas: c }).promise;
    })().catch(() => {});
    return () => {
      annule = true;
    };
  }, [pdf, n]);
  return (
    <div className="relative w-full overflow-hidden rounded border border-border bg-white shadow" style={{ aspectRatio: `1 / ${ratio}` }}>
      <canvas ref={ref} className="absolute inset-0 h-full w-full" />
      {children}
    </div>
  );
}

export function PdfZones({
  pdf,
  zones,
  onChange,
  roleVisible,
  remplissage,
}: {
  pdf: PdfDoc | null;
  zones: Zone[];
  onChange?: (z: Zone[]) => void;
  roleVisible?: Role;
  remplissage?: Partial<Record<ZoneType, string>>;
}) {
  const drag = useRef<{ id: string; sx: number; sy: number; zx: number; zy: number; w: number; h: number } | null>(null);
  if (!pdf)
    return (
      <div className="flex items-center justify-center p-10 text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Chargement du document…
      </div>
    );
  const pages = Array.from({ length: pdf.numPages }, (_, i) => i);
  return (
    <div className="space-y-4">
      {pages.map((p) => (
        <div key={p}>
          <p className="mb-1 text-xs text-muted-foreground">Page {p + 1} / {pdf.numPages}</p>
          <PageCanvas pdf={pdf} n={p}>
            {zones
              .filter((z) => z.page === p && (!roleVisible || z.role === roleVisible))
              .map((z) => {
                const client = z.role === "client";
                const val = remplissage?.[z.type];
                return (
                  <div
                    key={z.id}
                    className={`absolute flex touch-none select-none items-center justify-center rounded-sm border-2 border-dashed text-[10px] font-bold ${
                      client ? "border-amber-500 bg-amber-300/30 text-amber-900" : "border-sky-600 bg-sky-300/30 text-sky-900"
                    } ${onChange ? "cursor-move" : ""}`}
                    style={{ left: `${z.x * 100}%`, top: `${z.y * 100}%`, width: `${z.w * 100}%`, height: `${z.h * 100}%` }}
                    onPointerDown={(e) => {
                      if (!onChange) return;
                      const box = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect();
                      e.currentTarget.setPointerCapture(e.pointerId);
                      drag.current = { id: z.id, sx: e.clientX, sy: e.clientY, zx: z.x, zy: z.y, w: box.width, h: box.height };
                    }}
                    onPointerMove={(e) => {
                      const d = drag.current;
                      if (!d || d.id !== z.id || !onChange) return;
                      const nx = Math.max(0, Math.min(1 - z.w, d.zx + (e.clientX - d.sx) / d.w));
                      const ny = Math.max(0, Math.min(1 - z.h, d.zy + (e.clientY - d.sy) / d.h));
                      onChange(zones.map((o) => (o.id === z.id ? { ...o, x: nx, y: ny } : o)));
                    }}
                    onPointerUp={() => (drag.current = null)}
                  >
                    {val && val.startsWith("data:") ? (
                      <img src={val} alt="" className="max-h-full max-w-full object-contain" />
                    ) : (
                      <span className="truncate px-1">{val || `${ZONE_LABEL[z.type]} · ${client ? "Client" : "IRVE"}`}</span>
                    )}
                    {onChange && (
                      <button
                        type="button"
                        aria-label="Supprimer la zone"
                        className="absolute -right-2 -top-2 rounded-full bg-destructive p-0.5 text-destructive-foreground"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => onChange(zones.filter((o) => o.id !== z.id))}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                );
              })}
          </PageCanvas>
        </div>
      ))}
    </div>
  );
}
