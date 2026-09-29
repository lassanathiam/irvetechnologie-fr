/**
 * Rend un PDF « signable » côté navigateur.
 * Certains PDF (attestations, contrats générés par des logiciels) sont protégés :
 * on ne peut pas y poser de signature sans les abîmer. Dans ce cas on recrée
 * une copie propre, page par page, en haute définition.
 */
export async function estPdfProtege(bytes: Uint8Array): Promise<boolean> {
  const { PDFDocument } = await import("pdf-lib");
  try {
    await PDFDocument.load(bytes);
    return false;
  } catch (e) {
    return /encrypt/i.test(e instanceof Error ? e.message + e.name : String(e));
  }
}

export async function recreerPdfPropre(bytes: Uint8Array): Promise<Uint8Array> {
  const pdfjs: any = await import("pdfjs-dist");
  const worker: any = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const cdn = `https://unpkg.com/pdfjs-dist@${pdfjs.version}`;
  const src = await pdfjs.getDocument({ data: bytes.slice(), standardFontDataUrl: `${cdn}/standard_fonts/`, cMapUrl: `${cdn}/cmaps/`, cMapPacked: true }).promise;
  const { PDFDocument } = await import("pdf-lib");
  const out = await PDFDocument.create();
  for (let p = 1; p <= src.numPages; p++) {
    const page = await src.getPage(p);
    const vp1 = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: 2.2 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(vp.width);
    canvas.height = Math.ceil(vp.height);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    const blob: Blob = await new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("Rendu impossible"))), "image/jpeg", 0.9));
    const img = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
    const pg = out.addPage([vp1.width, vp1.height]);
    pg.drawImage(img, { x: 0, y: 0, width: vp1.width, height: vp1.height });
  }
  return await out.save();
}

/** Renvoie le PDF tel quel s'il est sain, sinon une copie propre. */
export async function pdfSignable(bytes: Uint8Array): Promise<{ bytes: Uint8Array; recree: boolean }> {
  if (!(await estPdfProtege(bytes))) return { bytes, recree: false };
  return { bytes: await recreerPdfPropre(bytes), recree: true };
}
