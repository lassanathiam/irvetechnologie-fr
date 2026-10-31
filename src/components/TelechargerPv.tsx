import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RapportDonneurDoc } from "@/components/RapportDonneurDoc";
import { RapportOriginalDoc } from "@/components/RapportOriginalDoc";
import { downloadElementAsPdf, shareOrDownloadPdf } from "@/lib/pdf-download";
import type { ModeleStructure } from "@/lib/rapport-modeles";

type Valeurs = Record<string, string | boolean | null>;

/**
 * Téléchargement du PV (PDF) quel que soit l'état des signatures : 0, 1 ou 2.
 * Le document est tenu hors écran, prêt à être capturé à chaque clic.
 */
export function TelechargerPv({
  structure,
  valeurs,
  signatureClient,
  signatureTechnicien,
  signataireNom,
  technicien,
  signedAt,
  logo,
  donneur,
  nom,
  label = "Télécharger le PV",
  variant = "outline",
  className,
}: {
  structure: ModeleStructure;
  valeurs: Valeurs;
  signatureClient?: string | null;
  signatureTechnicien?: string | null;
  signataireNom?: string | null;
  technicien?: string | null;
  signedAt?: string | null;
  logo?: string | null;
  donneur: string;
  nom: string;
  label?: string;
  variant?: "outline" | "default" | "secondary" | "ghost";
  className?: string;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);
  const [monte, setMonte] = useState(false);
  useEffect(() => setMonte(true), []);

  async function download() {
    const racine = stage.current;
    if (!racine || busy) return;
    setBusy(true);
    try {
      await attendreRendu(racine);
      // Hors écran (left négatif), la capture rogne le PV : on le place
      // le temps de la capture à l'origine de la fenêtre, derrière l'appli.
      Object.assign(racine.style, { position: "fixed", left: "0px", top: "0px", zIndex: "-1" });
      window.scrollTo(0, 0);
      await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      const pages = Array.from(racine.querySelectorAll<HTMLElement>("[data-report-page]"));
      if (pages.length) {
        const blob = await capturerPagesOriginal(pages);
        await shareOrDownloadPdf(blob, `${nomFichier(nom)}.pdf`);
      } else {
        const doc = racine.firstElementChild as HTMLElement | null;
        if (!doc) throw new Error("Document indisponible.");
        await downloadElementAsPdf(doc, nom);
      }
      toast.success("PV téléchargé.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Téléchargement impossible. Réessayez.");
    } finally {
      Object.assign(racine.style, { position: "", left: "", top: "", zIndex: "" });
      setBusy(false);
    }
  }

  return (
    <>
      <Button type="button" variant={variant} className={className} disabled={busy} onClick={(e) => { e.preventDefault(); e.stopPropagation(); void download(); }}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {busy ? "Préparation du PDF…" : label}
      </Button>
      {monte && createPortal(<div ref={stage} className="rapport-export-stage" aria-hidden="true">
        {structure.original ? (
          <RapportOriginalDoc structure={structure} valeurs={valeurs} signatureClient={signatureClient} signatureTechnicien={signatureTechnicien} />
        ) : (
          <RapportDonneurDoc
            structure={structure}
            logo={logo}
            donneur={donneur}
            valeurs={valeurs}
            signatureClient={signatureClient}
            signatureTechnicien={signatureTechnicien}
            signataireNom={signataireNom}
            technicien={technicien}
            signedAt={signedAt}
          />
        )}
      </div>, document.body)}
    </>
  );
}

function nomFichier(nom: string) {
  return nom.replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/^-+|-+$/g, "") || "PV";
}

/** Patient que les pages du document original soient réellement dessinées. */
async function attendreRendu(racine: HTMLElement) {
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  await document.fonts.ready;
  const limite = Date.now() + 20_000;
  for (;;) {
    const pages = racine.querySelectorAll("[data-report-page]");
    const canvases = Array.from(racine.querySelectorAll<HTMLCanvasElement>("canvas"));
    const pret = pages.length > 0 && canvases.every((c) => c.dataset.rendu === "1");
    if (pret || Date.now() > limite) break;
    await new Promise<void>((resolve) => setTimeout(resolve, 200));
  }
  await Promise.all(
    Array.from(racine.querySelectorAll("img")).map((img) => img.decode().catch(() => undefined)),
  );
}

/**
 * Capture fidèle des pages du PV original : dimensions en pixels fixées
 * (sans aspect-ratio, mal géré par la capture) et une page A4 pleine par feuille.
 */
async function capturerPagesOriginal(pages: HTMLElement[]): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  for (const [index, page] of pages.entries()) {
    const source = page.querySelector("canvas");
    const ratio = source && source.width ? source.height / source.width : 1.414;
    const width = 760;
    const height = Math.round(width * ratio);
    const ancien = { w: page.style.width, h: page.style.height, a: page.style.aspectRatio };
    page.style.width = `${width}px`;
    page.style.height = `${height}px`;
    page.style.aspectRatio = "auto";
    try {
      const image = await html2canvas(page, {
        scale: 2, useCORS: true, logging: false, backgroundColor: "#ffffff",
        width, height, windowWidth: 1280, windowHeight: Math.max(height, 1200),
        scrollX: 0, scrollY: 0,
        onclone: (_doc, clone) => {
          clone.style.width = `${width}px`;
          clone.style.height = `${height}px`;
          clone.style.aspectRatio = "auto";
          const c = clone.querySelector("canvas");
          if (c && source) c.getContext("2d")?.drawImage(source, 0, 0);
        },
      });
      if (index > 0) pdf.addPage();
      let w = pageW, h = pageW * ratio;
      if (h > pageH) { h = pageH; w = pageH / ratio; }
      pdf.addImage(image.toDataURL("image/jpeg", 0.95), "JPEG", (pageW - w) / 2, (pageH - h) / 2, w, h);
    } finally {
      page.style.width = ancien.w;
      page.style.height = ancien.h;
      page.style.aspectRatio = ancien.a;
    }
  }
  return pdf.output("blob");
}
