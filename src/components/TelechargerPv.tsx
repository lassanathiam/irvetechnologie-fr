import { useRef, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { RapportDonneurDoc } from "@/components/RapportDonneurDoc";
import { RapportOriginalDoc } from "@/components/RapportOriginalDoc";
import { downloadElementAsPdf, shareOrDownloadPdf } from "@/lib/pdf-download";
import { creerPdfAttachements } from "@/lib/pdf-attachements";
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

  async function download() {
    const racine = stage.current;
    if (!racine || busy) return;
    setBusy(true);
    try {
      await attendreRendu(racine);
      const pages = Array.from(racine.querySelectorAll<HTMLElement>("[data-report-page]"));
      if (pages.length) {
        const blob = await creerPdfAttachements(pages);
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
      setBusy(false);
    }
  }

  return (
    <>
      <Button type="button" variant={variant} className={className} disabled={busy} onClick={(e) => { e.preventDefault(); e.stopPropagation(); void download(); }}>
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {busy ? "Préparation du PDF…" : label}
      </Button>
      <div ref={stage} className="rapport-export-stage" aria-hidden="true">
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
      </div>
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
