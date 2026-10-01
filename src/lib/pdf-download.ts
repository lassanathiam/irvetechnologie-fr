/**
 * Génère un PDF A4 téléchargeable à partir d'un élément (fonctionne sur mobile / PWA).
 * Mise en page ordinateur forcée, marges, et coupures de page placées entre les
 * lignes / blocs pour qu'aucun texte ne soit coupé en deux.
 */
export async function downloadElementAsPdf(element: HTMLElement, fileName: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);

  const RENDER_W = 820; // largeur « ordinateur » (≈ A4 à 96 dpi)
  const blocks: Array<[number, number]> = [];
  let rootH = 0;

  const labelled = Array.from(element.querySelectorAll<HTMLElement>("[data-label]")).map((n) => {
    const v = n.getAttribute("data-label")!;
    n.removeAttribute("data-label");
    return [n, v] as const;
  });
  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
    windowWidth: 1280,
    width: RENDER_W,
    onclone: (doc, clone) => {
      clone.classList.add("pdf-render");
      const st = doc.createElement("style");
      st.textContent = "td::before,td::after{content:none!important;display:none!important}.pdf-render,.pdf-render *{letter-spacing:normal!important}.pdf-render{background:#ffffff!important}";
      doc.head.appendChild(st);
      clone.style.width = `${RENDER_W}px`;
      clone.style.maxWidth = `${RENDER_W}px`;
      clone.style.border = "0";
      clone.style.boxShadow = "none";
      clone.style.overflow = "visible";
      doc.querySelectorAll(".print\\:hidden").forEach((n) => ((n as HTMLElement).style.display = "none"));
      clone.querySelectorAll("[data-label]").forEach((n) => n.removeAttribute("data-label"));
      clone.querySelectorAll("table").forEach((t) => {
        (t as HTMLElement).style.width = "100%";
        (t as HTMLElement).style.tableLayout = "fixed";
        (t as HTMLElement).style.wordBreak = "break-word";
      });
      const top = clone.getBoundingClientRect().top;
      rootH = clone.getBoundingClientRect().height;
      const sel = "tr, h1, h2, h3, p, li, img";
      clone.querySelectorAll(sel).forEach((n) => {
        if (n.tagName === "TABLE" || n.tagName === "TBODY" || n.querySelector("table")) return;
        const r = (n as HTMLElement).getBoundingClientRect();
        if (r.height > 0 && r.height < 260) blocks.push([r.top - top, r.bottom - top]);
      });
    },
  });

  labelled.forEach(([n, v]) => n.setAttribute("data-label", v));

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 7;
  const contentW = pageW - margin * 2;
  const contentH = pageH - margin * 2;

  const pxPerCss = canvas.height / (rootH || canvas.height / 2);
  const mmPerPx = contentW / canvas.width;
  const pagePx = contentH / mmPerPx;

  // Un document qui dépasse légèrement tient mieux sur une seule feuille que
  // sur une deuxième page presque vide. La réduction reste limitée pour garder
  // les textes lisibles ; les documents réellement longs conservent la pagination.
  const naturalHeightMm = canvas.height * mmPerPx;
  if (naturalHeightMm <= contentH * 1.25) {
    // Jamais plus large que la page : on garde la plus petite des deux échelles.
    const fittedScale = Math.min(contentW / canvas.width, contentH / canvas.height);
    const fittedWidth = canvas.width * fittedScale;
    const fittedHeight = canvas.height * fittedScale;
    const x = (pageW - fittedWidth) / 2;
    pdf.addImage(
      canvas.toDataURL("image/jpeg", 0.92),
      "JPEG",
      x,
      margin,
      fittedWidth,
      fittedHeight,
      undefined,
      "FAST",
    );
    const safe = `${fileName.replace(/[^a-zA-Z0-9-_]+/g, "-")}.pdf`;
    const blob = pdf.output("blob") as Blob;
    await shareOrDownloadPdf(blob, safe);
    return;
  }

  // Point de coupure sûr : le plus bas possible sans traverser un bloc.
  const safeCut = (start: number, ideal: number) => {
    let cut = ideal;
    for (let guard = 0; guard < 50; guard++) {
      const hit = blocks.find(([a, b]) => a * pxPerCss < cut - 1 && b * pxPerCss > cut + 1);
      if (!hit) break;
      const candidate = hit[0] * pxPerCss - 2;
      if (candidate <= start + pagePx * 0.4) break; // bloc géant : on coupe quand même
      cut = candidate;
    }
    return Math.floor(cut);
  };

  let y = 0;
  let first = true;
  while (y < canvas.height - 2) {
    const end = y + pagePx >= canvas.height ? canvas.height : safeCut(y, y + pagePx);
    const h = end - y;
    if (h * mmPerPx < 15 && !first) break;
    const slice = document.createElement("canvas");
    slice.width = canvas.width;
    slice.height = h;
    const ctx = slice.getContext("2d")!;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, slice.width, h);
    ctx.drawImage(canvas, 0, y, canvas.width, h, 0, 0, canvas.width, h);
    if (!first) pdf.addPage();
    first = false;
    pdf.addImage(slice.toDataURL("image/jpeg", 0.92), "JPEG", margin, margin, contentW, h * mmPerPx, undefined, "FAST");
    y = end;
  }

  const safe = `${fileName.replace(/[^a-zA-Z0-9-_]+/g, "-")}.pdf`;
  const blob = pdf.output("blob") as Blob;
  await shareOrDownloadPdf(blob, safe);
}

async function shareOrDownloadPdf(blob: Blob, safe: string) {
  const file = new File([blob], safe, { type: "application/pdf" });

  const nav = navigator as Navigator & {
    canShare?: (data: { files?: File[] }) => boolean;
    share?: (data: { files?: File[]; title?: string }) => Promise<void>;
  };
  const mobile = /Android|iPhone|iPad/i.test(navigator.userAgent);
  if (mobile && nav.canShare?.({ files: [file] }) && nav.share) {
    try {
      await nav.share({ files: [file], title: safe });
      return;
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return;
    }
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = safe;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
