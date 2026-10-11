import { useEffect, useRef } from "react";

/** Copie lisible des pixels de la feuille originale (PDF rendu ou image importée). */
const cacheImages = new WeakMap<HTMLImageElement, HTMLCanvasElement>();
function sourcePixels(feuille: Element): HTMLCanvasElement | null {
  const canvas = feuille.querySelector("canvas");
  if (canvas && canvas.dataset.rendu === "1") return canvas;
  const img = feuille.querySelector("img");
  if (img && img.complete && img.naturalWidth) {
    let c = cacheImages.get(img);
    if (!c) {
      c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      try {
        c.getContext("2d")?.drawImage(img, 0, 0);
      } catch {
        return null;
      }
      cacheImages.set(img, c);
    }
    return c;
  }
  return null;
}

/**
 * Repère les lignes imprimées (soulignés « ____ ») sous la zone d'un champ.
 * Retourne leur position verticale en px CSS, relative au haut de la zone.
 */
export function lignesImprimees(zone: HTMLElement): number[] {
  const feuille = zone.closest("[data-report-page]");
  if (!feuille) return [];
  const source = sourcePixels(feuille);
  if (!source) return [];
  const page = feuille.getBoundingClientRect();
  const r = zone.getBoundingClientRect();
  if (!page.width || !r.width) return [];
  const sx = source.width / page.width;
  const sy = source.height / page.height;
  const x0 = Math.max(0, Math.floor((r.left - page.left) * sx));
  const x1 = Math.min(source.width, Math.ceil((r.right - page.left) * sx));
  const yDebut = Math.max(0, Math.floor((r.top - page.top - r.height * 0.15) * sy));
  const yFin = Math.min(source.height, Math.ceil((r.bottom - page.top + r.height * 0.6) * sy));
  const w = x1 - x0;
  const h = yFin - yDebut;
  if (w < 4 || h < 2) return [];
  let data: Uint8ClampedArray;
  try {
    data = source.getContext("2d", { willReadFrequently: true })!.getImageData(x0, yDebut, w, h).data;
  } catch {
    return [];
  }
  const lignes: number[] = [];
  let dansLigne = false;
  for (let y = 0; y < h; y++) {
    let sombres = 0;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const lum = data[i] * 0.3 + data[i + 1] * 0.59 + data[i + 2] * 0.11;
      if (data[i + 3] > 100 && lum < 220) sombres++;
    }
    const estLigne = sombres >= w * 0.5;
    if (estLigne && !dansLigne) lignes.push((yDebut + y) / sy - (r.top - page.top));
    dansLigne = estLigne;
  }
  return lignes;
}

/**
 * Pose la valeur sur sa ligne imprimée, juste au-dessus du souligné,
 * à l'échelle de la feuille (indépendant de la largeur de l'écran).
 */
export function RapportTexteCalibre({ valeur, multiligne = false }: { valeur: string; multiligne?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const span = ref.current;
    const zone = span?.parentElement;
    if (!span || !zone) return;
    const ajuster = () => {
      const feuille = zone.closest("[data-report-page]");
      const largeur = feuille?.getBoundingClientRect().width ?? 794;
      const base = Math.min(13, (largeur * 13) / 794);
      const hauteur = zone.clientHeight;
      const trouvees = valeur ? lignesImprimees(zone) : [];
      // Ligne simple : le souligné est dans la moitié basse de la zone ou juste dessous
      // (un souligné au-dessus appartient au champ précédent).
      const lignes = multiligne ? trouvees.filter((y) => y >= -1) : trouvees.filter((y) => y >= hauteur * 0.3).slice(0, 1);
      span.dataset.lignes = trouvees.map((y) => Math.round(y)).join(",") + "|" + Math.round(hauteur);
      const s = span.style;
      s.position = "";
      s.top = "";
      s.bottom = "";
      s.left = "";
      s.lineHeight = "";
      let taille = base;
      s.fontSize = `${taille}px`;

      if (!multiligne && lignes.length) {
        // Le bas du texte s'arrête 1 px au-dessus du premier souligné.
        const ligne = lignes[0];
        s.position = "absolute";
        s.left = "0";
        s.lineHeight = "1";
        s.bottom = `${hauteur - ligne + Math.max(1, taille * 0.18)}px`;
        while (taille > 4 && span.scrollWidth > zone.clientWidth) {
          taille -= 0.25;
          s.fontSize = `${taille}px`;
          s.bottom = `${hauteur - ligne + Math.max(1, taille * 0.18)}px`;
        }
        return;
      }

      if (multiligne && lignes.length) {
        // Interligne = écart entre les soulignés imprimés ; chaque ligne de texte se pose sur le sien.
        const ecart = lignes.length > 1 ? (lignes[lignes.length - 1] - lignes[0]) / (lignes.length - 1) : Math.max(taille * 1.6, hauteur / 3);
        const placer = () => {
          s.position = "absolute";
          s.left = "0";
          s.lineHeight = `${ecart}px`;
          // bas de la 1re ligne de texte = premier souligné (texte calé en bas de son interligne)
          s.top = `${lignes[0] - ecart + (ecart - taille) / 2 - taille * 0.15}px`;
        };
        placer();
        const max = Math.max(lignes.length, 1);
        while (taille > 4 && (span.scrollWidth > zone.clientWidth || Math.round(span.scrollHeight / ecart) > max)) {
          taille -= 0.25;
          s.fontSize = `${taille}px`;
          placer();
        }
        return;
      }

      // Aucun souligné détecté : on ajuste simplement à la zone.
      while (taille > 3 && (span.scrollWidth > zone.clientWidth || span.scrollHeight > hauteur)) {
        taille -= 0.25;
        s.fontSize = `${taille}px`;
      }
    };
    ajuster();
    const observer = new ResizeObserver(ajuster);
    observer.observe(zone);
    const feuille = zone.closest("[data-report-page]");
    const canvas = feuille?.querySelector("canvas");
    const img = feuille?.querySelector("img");
    canvas?.addEventListener("rendu", ajuster);
    img?.addEventListener("load", ajuster);
    return () => {
      observer.disconnect();
      canvas?.removeEventListener("rendu", ajuster);
      img?.removeEventListener("load", ajuster);
    };
  }, [valeur, multiligne]);
  return (
    <span
      ref={ref}
      className={`block w-full ${multiligne ? "whitespace-pre-wrap break-words leading-loose" : "whitespace-nowrap leading-snug"}`}
    >
      {valeur}
    </span>
  );
}
