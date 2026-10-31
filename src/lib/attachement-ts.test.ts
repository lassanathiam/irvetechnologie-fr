import { describe, expect, it } from "bun:test";
import { preparerLignesTs } from "./attachement-ts";

describe("document TS séparé", () => {
  it("ne reprend pas les lignes initiales et ne modifie pas les lignes saisies", () => {
    const initial = [{ libelle: "Pose initiale", quantite: 1, prix_unitaire: 300 }];
    const supplement = [{ libelle: "Câble supplémentaire", quantite: 7, prix_unitaire: 2.5 }];
    const document = preparerLignesTs(supplement);
    expect(document).toEqual([{ libelle: "Câble supplémentaire", quantite: 7, prix_unitaire: 2.5, tes: true }]);
    expect(initial).toEqual([{ libelle: "Pose initiale", quantite: 1, prix_unitaire: 300 }]);
    expect("tes" in supplement[0]).toEqual(false);
  });
  it("marque chaque nouvelle ligne comme supplément et conserve son chantier", () => {
    expect(preparerLignesTs([{ libelle: "Coffret", quantite: 1, prix_unitaire: 65, rendezvous_id: "chantier-a" }])[0]).toEqual({ libelle: "Coffret", quantite: 1, prix_unitaire: 65, rendezvous_id: "chantier-a", tes: true });
  });
  it("refuse un document TS vide", () => {
    let message = "";
    try { preparerLignesTs([]); } catch (error) { message = error instanceof Error ? error.message : ""; }
    expect(message).toEqual("Ajoutez une ligne de travaux supplémentaires.");
  });
});