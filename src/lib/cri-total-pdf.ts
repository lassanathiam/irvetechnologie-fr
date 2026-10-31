import { jsPDF } from "jspdf";
import { QUESTIONS_CRI, PHOTOS_CRI } from "./cri-total";

type Rdv = { client_nom: string; adresse: string; cp_ville: string | null; reseau_client?: string | null };
type Photo = { categorie: string; url: string };

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
    return { data: c.toDataURL("image/jpeg", 0.8), w: img.naturalWidth, h: img.naturalHeight };
  } catch { return null; }
}

/** Génère le compte-rendu d'intervention au format TotalEnergies (A4, texte + photos). */
export async function genererCriTotalPdf(opts: {
  rdv: Rdv; valeurs: Record<string, string>; photos: Photo[];
  signatureTechnicien: string | null; signatureClient: string | null; dateCloture: string;
}): Promise<Blob> {
  const { rdv, valeurs: v } = opts;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210, M = 12, CW = W - 2 * M;
  let y = M;
  let page = 1;
  const pied = () => { doc.setFontSize(8); doc.setTextColor(120); doc.text(`Page ${page}`, W / 2, 290, { align: "center" }); doc.setTextColor(0); };
  const nouvellePage = () => { pied(); doc.addPage(); page++; y = M; };
  const besoin = (h: number) => { if (y + h > 282) nouvellePage(); };
  const titre = (t: string) => {
    besoin(10); doc.setFillColor(230, 0, 40); doc.rect(M, y, CW, 8, "F");
    doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(11); doc.text(t, M + 2, y + 5.5); doc.setTextColor(0); y += 10;
  };
  const ligne = (label: string, valeur: string, gras = false) => {
    doc.setFontSize(9);
    const l = doc.splitTextToSize(label, CW * 0.6 - 4); const r = doc.splitTextToSize(valeur || "", CW * 0.4 - 4);
    const h = Math.max(l.length, r.length, 1) * 4 + 3; besoin(h);
    doc.setDrawColor(180); doc.rect(M, y, CW * 0.6, h); doc.rect(M + CW * 0.6, y, CW * 0.4, h);
    if (gras) { doc.setFillColor(240, 240, 240); doc.rect(M, y, CW, h, "FD"); }
    doc.setFont("helvetica", "bold"); doc.text(l, M + 2, y + 4.5);
    doc.setFont("helvetica", "normal"); doc.text(r, M + CW * 0.6 + 2, y + 4.5); y += h;
  };

  // Page 1 : en-tête
  doc.setFont("helvetica", "bold"); doc.setFontSize(16); doc.text("Compte-Rendu d'Intervention", W / 2, y + 6, { align: "center" }); y += 14;
  const [cp, ...villeP] = (rdv.cp_ville ?? "").trim().split(/\s+/);
  ligne("Client", rdv.client_nom);
  ligne("Référence client", v.reference_client ?? "");
  ligne("Raison sociale", v.raison_sociale ?? "");
  ligne("Adresse", rdv.adresse);
  ligne("Code postal", /^\d{5}$/.test(cp ?? "") ? cp! : "");
  ligne("Ville", /^\d{5}$/.test(cp ?? "") ? villeP.join(" ") : rdv.cp_ville ?? "");
  y += 4; titre("Résumé de l'intervention");
  ligne("Type d'intervention", "Installation AT HOME");
  ligne("Catégorie d'intervention", "Installation d'une borne de recharge");
  ligne("Date/Heure clôture", opts.dateCloture);
  ligne("Résultat de l'intervention", v.resultat === "NOK" ? "NOK" : "OK");
  ligne("Commentaire du technicien", v.commentaire_technicien ?? "");
  ligne("Commentaires techniques", v.commentaires_techniques ?? "");
  y += 4; besoin(48);
  doc.setFont("helvetica", "bold"); doc.setFontSize(10);
  doc.rect(M, y, CW / 2, 44); doc.rect(M + CW / 2, y, CW / 2, 44);
  doc.text("Signature technicien", M + 2, y + 5); doc.text("Signature client", M + CW / 2 + 2, y + 5);
  doc.setFont("helvetica", "normal"); doc.setFontSize(9);
  doc.text(`NOM – PRÉNOM : ${v.nom_technicien ?? ""}`, M + 2, y + 10); doc.text(`NOM – PRÉNOM : ${v.nom_client ?? rdv.client_nom}`, M + CW / 2 + 2, y + 10);
  if (opts.signatureTechnicien) doc.addImage(opts.signatureTechnicien, "PNG", M + 4, y + 13, 70, 28);
  if (opts.signatureClient) doc.addImage(opts.signatureClient, "PNG", M + CW / 2 + 4, y + 13, 70, 28);
  y += 48;

  // Débrief
  nouvellePage(); titre("Débrief");
  for (const q of QUESTIONS_CRI) {
    if (q.titre) ligne(q.label, "", true); else ligne(q.label, v[q.id] ?? "");
  }

  // Photos : deux par ligne, chacune avec son libellé
  nouvellePage(); titre("Photos");
  for (const slot of PHOTOS_CRI) {
    const liste = opts.photos.filter((p) => p.categorie === slot.categorie);
    const imgs = (await Promise.all(liste.map((p) => versDataUrl(p.url)))).filter(Boolean) as { data: string; w: number; h: number }[];
    if (!imgs.length && !slot.obligatoire) continue;
    besoin(78);
    doc.setFont("helvetica", "bold"); doc.setFontSize(9);
    const l = doc.splitTextToSize(slot.label + (slot.obligatoire ? " (obligatoire)" : ""), CW); doc.text(l, M, y + 4); y += l.length * 4 + 2;
    if (!imgs.length) { doc.setFont("helvetica", "italic"); doc.text("Photo manquante", M, y + 4); y += 8; continue; }
    for (let i = 0; i < imgs.length; i += 2) {
      besoin(70);
      [imgs[i], imgs[i + 1]].forEach((im, k) => {
        if (!im) return;
        const bw = CW / 2 - 3, bh = 65; const r = Math.min(bw / im.w, bh / im.h);
        const w = im.w * r, h = im.h * r; const x = M + k * (CW / 2 + 3) + (bw - w) / 2;
        doc.addImage(im.data, "JPEG", x, y, w, h);
      });
      y += 68;
    }
    y += 3;
  }
  pied();
  return doc.output("blob");
}
