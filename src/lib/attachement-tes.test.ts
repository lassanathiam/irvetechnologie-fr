import { describe, expect, it } from "bun:test";
import { nbTes, totalTes } from "./attachement-tes";

describe("suivi TES", () => {
  it("totalise uniquement les lignes marquées TES", () => {
    const items = [
      { tes: true, quantite: 2, prix_unitaire: 65 },
      { tes: false, quantite: 1, prix_unitaire: 300 },
      { quantite: 5, prix_unitaire: 12 },
      { tes: true, quantite: 1, prix_unitaire: 150 },
    ];
    expect(totalTes(items)).toEqual(280);
    expect(nbTes(items)).toEqual(2);
  });

  it("arrondit au centime et tolère les quantités texte", () => {
    expect(totalTes([{ tes: true, quantite: "3", prix_unitaire: "33.33" }])).toEqual(99.99);
  });

  it("vaut zéro sans ligne TES", () => {
    expect(totalTes([{ quantite: 1, prix_unitaire: 300 }])).toEqual(0);
    expect(nbTes([])).toEqual(0);
  });
});
