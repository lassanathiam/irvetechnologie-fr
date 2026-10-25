import { describe, expect, it } from "vitest";
import { nbTes, totalTes } from "./attachement-tes";

describe("suivi TES", () => {
  it("totalise uniquement les lignes marquées TES", () => {
    const items = [
      { tes: true, quantite: 2, prix_unitaire: 65 },
      { tes: false, quantite: 1, prix_unitaire: 300 },
      { quantite: 5, prix_unitaire: 12 },
      { tes: true, quantite: 1, prix_unitaire: 150 },
    ];
    expect(totalTes(items)).toBe(280);
    expect(nbTes(items)).toBe(2);
  });

  it("arrondit au centime et tolère les quantités texte", () => {
    expect(totalTes([{ tes: true, quantite: "3", prix_unitaire: "33.33" }])).toBe(99.99);
  });

  it("vaut zéro sans ligne TES", () => {
    expect(totalTes([{ quantite: 1, prix_unitaire: 300 }])).toBe(0);
    expect(nbTes([])).toBe(0);
  });
});
