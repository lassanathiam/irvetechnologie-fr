import { PDFDocument, StandardFonts } from "pdf-lib";
import type { DocHeader, DocLine } from "@/components/DocumentPrint";
import { COMPANY, dateFr, euro } from "./company";
import { computeTotals, MENTIONS_FACTURE } from "./billing";
import { formatQuantite } from "./unites";

/**
 * Remplace les séquences mojibake fréquentes et retire tout caractère que la
 * police WinAnsi ne sait pas encoder : la génération du PDF ne doit jamais
 * échouer à cause d'un caractère issu d'un import.
 */
const MOJIBAKE: [RegExp, string][] = [
  [/√©/g, "é"], [/√®/g, "è"], [/√†/g, "à"], [/√¢/g, "â"], [/√ß/g, "ç"],
  [/√π/g, "ê"], [/√¥/g, "ô"], [/√Æ/g, "î"], [/√Ø/g, "ï"], [/√ª/g, "û"],
  [/√´/g, "ë"], [/√º/g, "ü"], [/√â/g, "É"], [/√à/g, "À"],
  [/‚Ç¬/g, "€"], [/‚Äô/g, "’"], [/‚Äò/g, "‘"], [/‚Äú|‚Äù/g, "\u201d"],
  [/‚Äì/g, "–"], [/‚Äî/g, "—"], [/‚Ä¶/g, "…"], [/¬∑/g, "·"],
];

/** Caractères CP1252 (0x80–0x9F) encodables par WinAnsi, hors Latin-1. */
const WINANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");

export function nettoyer(value: string): string {
  let out = String(value ?? "");
  for (const [pattern, remplacement] of MOJIBAKE) out = out.replace(pattern, remplacement);
  out = out.normalize("NFC").replace(/[  ]/g, " ").replace(/[‑−]/g, "-");
  let resultat = "";
  for (const char of out) {
    const code = char.codePointAt(0)!;
    if (char === "\n" || char === "\r" || (code >= 0x20 && code <= 0x7e) || (code >= 0xa0 && code <= 0xff) || WINANSI_EXTRA.has(char)) {
      resultat += char;
    } else {
      resultat += char.normalize("NFKD").replace(/[^\x20-\x7e]/g, "");
    }
  }
  return resultat;
}

/** PDF contenant du texte natif sélectionnable, sans capture d'écran. */
export async function creerFacturePdf(doc: DocHeader, items: DocLine[]) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Facture ${doc.numero} — ${COMPANY.raisonSociale}`);
  pdf.setAuthor(COMPANY.raisonSociale);
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  let page = pdf.addPage([595.28, 841.89]);
  let y = 803;
  const ensure = (height: number) => {
    if (y - height >= 42) return;
    page = pdf.addPage([595.28, 841.89]); y = 803;
    page.drawText(`Facture ${doc.numero} — suite`, { x: 36, y, size: 10, font: bold }); y -= 24;
  };
  const text = (value: string, size = 10, strong = false) => {
    const font = strong ? bold : normal;
    const cleaned = nettoyer(value);
    for (const paragraph of cleaned.split(/\r?\n/)) {
      const lines: string[] = []; let line = "";
      for (const word of paragraph.split(/\s+/)) {
        const candidate = line ? `${line} ${word}` : word;
        if (font.widthOfTextAtSize(candidate, size) <= 523) { line = candidate; continue; }
        if (line) { lines.push(line); line = ""; }
        for (const char of word) {
          if (font.widthOfTextAtSize(line + char, size) > 523 && line) { lines.push(line); line = ""; }
          line += char;
        }
      }
      lines.push(line);
      for (const value of lines) { ensure(size * 1.4); page.drawText(value, { x: 36, y, size, font }); y -= size * 1.4; }
    }
  };
  const rule = () => { ensure(25); page.drawLine({ start: { x: 36, y: y - 3 }, end: { x: 559, y: y - 3 }, thickness: 0.5 }); y -= 25; };
  text(COMPANY.raisonSociale, 20, true);
  text("Borne de l'Ouest", 12, true);
  text(COMPANY.qualifications, 10, true);
  text(`${COMPANY.adresse} — ${COMPANY.cpVille}`, 9);
  text(`${COMPANY.email} · ${COMPANY.telephone} · ${COMPANY.telephone2}`, 9);
  text(`SIRET ${COMPANY.siret} · TVA ${COMPANY.tva} · ${COMPANY.site}`, 9);
  rule(); text(`FACTURE ${doc.numero}`, 17, true);
  text(`Date : ${dateFr(doc.date_emission)}    Échéance : ${dateFr(doc.date_limite)}`);
  y -= 8; text("Facturé à", 10, true); text(doc.client_nom, 12, true);
  for (const value of [doc.client_adresse, doc.client_cp_ville, doc.client_email, doc.client_telephone]) if (value) text(value);
  y -= 8; text(`Objet : ${doc.objet || "Installation de borne de recharge"}`, 11, true);
  for (const [label, value] of [["Bon de commande", doc.bon_commande], ["Ticket", doc.numero_ticket], ["Affaire", doc.numero_affaire]]) if (value) text(`${label} : ${value}`);
  rule();
  for (const [index, line] of items.entries()) {
    ensure(60); text(`${index + 1}. ${line.libelle}`, 11, true);
    if (line.description) text(line.description, 9);
    text(`Qté : ${formatQuantite(Number(line.quantite), line.unite)}    PU HT : ${euro(Number(line.prix_unitaire))}    TVA : ${Number(line.tva)} %    Total HT : ${euro(Number(line.quantite) * Number(line.prix_unitaire))}`, 9);
    rule();
  }
  const totals = computeTotals(items.map((line) => ({ quantite: Number(line.quantite), prix_unitaire: Number(line.prix_unitaire), tva: Number(line.tva) })), Number(doc.remise_pct));
  ensure(110); text(`Total HT : ${euro(totals.total_ht_brut)}`, 11, true);
  if (totals.total_remise > 0) text(`Remise ${Number(doc.remise_pct)} % : -${euro(totals.total_remise)}`);
  text(`Total HT net : ${euro(totals.total_ht)}`, 11, true);
  for (const tax of totals.tva_par_taux) text(`TVA (${tax.taux} %) : ${euro(tax.montant)}`);
  if (doc.autoliquidation) text("Autoliquidation — TVA due par le preneur (article 283-2 nonies du CGI).", 9, true);
  text(`Total TTC : ${euro(totals.total_ttc)}`, 15, true); rule();
  text("Conditions générales de vente", 10, true);
  if (doc.conditions_paiement) text(`Modalités de paiement : ${doc.conditions_paiement}`, 9);
  if (doc.notes) text(`Notes : ${doc.notes}`, 9);
  for (const mention of MENTIONS_FACTURE) text(mention, 8);
  const pages = pdf.getPages();
  for (const [index, p] of pages.entries()) p.drawText(`${doc.numero} · ${index + 1}/${pages.length}`, { x: 36, y: 22, size: 8, font: normal });
  return pdf.save();
}

export async function telechargerFacturePdf(doc: DocHeader, items: DocLine[]) {
  const { shareOrDownloadPdf } = await import("./pdf-download");
  const bytes = await creerFacturePdf(doc, items);
  await shareOrDownloadPdf(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), `Facture_${doc.numero}.pdf`);
}