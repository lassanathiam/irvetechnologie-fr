import { expect, it } from "bun:test";
import { categorieLigneRapport, totauxRapports } from "./commande-ecart-lot";
import type { RapportEcart } from "./commande-ecart";

const ligne = { libelle: "Déplacement supplémentaire", description: "Trajet chantier", quantite: 1, prixUnitaire: 65, totalHt: 65 };
it("les déplacements et frais associés ont leur catégorie dédiée", () => {
  expect(categorieLigneRapport(ligne)).toEqual("deplacement");
  expect(categorieLigneRapport({ ...ligne, libelle: "Péage", description: null })).toEqual("deplacement");
  expect(categorieLigneRapport({ ...ligne, libelle: "Pose de borne", description: null })).toEqual("texte");
});
it("un lot de trois commandes cumule les montants et les écarts en centimes", () => {
  const base: RapportEcart = { numero: "BC-1", attachement: "AT-1", donneur: "ENSIO", client: "Client", ticket: "", date: "19/10/2026", commandeHt: 365, attachementHt: 430, ecartHt: 65, commentaire: "", lignes: [ligne] };
  expect(totauxRapports([base, { ...base, commandeHt: 100.1, attachementHt: 100.2 }, { ...base, commandeHt: 250, attachementHt: 200 }])).toEqual({ commandeHt: 715.1, attachementHt: 730.2, ecartHt: 15.1 });
});