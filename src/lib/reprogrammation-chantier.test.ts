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
  const malezieux = { date_debut: "2026-10-12T12:00:00Z", statut: "planifie", termine_at: "2026-10-12T15:31:00Z", probleme: false };
  const avant = new Date("2026-11-01T20:00:00Z").getTime();
  it("rouvre un chantier terminé non facturé replanifié à une date future (retour délestage)", () => {
    expect(repriseApresNouvelleDate(malezieux, "2026-11-04T12:30:00Z", "planifie", avant)).toEqual({ statut: "planifie", probleme: false, demarre_at: null, termine_at: null, archive: false });
  });
  it("ne rouvre jamais un chantier facturé ou payé", () => {
    expect(repriseApresNouvelleDate({ ...malezieux, statut_facturation: "facture" }, "2026-11-04T12:30:00Z", "planifie", avant)).toEqual({});
    expect(repriseApresNouvelleDate({ ...malezieux, statut_facturation: "paye" }, "2026-11-04T12:30:00Z", "planifie", avant)).toEqual({});
  });
  it("ne rouvre pas un chantier terminé avec une date passée", () => {
    expect(repriseApresNouvelleDate(malezieux, "2026-10-27T14:00:00Z", "planifie", avant)).toEqual({});
  });
});