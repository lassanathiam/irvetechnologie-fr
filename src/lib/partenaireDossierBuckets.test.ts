import { describe, expect, it } from "bun:test";
import {
  isDossierEnCours,
  isDossierFacture,
  isDossierNouveau,
  isDossierTermine,
} from "./partenaireDossierBuckets";

describe("partenaireDossierBuckets", () => {
  it("classe un dossier planifié comme nouveau", () => {
    const dossier = { statut: "planifie", demarre_at: null, termine_at: null, statut_facturation: "a_facturer" };
    expect(isDossierNouveau(dossier)).toBeTrue();
    expect(isDossierEnCours(dossier)).toBeFalse();
  });

  it("classe un dossier démarré comme en cours", () => {
    const dossier = { statut: "en_cours", demarre_at: "2026-09-11T08:00:00.000Z", termine_at: null };
    expect(isDossierEnCours(dossier)).toBeTrue();
    expect(isDossierTermine(dossier)).toBeFalse();
  });

  it("classe un dossier terminé à facturer comme terminé non facturé", () => {
    const dossier = { statut: "termine", termine_at: "2026-09-11T10:00:00.000Z", statut_facturation: "a_facturer" };
    expect(isDossierTermine(dossier)).toBeTrue();
    expect(isDossierFacture(dossier)).toBeFalse();
  });

  it("classe un dossier facturé dans facturés", () => {
    const dossier = { statut: "termine", termine_at: "2026-09-11T10:00:00.000Z", statut_facturation: "facture" };
    expect(isDossierFacture(dossier)).toBeTrue();
    expect(isDossierNouveau(dossier)).toBeFalse();
  });
});
