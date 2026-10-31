import { expect, it as test } from "bun:test";
import { estTotal, photosManquantes, CATEGORIES_TOTAL_OBLIGATOIRES } from "./cri-total";
import { categoriesRetourObligatoires } from "./planning.functions";

test("TotalEnergies est reconnu", () => {
  expect(estTotal("TOTALENERGIES")).toEqual(true);
  expect(estTotal("BUMP")).toEqual(false);
});

test("le numéro de série et le tore sont obligatoires pour Total", () => {
  const manq = photosManquantes([]).map((p) => p.categorie);
  expect(manq).toContain("total_numero_serie");
  expect(manq).toContain("total_tore");
  expect(manq.includes("total_vehicule")).toEqual(false);
});

test("une installation Total demande les photos du PV Total", () => {
  expect([...categoriesRetourObligatoires("installation", "ENSIO", "TOTALENERGIES")]).toEqual(CATEGORIES_TOTAL_OBLIGATOIRES);
  expect((categoriesRetourObligatoires("maintenance", "ENSIO", "TOTALENERGIES") as readonly string[]).includes("total_avant")).toEqual(false);
});
