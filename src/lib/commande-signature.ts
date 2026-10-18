/** Cachet + signature IRVE officiels (même visuel que les autres documents), en PNG. */
async function cachetPng(): Promise<Uint8Array> {
  const img = new Image();
  img.src = "/cachet-signature-irve.svg";
  await img.decode();
  const w = 800;
  const h = Math.round((w * (img.naturalHeight || 400)) / (img.naturalWidth || 800));
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  c.getContext("2d")!.drawImage(img, 0, 0, w, h);
  const blob: Blob = await new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Cachet indisponible"))), "image/png"));
  return new Uint8Array(await blob.arrayBuffer());
}

/** Appose « Bon pour accord » + cachet signé IRVE sur la 1re page d'un bon de commande. */
export async function signerCommande(bytes: Uint8Array, date = new Date()): Promise<Uint8Array> {
  const { pdfSignable } = await import("./pdf-signable");
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const propre = (await pdfSignable(bytes)).bytes;
  const pdf = await PDFDocument.load(propre);
  const page = pdf.getPage(0);
  const { width, height } = page.getSize();
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const cachet = await pdf.embedPng(await cachetPng());
  const s = Math.min(width, height) / 595;
  const boxW = 210 * s, boxH = 100 * s;
  const x = width - boxW - 24 * s, y = height * 0.2;
  page.drawRectangle({ x, y, width: boxW, height: boxH, color: rgb(1, 1, 1), borderColor: rgb(0.08, 0.35, 0.85), borderWidth: 1 });
  page.drawText("BON POUR ACCORD - IRVE TECHNOLOGIE", { x: x + 6 * s, y: y + boxH - 13 * s, size: 7.5 * s, font, color: rgb(0.08, 0.35, 0.85) });
  page.drawText(`Le ${date.toLocaleDateString("fr-FR")}`, { x: x + 6 * s, y: y + boxH - 24 * s, size: 7 * s, font, color: rgb(0.1, 0.1, 0.1) });
  const maxH = boxH - 30 * s, maxW = boxW - 12 * s;
  const r = Math.min(maxH / cachet.height, maxW / cachet.width);
  page.drawImage(cachet, { x: x + (boxW - cachet.width * r) / 2, y: y + 4 * s, width: cachet.width * r, height: cachet.height * r });
  return await pdf.save();
}
