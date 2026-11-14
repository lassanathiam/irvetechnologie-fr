import { describe, expect, it as test } from "bun:test";
import { chantiersAFicher, classerChantiers, scoreFiche, SEUIL_SUR } from "./fiche-match";

const chantiers = [
  { id: "a", client_nom: "LEBREC Geoffroy", adresse: "12 rue des Lilas", cp_ville: "44300 Nantes", date_debut: "" },
  { id: "b", client_nom: "GELPI Juliette", adresse: "3 chemin Vert", cp_ville: "85000 La Roche", date_debut: "" },
];

describe("rapprochement fiche technique", () => {
  test("le nom du client (même inversé, sans accent) retrouve le bon chantier", () => {
    const r = classerChantiers({ client_nom: "Geoffroy Lebrec", cp_ville: "44300" }, chantiers);
    expect(r[0]!.id).toEqual("a");
    expect(r[0]!.score >= SEUIL_SUR).toBeTrue();
  });
  test("un client inconnu n'est pas rangé automatiquement", () => {
    expect(scoreFiche({ client_nom: "Dupont Marc", cp_ville: "75001" }, chantiers[0]!) < SEUIL_SUR).toBeTrue();
  });
});

describe("chantiers proposés à l'import de fiches", () => {
  test("seuls les chantiers en cours sans fiche sont proposés à la sélection", () => {
    const liste = [
      { id: "1", statut: "planifie" }, { id: "2", statut: "termine" }, { id: "3", statut: "realise" },
      { id: "4", statut: "annule" }, { id: "5", statut: "en_cours" }, { id: "6", statut: "confirme" },
    ];
    const r = chantiersAFicher(liste, new Set(["6"]));
    expect(r.ouverts.map((c) => c.id)).toEqual(["1", "5", "6"]);
    expect(r.aChoisir.map((c) => c.id)).toEqual(["1", "5"]);
  });
});
