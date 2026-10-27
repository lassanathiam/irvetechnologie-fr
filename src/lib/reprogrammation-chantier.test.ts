import { describe, expect, it } from "bun:test";
import { repriseApresNouvelleDate } from "./reprogrammation-chantier";

describe("Reprogrammation des chantiers bloqués", () => {
  const boisse = { date_debut: "2026-10-20T14:00:00Z", statut: "en_pause", termine_at: null, probleme: false };
  it("remet un chantier en pause dans les interventions quand sa date change", () => {
    expect(repriseApresNouvelleDate(boisse, "2026-10-27T14:00:00Z")).toEqual({ statut: "planifie", probleme: false, demarre_at: null });
  });
  it("ne reprend pas une pause lors d'une simple modification du dossier", () => {
    expect(repriseApresNouvelleDate(boisse, boisse.date_debut)).toEqual({});
  });
  it("retire le blocage d'un chantier problématique reprogrammé", () => {
    expect(repriseApresNouvelleDate({ ...boisse, statut: "planifie", probleme: true }, "2026-10-27T14:00:00Z")).toEqual({ statut: "planifie", probleme: false, demarre_at: null });
  });
  it("conserve la clôture des chantiers réellement terminés", () => {
    expect(repriseApresNouvelleDate({ ...boisse, termine_at: "2026-10-20T16:00:00Z" }, "2026-10-27T14:00:00Z")).toEqual({});
    expect(repriseApresNouvelleDate({ ...boisse, statut: "termine" }, "2026-10-27T14:00:00Z")).toEqual({});
  });
});