import { describe, expect, it as test } from "bun:test";
import { estDoublon, nettoyerTexteLu, reperesDoublons } from "./doublons-import";

describe("import : lecture et doublons", () => {
  test("recolle les lettres séparées", () => {
    expect(nettoyerTexteLu("M o n s i e u r  D u p o n t")).toEqual("Monsieur Dupont");
  });
  test("corrige O et l dans un téléphone OCR", () => {
    expect(nettoyerTexteLu("Tél : O6 l2 34 56 78")).toEqual("Tél : 06 12 34 56 78");
  });
  test("nom + adresse identiques = doublon malgré civilité et abréviation", () => {
    expect(estDoublon({ client_nom: "Mme DUPONT Marie", adresse: "12 av. des Lilas" }, { client_nom: "Marie Dupont", adresse: "12 avenue des lilas" })).toEqual(true);
  });
  test("nom + téléphone identiques = doublon", () => {
    expect(estDoublon({ client_nom: "Martin", client_telephone: "+33 6 12 34 56 78" }, { client_nom: "MARTIN", client_telephone: "0612345678" })).toEqual(true);
  });
  test("même nom seul ne suffit pas", () => {
    expect(estDoublon({ client_nom: "Martin", adresse: "1 rue A" }, { client_nom: "Martin", adresse: "9 rue B" })).toEqual(false);
  });
  test("doublon dans le même import repéré", () => {
    const r = reperesDoublons([{ client_nom: "A B", adresse: "3 rue X" }, { client_nom: "B A", adresse: "3 rue x" }], []);
    expect(r[1]).toEqual("Identique à l'intervention 1");
  });
});
