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
 * Assemblage direct des pages du PV original, sans capture d'écran :
 * la feuille rendue (pixels du PDF ou de l'image importée) est recopiée en
 * entier, puis chaque réponse et chaque signature est redessinée à sa place
 * mesurée. Aucune partie ne peut être rognée, quelle que soit la taille de
 * l'écran ou le défilement, et chaque page tient centrée sur une feuille A4.
 */
async function capturerPagesOriginal(pages: HTMLElement[]): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  for (const [index, page] of pages.entries()) {
    const image = await composerPage(page);
    const ratio = image.height / image.width;
    if (index > 0) pdf.addPage();
    let w = pageW, h = pageW * ratio;
    if (h > pageH) { h = pageH; w = pageH / ratio; }
    pdf.addImage(image.toDataURL("image/jpeg", 0.95), "JPEG", (pageW - w) / 2, (pageH - h) / 2, w, h);
  }
  return pdf.output("blob");
}

async function composerPage(page: HTMLElement): Promise<HTMLCanvasElement> {
  const zone = page.getBoundingClientRect();
  const canvasSource = page.querySelector<HTMLCanvasElement>(":scope > canvas");
  const imgSource = canvasSource ? null : page.querySelector<HTMLImageElement>(":scope > img");
  const sw = canvasSource?.width || imgSource?.naturalWidth || 1600;
  const sh = canvasSource?.height || imgSource?.naturalHeight || Math.round(1600 * 1.414);
  const largeurCss = zone.width || 760;
  // La hauteur suit les proportions de la feuille originale, pas celle de l'écran.
  const hauteurCss = largeurCss * (sh / sw);
  const k = Math.max(2, 1600 / largeurCss);
  const out = document.createElement("canvas");
  out.width = Math.round(largeurCss * k);
  out.height = Math.round(hauteurCss * k);
  const ctx = out.getContext("2d");
  if (!ctx) throw new Error("Préparation du PDF impossible sur cet appareil.");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, out.width, out.height);
  if (canvasSource) ctx.drawImage(canvasSource, 0, 0, out.width, out.height);
  else if (imgSource) ctx.drawImage(imgSource, 0, 0, out.width, out.height);
  const sy = hauteurCss / (zone.height || hauteurCss);

  // Signatures (images contenues dans leur zone, proportions conservées).
  for (const img of Array.from(page.querySelectorAll<HTMLImageElement>("img"))) {
    if (img === imgSource || !img.naturalWidth) continue;
    const r = img.getBoundingClientRect();
    const scale = Math.min(r.width / img.naturalWidth, r.height / img.naturalHeight);
    const w = img.naturalWidth * scale, h = img.naturalHeight * scale;
    const x = r.left - zone.left + (r.width - w) / 2;
    const y = (r.top - zone.top) * sy + (r.height - h) / 2;
    try { ctx.drawImage(img, x * k, y * k, w * k, h * k); } catch { /* image inaccessible */ }
  }

  // Réponses : chaque ligne de texte est redessinée à sa position mesurée.
  const marcheur = document.createTreeWalker(page, NodeFilter.SHOW_TEXT);
  for (let noeud = marcheur.nextNode(); noeud; noeud = marcheur.nextNode()) {
    const texte = noeud.textContent ?? "";
    if (!texte.trim()) continue;
    const parent = noeud.parentElement;
    if (!parent) continue;
    const st = getComputedStyle(parent);
    if (st.visibility === "hidden" || st.display === "none") continue;
    const taille = parseFloat(st.fontSize) || 13;
    ctx.font = `${st.fontStyle} ${st.fontWeight} ${taille * k}px ${st.fontFamily}`;
    ctx.fillStyle = st.color || "#000000";
    ctx.textBaseline = "middle";
    const range = document.createRange();
    let ligne = "";
    let gauche = 0, haut = 0, bas = 0;
    const dessiner = () => {
      if (!ligne.trim()) return;
      const y = ((haut + bas) / 2 - zone.top) * sy;
      ctx.fillText(ligne, (gauche - zone.left) * k, y * k);
    };
    for (let i = 0; i < texte.length; i++) {
      range.setStart(noeud, i);
      range.setEnd(noeud, i + 1);
      const r = range.getBoundingClientRect();
      if (!r.width && !r.height) { ligne += texte[i]; continue; }
      if (!ligne || Math.abs(r.top - haut) > taille * 0.5) {
        dessiner();
        ligne = texte[i] === " " ? "" : texte[i];
        gauche = r.left; haut = r.top; bas = r.bottom;
        if (texte[i] === " ") gauche = r.right;
      } else {
        ligne += texte[i];
      }
    }
    dessiner();
  }
  return out;
}
