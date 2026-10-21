import { describe, expect, it } from "bun:test";
import { PDFDict, PDFDocument, PDFName } from "pdf-lib";
import { creerFacturePdf, nettoyer } from "./facture-pdf";

describe("Factures pour SY by Cegedim", () => {
  it("produit des instructions texte natives plutôt qu'une image scannée", async () => {
    const bytes = await creerFacturePdf({ numero: "F-2026-0029", date_emission: "2026-10-19", date_limite: "2026-11-30", client_nom: "ENSIO", remise_pct: 0, bon_commande: "CST02048127" }, [{ libelle: "Pose borne", quantite: 1, prix_unitaire: 365, tva: 0 }]);
    const pdf = await PDFDocument.load(bytes);
    const resources = pdf.getPages()[0]?.node.Resources();
    expect(pdf.getPageCount()).toEqual(1);
    expect(resources?.has(pdf.context.obj("Font"))).toEqual(true);
    const images = resources?.lookup(PDFName.of("XObject"), PDFDict);
    expect(images?.keys().length ?? 0).toEqual(0);
  });

  it("génère le PDF même avec des caractères non encodables WinAnsi", async () => {
    const bytes = await creerFacturePdf(
      { numero: "F-2026-0017", date_emission: "2026-10-13", date_limite: "2026-11-13", client_nom: "CHARGE EXPERT", remise_pct: 0 },
      [{ libelle: "Déplacement / Anthony Mac√© ⚡ ✅ ①", quantite: 1, prix_unitaire: 60, tva: 20 }],
    );
    expect(bytes.length > 0).toEqual(true);
  });

  it("corrige le mojibake courant et remplace les caractères hors WinAnsi", () => {
    expect(nettoyer("Déplacement / Anthony Mac√©")).toEqual("Déplacement / Anthony Macé");
    expect(nettoyer("Mac√© ⚡ ✅ ①")).toEqual("Macé   1");
  });
});