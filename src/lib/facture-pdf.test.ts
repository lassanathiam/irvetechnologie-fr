import { describe, expect, it } from "bun:test";
import { PDFDocument } from "pdf-lib";
import { creerFacturePdf } from "./facture-pdf";

describe("Factures pour SY by Cegedim", () => {
  it("produit des instructions texte natives plutôt qu'une image scannée", async () => {
    const bytes = await creerFacturePdf({ numero: "F-2026-0029", date_emission: "2026-10-19", date_limite: "2026-11-30", client_nom: "ENSIO", remise_pct: 0, bon_commande: "CST02048127" }, [{ libelle: "Pose borne", quantite: 1, prix_unitaire: 365, tva: 0 }]);
    const pdf = await PDFDocument.load(bytes);
    const resources = pdf.getPages()[0]?.node.Resources();
    expect(pdf.getPageCount()).toEqual(1);
    expect(resources?.has(pdf.context.obj("Font"))).toEqual(true);
    expect(resources?.has(pdf.context.obj("XObject"))).toEqual(false);
  });
});