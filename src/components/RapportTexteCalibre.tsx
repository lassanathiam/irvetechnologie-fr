import { useEffect, useRef } from "react";

/** Ajuste la valeur à sa zone sur la feuille, indépendamment de la largeur de l'écran. */
export function RapportTexteCalibre({ valeur, multiligne = false }: { valeur: string; multiligne?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const span = ref.current;
    const zone = span?.parentElement;
    if (!span || !zone) return;
    const ajuster = () => {
      const feuille = zone.closest("[data-report-page]");
      const largeur = feuille?.getBoundingClientRect().width ?? 794;
      let taille = Math.min(13, largeur * 13 / 794);
      span.style.fontSize = `${taille}px`;
      while (taille > 3 && (span.scrollWidth > zone.clientWidth || span.scrollHeight > zone.clientHeight)) {
        taille -= 0.25;
        span.style.fontSize = `${taille}px`;
      }
    };
    ajuster();
    const observer = new ResizeObserver(ajuster);
    observer.observe(zone);
    return () => observer.disconnect();
  }, [valeur, multiligne]);
  return <span ref={ref} className={`block w-full ${multiligne ? "whitespace-pre-wrap break-words leading-loose" : "whitespace-nowrap leading-snug"}`}>{valeur}</span>;
}