import { describe, expect, it } from "bun:test";
import { dossiersUniques, nomDossier, numerosColles, selectionParDefaut, selectionParNumeros } from "./bloc-dossiers";

describe("bloc de dossiers plateforme", () => {
  it("nom de dossier sans espaces ni accents cassés", () => expect(nomDossier("CST 02048127", "ALAGON Geoffrey")).toBe("CST02048127_ALAGON-Geoffrey"));
  it("nom de dossier sans accents (lisible sur tous les ordinateurs)", () => expect(nomDossier("CST 02048129", "COTARD Loïc")).toBe("CST02048129_COTARD-Loic"));
  it("une commande rectifiée ne crée pas deux dossiers pour la même facture", () => {
    const d = dossiersUniques([
      { id: "a", numero: "CST 02048152", client: "DELAUNAY ANTHONY", attId: "x", factureId: "f1" },
      { id: "b", numero: "CST 02048152", client: "GLAIS CLAIRE", attId: "x", factureId: "f1" },
      { id: "c", numero: "CST 02048127", client: "ALAGON", attId: "y", factureId: "f2" },
    ]);
    expect(d.map((x) => x.id)).toEqual(["c", "b"]);
  });
  it("une commande sans facture n'est pas un dossier à déposer", () => expect(dossiersUniques([{ id: "a", numero: "CST 1", client: null, attId: "x", factureId: null }])).toEqual([]));
  it("seuls les réceptionnés sont cochés par défaut", () => {
    const d = [{ id: "a", numero: "CST 1", client: null, attId: "x", factureId: "f1" }, { id: "b", numero: "CST 2", client: null, attId: "y", factureId: "f2" }];
    expect(selectionParDefaut(d, new Map([["x", true], ["y", false]]))).toEqual(["a"]);
  });
});

describe("liste collée depuis le tableau ENSIO", () => {
  it("lit les numéros CST collés", () => expect(numerosColles("IRVE - ALAGON CST02048127 14/10\nCST 02048129")).toEqual(["CST02048127", "CST02048129"]));
  it("ne coche que les commandes collées", () => {
    const d = [{ id: "a", numero: "CST 02048127", client: null, attId: "x", factureId: "f1" }, { id: "b", numero: "CST 02048135", client: null, attId: "y", factureId: "f2" }];
    expect(selectionParNumeros(d, ["CST02048127"])).toEqual(["a"]);
  });
});
