/** All document reading runs in the browser; OCR downloads engines, never sends the document. */
async function ocrLocal(image: Blob | HTMLCanvasElement): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  const workerUrl = await import("tesseract.js/dist/worker.min.js?url");
  const worker = await createWorker("fra", 1, { workerPath: workerUrl.default });
  try { return (await worker.recognize(image)).data.text; }
  finally { await worker.terminate(); }
}

export async function texteFichierSansIA(f: File): Promise<string> {
  if (f.size > 10_000_000) throw new Error("Fichier trop lourd (10 Mo maximum).");
  const nom = f.name.toLowerCase();
  if (/\.(txt|md)$/.test(nom) || f.type === "text/plain") return f.text();
  if (/\.(xlsx|xls|csv|ods)$/.test(nom)) {
    const XLSX = await import("xlsx");
    const wb = XLSX.read(await f.arrayBuffer(), { cellDates: true });
    return wb.SheetNames.map((n) => {
      const sheet = wb.Sheets[n];
      return sheet ? XLSX.utils.sheet_to_csv(sheet, { FS: "\t", dateNF: "dd/mm/yyyy" }) : "";
    }).join("\n\n");
  }
  if (f.type.startsWith("image/")) return ocrLocal(f);
  if (f.type === "application/pdf" || nom.endsWith(".pdf")) {
    const pdfjs = await import("pdfjs-dist");
    const workerUrl = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl.default;
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise;
    try {
      if (doc.numPages > 50) throw new Error("PDF de plus de 50 pages : divisez-le avant l’import.");
      const pages: string[] = [];
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const content = await page.getTextContent();
        let text = "", y: number | undefined, finX: number | undefined;
        for (const item of content.items) {
          if (!("str" in item)) continue;
          const nextY = item.transform[5];
          const x = item.transform[4] ?? 0;
          const taille = Math.abs(item.transform[0] ?? 10) || 10;
          const nouvelleLigne = y !== undefined && Math.abs((nextY ?? y) - y) > 3;
          // Les PDF qui découpent chaque lettre : pas d'espace quand le morceau suit immédiatement le précédent.
          const colle = !nouvelleLigne && finX !== undefined && x - finX < taille * 0.15 && !/\s$/.test(text) && !/^\s/.test(item.str);
          text += (nouvelleLigne ? "\n" : colle || text === "" ? "" : " ") + item.str;
          if (item.hasEOL) text += "\n";
          y = nextY; finX = x + (item.width ?? 0);
        }
        if (text.trim().length < 15) {
          const viewport = page.getViewport({ scale: Math.min(3, 2800 / page.getViewport({ scale: 1 }).width) });
          const canvas = document.createElement("canvas");
          canvas.width = Math.ceil(viewport.width); canvas.height = Math.ceil(viewport.height);
          const context = canvas.getContext("2d");
          if (!context) throw new Error("Lecture du PDF impossible.");
          await page.render({ canvasContext: context, viewport }).promise;
          text = await ocrLocal(canvas);
          canvas.width = 0; canvas.height = 0;
        }
        pages.push(text); page.cleanup();
      }
      return pages.join("\n\n");
    } finally { await doc.destroy(); }
  }
  throw new Error("Format non supporté : texte, photo, PDF, Excel ou CSV.");
}