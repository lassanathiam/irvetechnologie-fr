import { jsPDF } from "jspdf";
import { PHOTOS_CRI } from "./cri-total";
import criTotalOriginalUrl from "@/assets/cri-total-original.pdf?url";

/**
 * Génère le compte-rendu d'intervention TotalEnergies en gardant la mise en
 * forme du document officiel : chaque page du PDF original sert de fond, les
 * réponses sont écrites dans la zone de réponse à droite, les photos dans
 * leurs emplacements, les signatures dans leurs cadres. Coordonnées en points
 * (page letter 612 × 792), relevées sur le document original.
 */

type Rdv = { client_nom: string; adresse: string; cp_ville: string | null; reseau_client?: string | null };
type Photo = { categorie: string; url: string };

const PW = 612;
const PH = 792;

/** Zone de réponse du débrief : à droite des intitulés imprimés. */
const REP_X = 300;
const REP_W = 300;
const REP_TEXT_X = 305;

type LigneReponse = { id: string; page: number; y: number; hauteurEffacement?: number; debutEffacement?: number };

/** Questions du débrief → ligne imprimée correspondante (page 0-indexée, y du haut de ligne). */
const LIGNES_REPONSES: LigneReponse[] = [
  // Page 2 (index 1)
  { id: "non_conformite", page: 1, y: 46.9 },
  { id: "type_installation", page: 1, y: 76.2 },
  { id: "commentaire_debrief", page: 1, y: 105.5 },
  { id: "resultat_debrief", page: 1, y: 136.9 },
  { id: "cause_echec", page: 1, y: 168.2 },
  { id: "izi_safety", page: 1, y: 197.6 },
  { id: "support_contacte", page: 1, y: 226.9 },
  { id: "commentaire_support", page: 1, y: 256.2 },
  { id: "config_station", page: 1, y: 314.8 },
  { id: "nb_points", page: 1, y: 344.1 },
  { id: "puissance_souscrite", page: 1, y: 373.5 },
  { id: "puissance_dispo", page: 1, y: 402.8 },
  { id: "puissance_installee", page: 1, y: 432.0 },
  { id: "dispo_inferieure", page: 1, y: 461.3 },
  { id: "smartcharging_mes", page: 1, y: 490.6 },
  { id: "tore_amont", page: 1, y: 519.9 },
  // L'instruction imprimée « A renseigner dans la configuration… » (y=543) doit rester visible.
  { id: "power_subscription", page: 1, y: 578.6, debutEffacement: 553, hauteurEffacement: 37 },
  { id: "smartcharging_ok", page: 1, y: 607.9 },
  { id: "regime_neutre", page: 1, y: 695.7 },
  { id: "tension_phase_terre", page: 1, y: 723.9 },
  // Page 3 (index 2)
  { id: "valeur_terre", page: 2, y: 45.7 },
  { id: "neutre_terre", page: 2, y: 72.8 },
  { id: "reseau_3g", page: 2, y: 127.0 },
  { id: "leds_evc", page: 2, y: 153.9 },
  { id: "evc_heure", page: 2, y: 209.2 },
  { id: "sim_3g", page: 2, y: 238.5 },
  { id: "watchdog", page: 2, y: 267.9 },
  { id: "wifi_frequence", page: 2, y: 326.4 },
  { id: "wifi_signal", page: 2, y: 355.7 },
  { id: "wifi_repeteur", page: 2, y: 385.0 },
  { id: "puissance_borne", page: 2, y: 502.3 },
  { id: "hotspot", page: 2, y: 531.5 },
  { id: "appairage", page: 2, y: 560.8 },
  { id: "date_heure_borne", page: 2, y: 590.1 },
  { id: "show_ocpp", page: 2, y: 619.5 },
  { id: "test_simulateur", page: 2, y: 648.8 },
  { id: "commentaire_pdr", page: 2, y: 678.1 },
  { id: "reserves", page: 2, y: 707.4 },
];

/** Lignes dont la zone de réponse contient un exemple imprimé à effacer, sans réponse à écrire. */
const EFFACEMENTS_SEULS: { page: number; y: number }[] = [
  { page: 1, y: 285.5 }, // « Y-a-t-il d'autres photos avant installation à ajouter ? »
  { page: 2, y: 414.3 }, // ligne « répéteur Wifi » dupliquée dans l'original
  { page: 2, y: 443.7 }, // « Photo Interface borne avec WiFi OK »
];

type EmplacementPhoto = { categorie: string; page: number; haut: number; bas: number; avecLabel?: string };

/** Emplacements photo du document original (zone effacée puis photo centrée). */
const EMPLACEMENTS_PHOTOS: EmplacementPhoto[] = [
  { categorie: "total_avant", page: 3, haut: 392, bas: 609 },
  { categorie: "total_apres", page: 3, haut: 629, bas: 738 },
  { categorie: "total_smartcharging", page: 4, haut: 371, bas: 567 },
  { categorie: "total_terre", page: 4, haut: 587, bas: 738 },
  { categorie: "total_wifi", page: 5, haut: 160, bas: 345 },
  { categorie: "total_numero_serie", page: 5, haut: 377, bas: 555 },
  { categorie: "total_vue_ensemble", page: 5, haut: 599, bas: 738 },
  { categorie: "total_interieur_borne", page: 6, haut: 154, bas: 351 },
  { categorie: "total_tableau_ferme", page: 6, haut: 371, bas: 567 },
  { categorie: "total_tableau_ouvert", page: 6, haut: 587, bas: 738 },
  { categorie: "total_protections", page: 7, haut: 172, bas: 351 },
  { categorie: "total_percements", page: 7, haut: 371, bas: 537 },
  { categorie: "total_tore", page: 7, haut: 610, bas: 738 },
  { categorie: "total_cheminement", page: 8, haut: 156, bas: 348 },
  { categorie: "total_simulateur", page: 8, haut: 380, bas: 564 },
  { categorie: "total_vehicule", page: 8, haut: 596, bas: 738 },
  { categorie: "total_linky", page: 9, haut: 185, bas: 460 },
  { categorie: "total_supplementaire", page: 9, haut: 475, bas: 738, avecLabel: "Photo supplémentaire" },
];

async function versDataUrl(url: string): Promise<{ data: string; w: number; h: number } | null> {
  try {
    const blob = await (await fetch(url)).blob();
    const data = await new Promise<string>((ok, ko) => { const r = new FileReader(); r.onload = () => ok(r.result as string); r.onerror = ko; r.readAsDataURL(blob); });
    const img = new Image();
    await new Promise((ok, ko) => { img.onload = ok; img.onerror = ko; img.src = data; });
    // Repasse en JPEG (formats webp non pris en charge par le PDF).
    const c = document.createElement("canvas");
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext("2d")!.drawImage(img, 0, 0);
    return { data: c.toDataURL("image/jpeg", 0.85), w: img.naturalWidth, h: img.naturalHeight };
  } catch { return null; }
}

type PdfDoc = { numPages: number; getPage: (n: number) => Promise<any> };

async function chargerPdfOriginal(): Promise<PdfDoc> {
  const pdfjs: any = await import("pdfjs-dist");
  const worker: any = await import("pdfjs-dist/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const data = await (await fetch(criTotalOriginalUrl)).arrayBuffer();
  return await pdfjs.getDocument({ data }).promise;
}

async function pageEnImage(pdf: PdfDoc, index: number): Promise<string> {
  const page = await pdf.getPage(index + 1);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: 1600 / base.width });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext("2d")!, viewport, canvas }).promise;
  return canvas.toDataURL("image/jpeg", 0.92);
}

/** Génère le compte-rendu d'intervention sur le document officiel TotalEnergies. */
export async function genererCriTotalPdf(opts: {
  rdv: Rdv; valeurs: Record<string, string>; photos: Photo[];
  signatureTechnicien: string | null; signatureClient: string | null; dateCloture: string;
}): Promise<Blob> {
  const { rdv, valeurs: v } = opts;
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pdf = await chargerPdfOriginal();

  const effacer = (x: number, y: number, w: number, h: number) => {
    doc.setFillColor(255, 255, 255);
    doc.rect(x, y, w, h, "F");
  };
  const ecrire = (texte: string, x: number, yBaseline: number, largeur: number, taille = 9, gras = false) => {
    doc.setFont("helvetica", gras ? "bold" : "normal");
    doc.setFontSize(taille);
    doc.setTextColor(20, 20, 20);
    const lignes = doc.splitTextToSize(texte, largeur).slice(0, 2);
    doc.text(lignes, x, yBaseline, { lineHeightFactor: 1.25 });
  };

  // Précharge les photos par catégorie.
  const photosParCategorie = new Map<string, { data: string; w: number; h: number }>();
  await Promise.all(
    PHOTOS_CRI.map(async (slot) => {
      const p = opts.photos.find((ph) => ph.categorie === slot.categorie);
      if (!p) return;
      const img = await versDataUrl(p.url);
      if (img) photosParCategorie.set(slot.categorie, img);
    }),
  );

  const [cp, ...villeP] = (rdv.cp_ville ?? "").trim().split(/\s+/);
  const codePostal = /^\d{5}$/.test(cp ?? "") ? cp! : "";
  const ville = codePostal ? villeP.join(" ") : (rdv.cp_ville ?? "");

  for (let index = 0; index < pdf.numPages; index++) {
    if (index > 0) doc.addPage("letter", "portrait");
    const fond = await pageEnImage(pdf, index);
    doc.addImage(fond, "JPEG", 0, 0, PW, PH);

    if (index === 0) {
      // Page 1 : informations client, résumé et signatures.
      effacer(40, 116, 560, 22); ecrire(rdv.client_nom, 42, 131, 556, 10, true);
      effacer(80, 153, 218, 22); ecrire(v.reference_client ?? "", 82, 167, 214);
      effacer(358, 153, 242, 22); ecrire(v.raison_sociale ?? "", 360, 167, 238);
      effacer(48, 189, 552, 22); ecrire(rdv.adresse, 50, 203, 548);
      effacer(62, 226, 236, 22); ecrire(codePostal, 64, 240, 232);
      effacer(322, 226, 278, 22); ecrire(ville, 324, 240, 274);
      effacer(100, 356, 500, 22); ecrire(opts.dateCloture, 102, 370, 496);
      effacer(228, 391, 372, 24); ecrire(v.resultat === "NOK" ? "NOK" : "OK", 232, 408, 360, 14, true);
      effacer(128, 418, 472, 46); ecrire(v.commentaire_technicien ?? "", 130, 431, 468);
      effacer(123, 461, 477, 52); ecrire(v.commentaires_techniques ?? "", 125, 474, 473);
      effacer(98, 539, 200, 20); ecrire(v.nom_technicien ?? "", 100, 553, 196);
      effacer(386, 535, 214, 20); ecrire(v.nom_client ?? rdv.client_nom, 388, 549, 210);
      if (opts.signatureTechnicien) {
        effacer(14, 560, 281, 120);
        doc.addImage(opts.signatureTechnicien, "PNG", 24, 566, 261, 108);
      }
      if (opts.signatureClient) {
        effacer(305, 556, 293, 120);
        doc.addImage(opts.signatureClient, "PNG", 315, 562, 273, 108);
      }
    }

    // Réponses du débrief dans la zone prévue à droite des intitulés.
    for (const l of LIGNES_REPONSES.filter((r) => r.page === index)) {
      const haut = l.debutEffacement ?? l.y - 13;
      const hauteur = l.hauteurEffacement ?? 26;
      effacer(REP_X, haut, REP_W, hauteur);
      const valeur = v[l.id] ?? "";
      if (valeur) ecrire(valeur, REP_TEXT_X, l.y + 7.5, REP_W - 10);
    }
    for (const e of EFFACEMENTS_SEULS.filter((r) => r.page === index)) {
      effacer(REP_X, e.y - 13, REP_W, 26);
    }

    // Photos dans leurs emplacements du document.
    for (const emp of EMPLACEMENTS_PHOTOS.filter((r) => r.page === index)) {
      effacer(14, emp.haut, PW - 28, emp.bas - emp.haut);
      let haut = emp.haut;
      if (emp.avecLabel) {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.setTextColor(20, 20, 20);
        doc.text(emp.avecLabel, 14, emp.haut + 12);
        haut = emp.haut + 20;
      }
      const img = photosParCategorie.get(emp.categorie);
      if (!img) {
        doc.setFont("helvetica", "italic");
        doc.setFontSize(10);
        doc.setTextColor(130, 130, 130);
        doc.text("Photo non fournie", PW / 2, (haut + emp.bas) / 2, { align: "center" });
        continue;
      }
      const largeurMax = PW - 28 - 8;
      const hauteurMax = emp.bas - haut - 8;
      const ratio = Math.min(largeurMax / img.w, hauteurMax / img.h);
      const w = img.w * ratio;
      const h = img.h * ratio;
      doc.addImage(img.data, "JPEG", 14 + (PW - 28 - w) / 2, haut + (hauteurMax - h) / 2, w, h);
    }
  }

  return doc.output("blob");
}
