import { COMPANY } from "./company";
import { round2 } from "./billing";

/**
 * Génère une facture au format XML structuré UBL Invoice 2.1 (norme OASIS),
 * acceptée par les plateformes de dépôt de factures des donneurs d'ordre.
 * Module navigateur-safe : aucune dépendance serveur.
 */

export type UblFacture = {
  numero: string;
  date_emission: string;
  date_echeance: string;
  client_nom: string;
  client_adresse: string | null;
  client_cp_ville: string | null;
  bon_commande: string | null;
  numero_affaire: string | null;
  autoliquidation: boolean;
  remise_pct: number;
  total_ht_brut: number;
  total_remise: number;
  total_ht: number;
  total_tva: number;
  total_ttc: number;
};

export type UblLigne = {
  libelle: string;
  description: string | null;
  quantite: number;
  prix_unitaire: number;
  tva: number;
  unite: string;
};

/** Échappement XML obligatoire : un libellé avec & ou < ne doit jamais casser le fichier. */
export function xmlEscape(value: string): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const montant = (n: number) => round2(n).toFixed(2);

/** Date ISO (YYYY-MM-DD) attendue par UBL, quelle que soit la forme stockée. */
function dateIso(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toISOString().slice(0, 10);
}

/** Code UN/ECE de l'unité de facturation (C62 = unité, MTR = mètre, HUR = heure…). */
export function codeUnite(unite: string): string {
  const u = (unite || "").trim().toLowerCase();
  if (["m", "ml", "mètre", "metre", "mètre linéaire"].includes(u)) return "MTR";
  if (["m2", "m²"].includes(u)) return "MTK";
  if (["h", "heure", "heures"].includes(u)) return "HUR";
  if (["j", "jour", "journée", "journee"].includes(u)) return "DAY";
  if (["kg"].includes(u)) return "KGM";
  return "C62";
}

/** « 75008 Paris » → { codePostal: "75008", ville: "Paris" }. */
export function separerCpVille(cpVille: string | null): { codePostal: string; ville: string } {
  const brut = (cpVille || "").trim();
  const m = brut.match(/^(\d{5})\s+(.+)$/);
  if (m) return { codePostal: m[1], ville: m[2].trim() };
  return { codePostal: "", ville: brut };
}

type GroupeTva = { taux: number; base: number; montant: number };

function groupesTva(lignes: UblLigne[], remisePct: number): GroupeTva[] {
  const parTaux = new Map<number, GroupeTva>();
  for (const l of lignes) {
    const taux = round2(l.tva);
    const groupe = parTaux.get(taux) ?? { taux, base: 0, montant: 0 };
    const baseLigne = round2(l.quantite * l.prix_unitaire * (1 - remisePct / 100));
    groupe.base = round2(groupe.base + baseLigne);
    groupe.montant = round2(groupe.montant + round2((baseLigne * taux) / 100));
    parTaux.set(taux, groupe);
  }
  return [...parTaux.values()].sort((a, b) => b.taux - a.taux);
}

function categorieTva(taux: number, autoliquidation: boolean, indent: string): string {
  if (autoliquidation || taux === 0) {
    return [
      `${indent}<cac:TaxCategory>`,
      `${indent}  <cbc:ID>AE</cbc:ID>`,
      `${indent}  <cbc:Percent>0.00</cbc:Percent>`,
      `${indent}  <cbc:TaxExemptionReasonCode>VATEX-EU-AE</cbc:TaxExemptionReasonCode>`,
      `${indent}  <cbc:TaxExemptionReason>Autoliquidation</cbc:TaxExemptionReason>`,
      `${indent}  <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>`,
      `${indent}</cac:TaxCategory>`,
    ].join("\n");
  }
  return [
    `${indent}<cac:TaxCategory>`,
    `${indent}  <cbc:ID>S</cbc:ID>`,
    `${indent}  <cbc:Percent>${montant(taux)}</cbc:Percent>`,
    `${indent}  <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>`,
    `${indent}</cac:TaxCategory>`,
  ].join("\n");
}

export function genererFactureUbl(facture: UblFacture, lignes: UblLigne[]): string {
  const client = separerCpVille(facture.client_cp_ville);
  const groupes = groupesTva(lignes, facture.remise_pct);
  const fournisseurCp = separerCpVille(COMPANY.cpVille);

  const lignesXml = lignes
    .map((l, i) => {
      const totalLigne = round2(l.quantite * l.prix_unitaire);
      const description = (l.description || "").trim();
      return [
        `  <cac:InvoiceLine>`,
        `    <cbc:ID>${i + 1}</cbc:ID>`,
        `    <cbc:InvoicedQuantity unitCode="${codeUnite(l.unite)}">${l.quantite}</cbc:InvoicedQuantity>`,
        `    <cbc:LineExtensionAmount currencyID="EUR">${montant(totalLigne)}</cbc:LineExtensionAmount>`,
        `    <cac:Item>`,
        ...(description ? [`      <cbc:Description>${xmlEscape(description)}</cbc:Description>`] : []),
        `      <cbc:Name>${xmlEscape(l.libelle)}</cbc:Name>`,
        `      <cac:ClassifiedTaxCategory>`,
        `        <cbc:ID>${facture.autoliquidation || l.tva === 0 ? "AE" : "S"}</cbc:ID>`,
        `        <cbc:Percent>${montant(facture.autoliquidation ? 0 : l.tva)}</cbc:Percent>`,
        `        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>`,
        `      </cac:ClassifiedTaxCategory>`,
        `    </cac:Item>`,
        `    <cac:Price>`,
        `      <cbc:PriceAmount currencyID="EUR">${montant(l.prix_unitaire)}</cbc:PriceAmount>`,
        `    </cac:Price>`,
        `  </cac:InvoiceLine>`,
      ].join("\n");
    })
    .join("\n");

  const sousTotaux = groupes
    .map((g) =>
      [
        `    <cac:TaxSubtotal>`,
        `      <cbc:TaxableAmount currencyID="EUR">${montant(g.base)}</cbc:TaxableAmount>`,
        `      <cbc:TaxAmount currencyID="EUR">${montant(g.montant)}</cbc:TaxAmount>`,
        categorieTva(g.taux, facture.autoliquidation, "      "),
        `    </cac:TaxSubtotal>`,
      ].join("\n"),
    )
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:UBLVersionID>2.1</cbc:UBLVersionID>
  <cbc:CustomizationID>urn:cen.eu:en16931:2017</cbc:CustomizationID>
  <cbc:ID>${xmlEscape(facture.numero)}</cbc:ID>
  <cbc:IssueDate>${dateIso(facture.date_emission)}</cbc:IssueDate>
  <cbc:DueDate>${dateIso(facture.date_echeance)}</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
${facture.bon_commande ? `  <cac:OrderReference>\n    <cbc:ID>${xmlEscape(facture.bon_commande)}</cbc:ID>\n  </cac:OrderReference>\n` : ""}  <cac:AccountingSupplierParty>
    <cac:Party>
      <cbc:EndpointID schemeID="0002">${COMPANY.siret}</cbc:EndpointID>
      <cac:PartyName><cbc:Name>${xmlEscape(COMPANY.raisonSociale)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>${xmlEscape(COMPANY.adresse)}</cbc:StreetName>
        <cbc:CityName>${xmlEscape(fournisseurCp.ville)}</cbc:CityName>
        <cbc:PostalZone>${fournisseurCp.codePostal}</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>FR</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>${COMPANY.tva}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>${xmlEscape(COMPANY.raisonSociale)}</cbc:RegistrationName>
        <cbc:CompanyID schemeID="0002">${COMPANY.siret}</cbc:CompanyID>
      </cac:PartyLegalEntity>
      <cac:Contact>
        <cbc:Telephone>${xmlEscape(COMPANY.telephone)}</cbc:Telephone>
        <cbc:ElectronicMail>${xmlEscape(COMPANY.email)}</cbc:ElectronicMail>
      </cac:Contact>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>${xmlEscape(facture.client_nom)}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
${facture.client_adresse ? `        <cbc:StreetName>${xmlEscape(facture.client_adresse)}</cbc:StreetName>\n` : ""}        <cbc:CityName>${xmlEscape(client.ville)}</cbc:CityName>
        <cbc:PostalZone>${client.codePostal}</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>FR</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
    </cac:Party>
  </cac:AccountingCustomerParty>
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>
  </cac:PaymentMeans>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">${montant(facture.total_tva)}</cbc:TaxAmount>
${sousTotaux}
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">${montant(facture.total_ht_brut)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">${montant(facture.total_ht)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">${montant(facture.total_ttc)}</cbc:TaxInclusiveAmount>
    <cbc:AllowanceTotalAmount currencyID="EUR">${montant(facture.total_remise)}</cbc:AllowanceTotalAmount>
    <cbc:PayableAmount currencyID="EUR">${montant(facture.total_ttc)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${lignesXml}
</Invoice>
`;
}

/** Télécharge le XML UBL de la facture dans le navigateur (nom : F-2026-0017.xml). */
export function telechargerFactureUbl(facture: UblFacture, lignes: UblLigne[]): void {
  const xml = genererFactureUbl(facture, lignes);
  const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${facture.numero}.xml`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
