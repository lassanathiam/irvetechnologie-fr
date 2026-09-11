import { describe, expect, it } from "bun:test";
import {
  isDossierEnCours,
  isDossierFacture,
  isDossierNouveau,
  isDossierTermine,
  splitDossiersByLifecycle,
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

  it("répartit la liste en 4 sections organisationnelles", () => {
    const buckets = splitDossiersByLifecycle([
      { id: "a", statut: "planifie", statut_facturation: "a_facturer" },
      { id: "b", statut: "en_cours", demarre_at: "2026-09-11T08:00:00.000Z" },
      { id: "c", statut: "termine", termine_at: "2026-09-11T10:00:00.000Z", statut_facturation: "a_facturer" },
      { id: "d", statut: "termine", termine_at: "2026-09-11T10:00:00.000Z", statut_facturation: "facture" },
    ]);

    expect(buckets.nouveaux.map((d) => d.id)).toEqual(["a"]);
    expect(buckets.enCours.map((d) => d.id)).toEqual(["b"]);
    expect(buckets.terminesAFacturer.map((d) => d.id)).toEqual(["c"]);
    expect(buckets.factures.map((d) => d.id)).toEqual(["d"]);
  });
});
