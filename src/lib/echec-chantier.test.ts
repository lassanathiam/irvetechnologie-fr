import { describe, expect, it as test } from "bun:test";
import { estEnRetardNonRealise, motifEchec } from "./echec-chantier";

const jour = new Date("2026-10-24T00:00:00");

describe("échec chantier", () => {
  test("un chantier passé non réalisé est en retard", () => {
    expect(estEnRetardNonRealise({ date_debut: "2026-10-20T08:00:00", statut: "planifie" }, jour)).toEqual(true);
  });
  test("un chantier remis à planifier n'est plus en retard", () => {
    expect(estEnRetardNonRealise({ date_debut: "2026-10-20T08:00:00", statut: "planifie", date_a_confirmer: true }, jour)).toEqual(false);
  });
  test("le motif client absent a un message préparé", () => {
    expect(motifEchec("client_absent").message).toContain("absent");
  });
});
