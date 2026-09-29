import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { Role, Signataire, Zone } from "./documents";

export type Valeurs = { signature: string; paraphe?: string | null; nom: string };

function dataUrlBytes(d: string): { bytes: Uint8Array; png: boolean } {
  const m = d.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
  if (!m) throw new Error("Signature invalide.");
  return { bytes: Uint8Array.from(Buffer.from(m[2]!, "base64")), png: m[1] === "png" };
}

/** Incruste dans le PDF les zones du rôle donné (et du signataire `cle` si précisé). */
export async function appliquerSignatures(pdf: Uint8Array, zones: Zone[], role: Role, v: Valeurs, quand: Date, cle?: string | null) {
  const doc = await PDFDocument.load(pdf, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const sig = dataUrlBytes(v.signature);
  const sigImg = sig.png ? await doc.embedPng(sig.bytes) : await doc.embedJpg(sig.bytes);
  let parImg = sigImg;
  if (v.paraphe) {
    const p = dataUrlBytes(v.paraphe);
    parImg = p.png ? await doc.embedPng(p.bytes) : await doc.embedJpg(p.bytes);
  }
  const pages = doc.getPages();
  const dateTxt = quand.toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" });
  for (const z of zones.filter((z) => z.role === role && (role === "irve" || !cle || z.signataire === cle))) {
    const page = pages[z.page];
    if (!page) continue;
    const { width: W, height: H } = page.getSize();
    const x = z.x * W;
    const w = z.w * W;
    const h = z.h * H;
    const y = H - z.y * H - h;
    if (z.type === "signature" || z.type === "paraphe") {
      const img = z.type === "signature" ? sigImg : parImg;
      const r = Math.min(w / img.width, h / img.height);
      const iw = img.width * r;
      const ih = img.height * r;
      page.drawImage(img, { x: x + (w - iw) / 2, y: y + (h - ih) / 2, width: iw, height: ih });
    } else {
      const txt = z.type === "nom" ? v.nom : z.type === "date" ? dateTxt : "Lu et approuvé";
      const size = Math.max(7, Math.min(12, h * 0.7));
      page.drawText(txt, { x: x + 2, y: y + (h - size) / 2 + 1, size, font, color: rgb(0.05, 0.1, 0.25) });
    }
  }
  return await doc.save();
}

/** Ajoute la page de preuve de signature. */
export async function ajouterPreuve(pdf: Uint8Array, nomDoc: string, signataires: Signataire[], empreinteOriginal: string) {
  const doc = await PDFDocument.load(pdf, { ignoreEncryption: true });
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595, 842]);
  let y = 780;
  const line = (t: string, f = font, s = 11) => {
    page.drawText(t.slice(0, 95), { x: 50, y, size: s, font: f, color: rgb(0.1, 0.1, 0.15) });
    y -= s + 8;
  };
  line("Certificat de signature électronique", bold, 16);
  y -= 6;
  line(`Document : ${nomDoc}`);
  line(`Empreinte SHA-256 du document d'origine :`);
  line(empreinteOriginal, font, 8);
  y -= 10;
  for (const s of signataires) {
    line(`${s.role === "irve" ? "IRVE Technologie" : "Signataire"} — ${s.nom}`, bold, 12);
    if (s.email) line(`Email : ${s.email}`);
    if (s.signed_at)
      line(`Signé le ${new Date(s.signed_at).toLocaleString("fr-FR", { timeZone: "Europe/Paris" })} (heure de Paris)`);
    if (s.ip) line(`Adresse IP : ${s.ip}`);
    y -= 6;
  }
  y -= 10;
  line("Signature électronique simple (règlement eIDAS, art. 25) réalisée via la plateforme", font, 9);
  line("IRVE Technologie — Borne de l'Ouest. Qualifications IRVE P1/P2/P3.", font, 9);
  return await doc.save();
}

export async function sha256(bytes: Uint8Array) {
  const h = await crypto.subtle.digest("SHA-256", new Uint8Array(bytes));
  return Array.from(new Uint8Array(h))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
