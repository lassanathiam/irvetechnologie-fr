import { describe, expect, test } from "bun:test";
import { classerChantiers, scoreFiche, SEUIL_SUR } from "./fiche-match";

const chantiers = [
  { id: "a", client_nom: "LEBREC Geoffroy", adresse: "12 rue des Lilas", cp_ville: "44300 Nantes", date_debut: "" },
  { id: "b", client_nom: "GELPI Juliette", adresse: "3 chemin Vert", cp_ville: "85000 La Roche", date_debut: "" },
];

describe("rapprochement fiche technique", () => {
  test("le nom du client (même inversé, sans accent) retrouve le bon chantier", () => {
    const r = classerChantiers({ client_nom: "Geoffroy Lebrec", cp_ville: "44300" }, chantiers);
    expect(r[0]!.id).toBe("a");
    expect(r[0]!.score).toBeGreaterThanOrEqual(SEUIL_SUR);
  });
  test("un client inconnu n'est pas rangé automatiquement", () => {
    expect(scoreFiche({ client_nom: "Dupont Marc", cp_ville: "75001" }, chantiers[0]!)).toBeLessThan(SEUIL_SUR);
  });
});
