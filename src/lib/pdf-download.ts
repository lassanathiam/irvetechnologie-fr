/** Génère un PDF téléchargeable à partir d'un élément de la page (fonctionne sur mobile / PWA). */
export async function downloadElementAsPdf(element: HTMLElement, fileName: string) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"),
    import("jspdf"),
  ]);

  const canvas = await html2canvas(element, {
    scale: Math.min(2, window.devicePixelRatio || 1.5),
    backgroundColor: "#ffffff",
    useCORS: true,
    logging: false,
  });

  const pdf = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgH = (canvas.height * pageW) / canvas.width;

  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  let remaining = imgH;
  let offset = 0;
  while (remaining > 0.5) {
    pdf.addImage(dataUrl, "JPEG", 0, -offset, pageW, imgH, undefined, "FAST");
    remaining -= pageH;
    offset += pageH;
    if (remaining > 0.5) pdf.addPage();
  }

  const safe = `${fileName.replace(/[^a-zA-Z0-9-_]+/g, "-")}.pdf`;
  const blob = pdf.output("blob") as Blob;
  const file = new File([blob], safe, { type: "application/pdf" });

  // Mobile / PWA : le partage natif permet d'enregistrer réellement le fichier dans le téléphone.
  const nav = navigator as Navigator & {
    canShare?: (data: { files?: File[] }) => boolean;
    share?: (data: { files?: File[]; title?: string }) => Promise<void>;
  };
  if (nav.canShare?.({ files: [file] }) && nav.share) {
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
  a.target = "_blank";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
