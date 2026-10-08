import { describe, expect, it } from "bun:test";
import { coordonneesAttachement } from "./coordonnees-attachement";

describe("coordonnées ENSIO des attachements", () => {
  it("conserve l'adresse de facturation et récupère les coordonnées du contact enregistré", () => {
    const result = coordonneesAttachement({ nom: "ENSIO", raison_sociale: "ENSIO SAS (anciennement SAD Télécom)", adresse: "12 avenue Morane Saulnier", cp_ville: "78140 Vélizy-Villacoublay", charge_affaires_email: null }, { email: "jerome.noel@ensio.eu", telephone: "06 10 09 71 49" });
    expect(result.adresse).toEqual("12 avenue Morane Saulnier");
    expect(result.cp_ville).toEqual("78140 Vélizy-Villacoublay");
    expect(result.charge_affaires_email).toEqual("jerome.noel@ensio.eu");
    expect(result.charge_affaires_telephone).toEqual("06 10 09 71 49");
  });
  it("n'écrase pas un contact de facturation déjà renseigné", () => {
    expect(coordonneesAttachement({ nom: "ENSIO", charge_affaires_email: "facturation@exemple.fr" }, { email: "chantier@exemple.fr" }).charge_affaires_email).toEqual("facturation@exemple.fr");
  });
  it("utilise Antoni pour la facturation sans remplacer le siège par son agence", () => {
    const result = coordonneesAttachement({ nom: "ENSIO", adresse: "12 avenue Morane Saulnier, bâtiment Le Breguet", cp_ville: "78140 Vélizy-Villacoublay", charge_affaires_nom: "Antoni GALLELLI", charge_affaires_email: "antoni.gallelli@ensio.eu", charge_affaires_telephone: "06 31 00 19 30" }, { email: "jerome.noel@ensio.eu" });
    expect(result.charge_affaires_email).toEqual("antoni.gallelli@ensio.eu");
    expect(result.charge_affaires_telephone).toEqual("06 31 00 19 30");
    expect(result.cp_ville).toEqual("78140 Vélizy-Villacoublay");
  });
});