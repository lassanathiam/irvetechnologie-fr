import { describe, expect, it } from "bun:test";
import { ETAPES_PHOTOS, photosParEtape } from "./photos-etapes";

describe("Parcours photo terrain", () => {
  it("conserve les huit étapes dans l’ordre demandé", () => {
    expect(ETAPES_PHOTOS.map((e) => [e.numero, e.id])).toEqual([
      [1, "terre"], [2, "avant"], [3, "borne"], [4, "tableau"],
      [5, "essai"], [6, "pv"], [7, "cable"], [8, "autre"],
    ]);
  });
  it("sépare la vérification initiale de la mesure finale de terre", () => {
    expect(photosParEtape(["verification_terre_avant", "ensio_resistance_pe"]).map((e) => e.numero)).toEqual([1, 5]);
  });
  it("conserve chaque preuve existante une seule fois", () => {
    const categories = ETAPES_PHOTOS.flatMap((e) => [...e.categories]);
    expect(new Set(categories).size).toEqual(categories.length);
    expect(photosParEtape([...categories, "ancienne_preuve"]).flatMap((e) => e.categories).sort()).toEqual([...categories, "ancienne_preuve"].sort());
  });
  it("ne crée aucune étape PV pour un parcours sans PV", () => {
    expect(photosParEtape(["mise_en_service", "autre"]).some((e) => e.id === "pv")).toEqual(false);
    expect(photosParEtape(["pv_signe"])[0]?.numero).toEqual(6);
  });
});