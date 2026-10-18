import { dimensionsPageAttachement } from "./pdf-attachements-layout";

export async function creerPdfAttachements(elements: HTMLElement[]): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import("html2canvas-pro"), import("jspdf"),
  ]);
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  for (const [index, element] of elements.entries()) {
    const canvas = await html2canvas(element, {
      scale: 2, useCORS: true, logging: false, windowWidth: 1280,
      onclone: (_doc, clone) => {
        clone.classList.add("pdf-render");
        clone.style.width = "760px";
        clone.style.maxWidth = "760px";
        clone.style.height = "auto";
      },
    });
    if (index > 0) pdf.addPage();
    const page = dimensionsPageAttachement(canvas.width, canvas.height);
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.95), "JPEG", page.x, page.y, page.width, page.height);
  }
  return pdf.output("blob");
}

export function enregistrerPdfAttachements(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}