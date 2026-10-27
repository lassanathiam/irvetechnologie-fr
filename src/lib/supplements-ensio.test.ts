import { describe, expect, it } from "bun:test";
import { supplementsEnsio } from "./supplements-ensio";

describe("suppléments ENSIO", () => {
  it("inclut les 15 premiers mètres", () => {
    expect(supplementsEnsio({ metrage_m: 15 }, "3G10")).toEqual([]);
    expect(supplementsEnsio({ metrage_m: 14 }, "5G10")).toEqual([]);
    expect(supplementsEnsio({ metrage_m: 16 }, "3G10")[0]?.quantite).toEqual(1);
  });
  it("facture le câble supplémentaire à 2 euros par mètre", () => {
    expect(supplementsEnsio({ metrage_m: 20 }, "3G10")[0]).toEqual({ libelle: "3G10", quantite: 5, prix_unitaire: 2, tes: true });
  });
  it("facture le 5G10 à 3 euros par mètre", () => {
    expect(supplementsEnsio({ metrage_reel_m: 20 }, "Câble 5G10 mm²")[0]).toEqual({ libelle: "Câble 5G10 mm²", quantite: 5, prix_unitaire: 3, tes: true });
  });
  it("ajoute systématiquement le câble info à 2 euros par mètre supplémentaire", () => {
    expect(supplementsEnsio({ metrage_m: 18, metrage_reel_m: 20 }, "5G10")[1]).toEqual({ libelle: "Câble info supplémentaire", quantite: 5, prix_unitaire: 2, tes: true });
  });
});