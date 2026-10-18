/** Appose « Bon pour accord » + signature + cachet IRVE sur la 1re page d'un bon de commande. */
export async function signerCommande(bytes: Uint8Array, date = new Date()): Promise<Uint8Array> {
  const { pdfSignable } = await import("./pdf-signable");
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
  const propre = (await pdfSignable(bytes)).bytes;
  const pdf = await PDFDocument.load(propre);
  const page = pdf.getPage(0);
  const { width, height } = page.getSize();
  const font = await pdf.embedFont(StandardFonts.HelveticaBold);
  const [cachet, signature] = await Promise.all(["/cachet-irve.jpg", "/signature-irve.jpg"].map(async (u) => pdf.embedJpg(new Uint8Array(await (await fetch(u)).arrayBuffer()))));
  const s = Math.min(width, height) / 595; // échelle par rapport à A4
  const boxW = 210 * s, boxH = 92 * s;
  const x = width - boxW - 24 * s, y = height * 0.2;
  page.drawRectangle({ x, y, width: boxW, height: boxH, color: rgb(1, 1, 1), borderColor: rgb(0.08, 0.35, 0.85), borderWidth: 1 });
  page.drawText("BON POUR ACCORD - IRVE TECHNOLOGIE", { x: x + 6 * s, y: y + boxH - 13 * s, size: 7.5 * s, font, color: rgb(0.08, 0.35, 0.85) });
  page.drawText(`Le ${date.toLocaleDateString("fr-FR")}`, { x: x + 6 * s, y: y + boxH - 24 * s, size: 7 * s, font, color: rgb(0.1, 0.1, 0.1) });
  const sh = 52 * s;
  page.drawImage(signature, { x: x + 6 * s, y: y + 6 * s, width: (sh * signature.width) / signature.height, height: sh });
  const ch = 62 * s;
  const cw = (ch * cachet.width) / cachet.height;
  page.drawImage(cachet, { x: x + boxW - cw - 6 * s, y: y + 4 * s, width: cw, height: ch });
  return await pdf.save();
}
