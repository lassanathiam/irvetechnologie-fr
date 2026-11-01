import { describe, expect, it } from "bun:test";
import { codeUnite, genererFactureUbl, separerCpVille, xmlEscape } from "./facture-ubl";

const FACTURE = {
  numero: "F-2026-0042",
  date_emission: "2026-10-15T00:00:00.000Z",
  date_echeance: "2026-11-29",
  client_nom: "ENSIO SAS & Fils",
  client_adresse: "12 rue des Lilas",
  client_cp_ville: "44100 Nantes",
  bon_commande: "BC-2026-118",
  numero_affaire: null,
  autoliquidation: false,
  remise_pct: 0,
  total_ht_brut: 250,
  total_remise: 0,
  total_ht: 250,
  total_tva: 50,
  total_ttc: 300,
};

const LIGNES = [
  { libelle: "Pose borne <WB> 22 kW", description: "Main d'œuvre & réglages", quantite: 1, prix_unitaire: 150, tva: 20, unite: "forfait" },
  { libelle: "Câble 5G10", description: null, quantite: 25, prix_unitaire: 4, tva: 20, unite: "m" },
];

describe("genererFactureUbl", () => {
  const xml = genererFactureUbl(FACTURE, LIGNES);

  it("déclare la norme UBL Invoice 2.1", () => {
    expect(xml).toContain("urn:oasis:names:specification:ubl:schema:xsd:Invoice-2");
    expect(xml).toContain("<cbc:UBLVersionID>2.1</cbc:UBLVersionID>");
    expect(xml).toContain("<cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>");
  });

  it("reprend le numéro, les dates et le bon de commande", () => {
    expect(xml).toContain("<cbc:ID>F-2026-0042</cbc:ID>");
    expect(xml).toContain("<cbc:IssueDate>2026-10-15</cbc:IssueDate>");
    expect(xml).toContain("<cbc:DueDate>2026-11-29</cbc:DueDate>");
    expect(xml).toContain("<cbc:ID>BC-2026-118</cbc:ID>");
  });

  it("identifie le fournisseur par SIRET et TVA", () => {
    expect(xml).toContain('<cbc:EndpointID schemeID="0002">98953372400013</cbc:EndpointID>');
    expect(xml).toContain("<cbc:CompanyID>FR89989533724</cbc:CompanyID>");
  });

  it("échappe les caractères spéciaux du client et des lignes", () => {
    expect(xml).toContain("ENSIO SAS &amp; Fils");
    expect(xml).toContain("Pose borne &lt;WB&gt; 22 kW");
    expect(xml).toContain("Main d&apos;œuvre &amp; réglages");
    expect(xml.includes("ENSIO SAS & Fils")).toBeFalse();
  });

  it("totalise HT, TVA et TTC", () => {
    expect(xml).toContain('<cbc:TaxExclusiveAmount currencyID="EUR">250.00</cbc:TaxExclusiveAmount>');
    expect(xml).toContain('<cbc:TaxAmount currencyID="EUR">50.00</cbc:TaxAmount>');
    expect(xml).toContain('<cbc:PayableAmount currencyID="EUR">300.00</cbc:PayableAmount>');
  });

  it("détaille chaque ligne avec son taux de TVA", () => {
    expect(xml).toContain('<cbc:InvoicedQuantity unitCode="MTR">25</cbc:InvoicedQuantity>');
    expect(xml).toContain('<cbc:LineExtensionAmount currencyID="EUR">100.00</cbc:LineExtensionAmount>');
    expect(xml.match(/<cac:InvoiceLine>/g)?.length).toEqual(2);
  });

  it("autoliquidation : catégorie AE et TVA à zéro", () => {
    const xmlAe = genererFactureUbl({ ...FACTURE, autoliquidation: true, total_tva: 0, total_ttc: 250 }, LIGNES);
    expect(xmlAe).toContain("<cbc:ID>AE</cbc:ID>");
    expect(xmlAe).toContain("VATEX-EU-AE");
    expect(xmlAe).toContain("<cbc:Percent>0.00</cbc:Percent>");
  });
});

describe("separerCpVille", () => {
  it("sépare le code postal de la ville", () => {
    expect(separerCpVille("44100 Nantes")).toEqual({ codePostal: "44100", ville: "Nantes" });
  });
  it("ville seule sans code postal", () => {
    expect(separerCpVille("Nantes")).toEqual({ codePostal: "", ville: "Nantes" });
  });
});

describe("codeUnite", () => {
  it("mètre, heure et forfait", () => {
    expect(codeUnite("m")).toEqual("MTR");
    expect(codeUnite("heure")).toEqual("HUR");
    expect(codeUnite("forfait")).toEqual("C62");
  });
});

describe("xmlEscape", () => {
  it("échappe les cinq caractères réservés", () => {
    expect(xmlEscape(`a&b<c>d"e'f`)).toEqual("a&amp;b&lt;c&gt;d&quot;e&apos;f");
  });
});
