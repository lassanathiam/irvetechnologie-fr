import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { PDFPage, PDFFont } from "pdf-lib";
import type { DocHeader, DocLine } from "@/components/DocumentPrint";
import { BRAND_LOGO_URL } from "@/components/BrandLogo";
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
  [/‚Ç¬/g, "€"], [/‚Äô/g, "’"], [/‚Äò/g, "‘"], [/‚Äú|‚Äù/g, "”"],
  [/‚Äì/g, "–"], [/‚Äî/g, "—"], [/‚Ä¶/g, "…"], [/¬∑/g, "·"],
];

/** Caractères CP1252 (0x80–0x9F) encodables par WinAnsi, hors Latin-1. */
const WINANSI_EXTRA = new Set("€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ");

export function nettoyer(value: string): string {
  let out = String(value ?? "");
  for (const [pattern, remplacement] of MOJIBAKE) out = out.replace(pattern, remplacement);
  out = out.normalize("NFC").replace(/[  ]/g, " ").replace(/[‑−]/g, "-");
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

const ACCENT = rgb(0.078, 0.349, 0.851); // #1459d9, accent des documents imprimés
const NOIR = rgb(0.1, 0.1, 0.12);
const GRIS = rgb(0.42, 0.45, 0.5);
const FOND_CLAIR = rgb(0.955, 0.96, 0.97);
const BORDURE = rgb(0.85, 0.87, 0.9);
const BLANC = rgb(1, 1, 1);

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const MARGE = 36;
const LARGEUR = PAGE_W - MARGE * 2;

type Ctx = {
  pdf: PDFDocument;
  page: PDFPage;
  normal: PDFFont;
  bold: PDFFont;
  y: number;
  numero: string;
};

function nouvellePage(ctx: Ctx, suite: boolean) {
  ctx.page = ctx.pdf.addPage([PAGE_W, PAGE_H]);
  ctx.y = PAGE_H - MARGE;
  if (suite) {
    ctx.page.drawText(nettoyer(`Facture ${ctx.numero} — suite`), { x: MARGE, y: ctx.y, size: 10, font: ctx.bold, color: NOIR });
    ctx.y -= 24;
  }
}

function ensure(ctx: Ctx, height: number) {
  if (ctx.y - height >= 42) return;
  nouvellePage(ctx, true);
}

/** Découpe un texte en lignes tenant dans `largeur`, puis les dessine. */
function texte(ctx: Ctx, value: string, opts: { size?: number; strong?: boolean; x?: number; largeur?: number; color?: ReturnType<typeof rgb>; interligne?: number } = {}) {
  const { size = 10, strong = false, x = MARGE, largeur = LARGEUR, color = NOIR, interligne = 1.35 } = opts;
  const font = strong ? ctx.bold : ctx.normal;
  for (const paragraph of nettoyer(value).split(/\r?\n/)) {
    const lignes: string[] = [];
    let ligne = "";
    for (const mot of paragraph.split(/\s+/)) {
      if (!mot) continue;
      const candidat = ligne ? `${ligne} ${mot}` : mot;
      if (font.widthOfTextAtSize(candidat, size) <= largeur) { ligne = candidat; continue; }
      if (ligne) { lignes.push(ligne); ligne = ""; }
      for (const char of mot) {
        if (font.widthOfTextAtSize(ligne + char, size) > largeur && ligne) { lignes.push(ligne); ligne = ""; }
        ligne += char;
      }
    }
    lignes.push(ligne);
    for (const l of lignes) {
      ensure(ctx, size * interligne);
      ctx.page.drawText(l, { x, y: ctx.y, size, font, color });
      ctx.y -= size * interligne;
    }
  }
}

function droite(ctx: Ctx, value: string, size: number, strong: boolean, xDroite: number, y: number, color = NOIR) {
  const font = strong ? ctx.bold : ctx.normal;
  const v = nettoyer(value);
  ctx.page.drawText(v, { x: xDroite - font.widthOfTextAtSize(v, size), y, size, font, color });
}

async function embedLogo(pdf: PDFDocument) {
  try {
    const reponse = await fetch(BRAND_LOGO_URL);
    if (!reponse.ok) return null;
    const bytes = await reponse.arrayBuffer();
    return await pdf.embedPng(bytes);
  } catch {
    return null; // le logo ne doit jamais empêcher la génération de la facture
  }
}

/**
 * PDF de facture avec la mise en forme des documents imprimés (logo, accent,
 * tableau de prestations), tout en gardant un texte natif sélectionnable :
 * exigence de la plateforme SY BY CEGEDIM qui refuse les PDF-image.
 */
export async function creerFacturePdf(doc: DocHeader, items: DocLine[]) {
  const pdf = await PDFDocument.create();
  pdf.setTitle(`Facture ${doc.numero} — ${COMPANY.raisonSociale}`);
  pdf.setAuthor(COMPANY.raisonSociale);
  const normal = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const logo = await embedLogo(pdf);
  const ctx: Ctx = { pdf, page: undefined as unknown as PDFPage, normal, bold, y: 0, numero: doc.numero };
  nouvellePage(ctx, false);

  // ---- En-tête : logo + société à gauche, bloc client à droite ----
  const hautPage = ctx.y;
  const blocClientW = 200;
  const blocClientX = PAGE_W - MARGE - blocClientW;

  if (logo) {
    const taille = 52;
    ctx.page.drawImage(logo, { x: MARGE, y: hautPage - taille, width: taille, height: taille });
  }
  const xSociete = MARGE + (logo ? 62 : 0);
  const largeurSociete = blocClientX - xSociete - 14;
  let yG = hautPage - 13;
  ctx.page.drawText(nettoyer(COMPANY.raisonSociale).toUpperCase(), { x: xSociete, y: yG, size: 15, font: bold, color: NOIR });
  yG -= 15;
  ctx.page.drawText("BORNE DE L'OUEST", { x: xSociete, y: yG, size: 9.5, font: bold, color: ACCENT });
  yG -= 13;
  const qual = nettoyer(COMPANY.qualifications).toUpperCase();
  const qualW = bold.widthOfTextAtSize(qual, 8) + 10;
  ctx.page.drawRectangle({ x: xSociete, y: yG - 3, width: qualW, height: 13, borderColor: ACCENT, borderWidth: 0.8 });
  ctx.page.drawText(qual, { x: xSociete + 5, y: yG, size: 8, font: bold, color: ACCENT });
  yG -= 18;
  for (const ligne of [
    `${COMPANY.adresse} — ${COMPANY.cpVille}`,
    `${COMPANY.email} · ${COMPANY.telephone} · ${COMPANY.telephone2}`,
    `SIRET ${COMPANY.siret} · TVA ${COMPANY.tva} · ${COMPANY.site}`,
  ]) {
    ctx.page.drawText(nettoyer(ligne), { x: xSociete, y: yG, size: 8.5, font: normal, color: GRIS });
    yG -= 11.5;
  }

  // Bloc client encadré
  const clientLignes: { v: string; strong: boolean }[] = [
    { v: "FACTURÉ À", strong: true },
    { v: doc.client_nom, strong: true },
    ...[doc.client_adresse, doc.client_cp_ville, doc.client_email, doc.client_telephone]
      .filter(Boolean)
      .map((v) => ({ v: String(v), strong: false })),
  ];
  let yBloc = hautPage - 10;
  const blocHaut = yBloc + 4;
  for (const [i, l] of clientLignes.entries()) {
    const size = i === 0 ? 7.5 : i === 1 ? 10.5 : 8.5;
    ctx.page.drawText(nettoyer(l.v), {
      x: blocClientX + 10, y: yBloc, size,
      font: l.strong ? bold : normal,
      color: i === 0 ? GRIS : NOIR,
    });
    yBloc -= i === 1 ? 14 : 12;
  }
  ctx.page.drawRectangle({
    x: blocClientX, y: yBloc + 4, width: blocClientW, height: blocHaut - yBloc,
    borderColor: BORDURE, borderWidth: 0.8, color: FOND_CLAIR, opacity: 0.6,
  });
  // redessine le texte du client par-dessus le fond
  yBloc = hautPage - 10;
  for (const [i, l] of clientLignes.entries()) {
    const size = i === 0 ? 7.5 : i === 1 ? 10.5 : 8.5;
    ctx.page.drawText(nettoyer(l.v), {
      x: blocClientX + 10, y: yBloc, size,
      font: l.strong ? bold : normal,
      color: i === 0 ? GRIS : NOIR,
    });
    yBloc -= i === 1 ? 14 : 12;
  }

  ctx.y = Math.min(yG, yBloc) - 6;
  ctx.page.drawLine({ start: { x: MARGE, y: ctx.y }, end: { x: PAGE_W - MARGE, y: ctx.y }, thickness: 1.6, color: ACCENT });
  ctx.y -= 18;

  // ---- Numéro, date, échéance ----
  ctx.page.drawText("FACTURE N° ", { x: MARGE, y: ctx.y, size: 9, font: bold, color: GRIS });
  const offNum = bold.widthOfTextAtSize("FACTURE N° ", 9);
  ctx.page.drawText(nettoyer(doc.numero), { x: MARGE + offNum, y: ctx.y, size: 13, font: bold, color: NOIR });
  droite(ctx, `Date : ${dateFr(doc.date_emission)}    Échéance : ${dateFr(doc.date_limite)}`, 9.5, false, PAGE_W - MARGE, ctx.y + 1);
  ctx.y -= 20;

  // ---- Objet + références ----
  texte(ctx, `Objet : ${doc.objet || "Installation de borne de recharge"}`, { size: 11, strong: true, largeur: largeurSociete + blocClientW });
  ctx.y -= 2;
  const refs: [string, string | null | undefined][] = [
    ["Ticket", doc.numero_ticket],
    ["Bon de commande", doc.bon_commande],
    ["Affaire", doc.numero_affaire],
  ];
  const refsVisibles = refs.filter(([, v]) => v);
  if (refsVisibles.length) {
    const colW = LARGEUR / Math.max(refsVisibles.length, 1);
    refsVisibles.forEach(([label, value], i) => {
      const x = MARGE + i * colW;
      ctx.page.drawText(nettoyer(`${label} : `), { x, y: ctx.y, size: 8.5, font: normal, color: GRIS });
      ctx.page.drawText(nettoyer(String(value)), { x: x + normal.widthOfTextAtSize(`${label} : `, 8.5), y: ctx.y, size: 8.5, font: bold, color: NOIR });
    });
    ctx.y -= 16;
  }
  ctx.y -= 4;

  // ---- Tableau des prestations ----
  const cols = [
    { label: "#", w: 22, align: "left" as const },
    { label: "Prestation", w: 0, align: "left" as const }, // flexible
    { label: "Qté", w: 52, align: "right" as const },
    { label: "PU HT", w: 78, align: "right" as const },
    { label: "TVA", w: 46, align: "right" as const },
    { label: "Total HT", w: 78, align: "right" as const },
  ];
  cols[1].w = LARGEUR - cols.reduce((s, c) => s + c.w, 0);
  const colX: number[] = [];
  {
    let x = MARGE;
    for (const c of cols) { colX.push(x); x += c.w; }
  }
  const enteteH = 16;
  const dessinerEntete = () => {
    ensure(ctx, enteteH + 14);
    ctx.page.drawRectangle({ x: MARGE, y: ctx.y - 4, width: LARGEUR, height: enteteH, color: FOND_CLAIR });
    for (const [i, c] of cols.entries()) {
      const size = 7.5;
      if (c.align === "right") droite(ctx, c.label.toUpperCase(), size, true, colX[i] + c.w - 6, ctx.y, GRIS);
      else ctx.page.drawText(c.label.toUpperCase(), { x: colX[i] + 6, y: ctx.y, size, font: bold, color: GRIS });
    }
    ctx.y -= enteteH;
  };
  dessinerEntete();

  for (const [index, line] of items.entries()) {
    const qte = formatQuantite(Number(line.quantite), line.unite);
    const pu = euro(Number(line.prix_unitaire));
    const total = euro(Number(line.quantite) * Number(line.prix_unitaire));
    const tva = `${Number(line.tva)} %`;
    // hauteur estimée de la ligne (libellé + description)
    const wrap = (v: string, size: number, font: PDFFont, w: number) => {
      const out: string[] = [];
      let courant = "";
      for (const mot of nettoyer(v).split(/\s+/)) {
        const candidat = courant ? `${courant} ${mot}` : mot;
        if (font.widthOfTextAtSize(candidat, size) <= w) { courant = candidat; continue; }
        if (courant) out.push(courant);
        courant = mot;
      }
      if (courant) out.push(courant);
      return out.length ? out : [""];
    };
    const lignesLibelle = wrap(line.libelle, 9, bold, cols[1].w - 12);
    const lignesDesc = line.description ? wrap(line.description, 7.5, normal, cols[1].w - 12) : [];
    const hauteur = lignesLibelle.length * 11.5 + lignesDesc.length * 9.5 + 12;
    if (ctx.y - hauteur < 42) { nouvellePage(ctx, true); dessinerEntete(); }

    const yLigne = ctx.y - 8;
    ctx.page.drawText(String(index + 1), { x: colX[0] + 6, y: yLigne, size: 8, font: normal, color: GRIS });
    let yLib = yLigne;
    for (const l of lignesLibelle) {
      ctx.page.drawText(l, { x: colX[1] + 6, y: yLib, size: 9, font: bold, color: NOIR });
      yLib -= 11.5;
    }
    for (const l of lignesDesc) {
      ctx.page.drawText(l, { x: colX[1] + 6, y: yLib, size: 7.5, font: normal, color: GRIS });
      yLib -= 9.5;
    }
    droite(ctx, qte, 8.5, false, colX[2] + cols[2].w - 6, yLigne);
    droite(ctx, pu, 8.5, false, colX[3] + cols[3].w - 6, yLigne);
    droite(ctx, tva, 8.5, false, colX[4] + cols[4].w - 6, yLigne);
    droite(ctx, total, 8.5, true, colX[5] + cols[5].w - 6, yLigne);
    ctx.y -= hauteur;
    ctx.page.drawLine({ start: { x: MARGE, y: ctx.y }, end: { x: PAGE_W - MARGE, y: ctx.y }, thickness: 0.4, color: BORDURE });
    ctx.y -= 2;
  }

  // ---- Totaux (bloc à droite) ----
  const totals = computeTotals(
    items.map((line) => ({ quantite: Number(line.quantite), prix_unitaire: Number(line.prix_unitaire), tva: Number(line.tva) })),
    Number(doc.remise_pct),
  );
  const lignesTotaux: { label: string; value: string; strong: boolean }[] = [
    { label: "Total HT", value: euro(totals.total_ht_brut), strong: false },
  ];
  if (totals.total_remise > 0) lignesTotaux.push({ label: `Remise ${Number(doc.remise_pct)} %`, value: `- ${euro(totals.total_remise)}`, strong: false });
  lignesTotaux.push({ label: "Total HT net", value: euro(totals.total_ht), strong: true });
  for (const tax of totals.tva_par_taux) lignesTotaux.push({ label: `TVA (${tax.taux} %)`, value: euro(tax.montant), strong: false });

  const blocTotauxH = lignesTotaux.length * 14 + (doc.autoliquidation ? 26 : 0) + 34;
  ensure(ctx, blocTotauxH + 10);
  ctx.y -= 8;
  const totW = 240;
  const totX = PAGE_W - MARGE - totW;
  for (const l of lignesTotaux) {
    ctx.page.drawText(nettoyer(l.label), { x: totX, y: ctx.y, size: 9.5, font: l.strong ? bold : normal, color: l.strong ? NOIR : GRIS });
    droite(ctx, l.value, 9.5, l.strong, PAGE_W - MARGE, ctx.y);
    ctx.y -= 14;
  }
  if (doc.autoliquidation) {
    const msg = "Autoliquidation — TVA due par le preneur (article 283-2 nonies du CGI).";
    const h = 24;
    ctx.page.drawRectangle({ x: totX, y: ctx.y - h + 10, width: totW, height: h, borderColor: BORDURE, borderWidth: 0.8 });
    // découpe en deux lignes si besoin
    const tailleMsg = bold.widthOfTextAtSize(nettoyer(msg), 7.5) <= totW - 12 ? 7.5 : 6.8;
    ctx.page.drawText(nettoyer(msg), { x: totX + 6, y: ctx.y - h + 18, size: tailleMsg, font: bold, color: NOIR });
    ctx.y -= h + 4;
  }
  ctx.y -= 4;
  const ttcH = 24;
  ctx.page.drawRectangle({ x: totX, y: ctx.y - ttcH + 8, width: totW, height: ttcH, color: FOND_CLAIR, borderColor: BORDURE, borderWidth: 0.8 });
  ctx.page.drawText("TOTAL TTC", { x: totX + 8, y: ctx.y - ttcH + 16, size: 9.5, font: bold, color: NOIR });
  droite(ctx, euro(totals.total_ttc), 13, true, PAGE_W - MARGE - 8, ctx.y - ttcH + 15, ACCENT);
  ctx.y -= ttcH + 14;

  // ---- CGV ----
  ensure(ctx, 60);
  ctx.page.drawText("CONDITIONS GÉNÉRALES DE VENTE", { x: MARGE, y: ctx.y, size: 8.5, font: bold, color: NOIR });
  ctx.y -= 13;
  if (doc.conditions_paiement) texte(ctx, `Modalités de paiement : ${doc.conditions_paiement}`, { size: 8.5 });
  if (doc.notes) texte(ctx, `Notes : ${doc.notes}`, { size: 8.5 });
  for (const mention of MENTIONS_FACTURE) texte(ctx, `· ${mention}`, { size: 7.5, color: GRIS, interligne: 1.3 });

  // ---- Pied de page ----
  const pages = pdf.getPages();
  for (const [index, p] of pages.entries()) {
    p.drawText(nettoyer(`${doc.numero} · ${index + 1}/${pages.length}`), { x: MARGE, y: 22, size: 8, font: normal, color: GRIS });
  }
  return pdf.save();
}

export async function telechargerFacturePdf(doc: DocHeader, items: DocLine[]) {
  const { shareOrDownloadPdf } = await import("./pdf-download");
  const bytes = await creerFacturePdf(doc, items);
  await shareOrDownloadPdf(new Blob([new Uint8Array(bytes)], { type: "application/pdf" }), `Facture_${doc.numero}.pdf`);
}
