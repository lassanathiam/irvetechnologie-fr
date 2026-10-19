export async function texteDuPdf(bytes: Uint8Array): Promise<string> {
  const pdfjs = await import("pdfjs-dist");
  const worker = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
  try {
    const textes: string[] = [];
    for (let index = 1; index <= doc.numPages; index++) {
      const page = await doc.getPage(index);
      const contenu = await page.getTextContent();
      textes.push(contenu.items.map((item) => "str" in item ? item.str : "").join(" "));
    }
    return textes.join(" ");
  } finally { await doc.destroy(); }
}