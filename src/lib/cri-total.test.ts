import { expect, test } from "bun:test";
import { estTotal, photosManquantes, CATEGORIES_TOTAL_OBLIGATOIRES } from "./cri-total";
import { categoriesRetourObligatoires } from "./planning.functions";

test("TotalEnergies est reconnu", () => {
  expect(estTotal("TOTALENERGIES")).toBe(true);
  expect(estTotal("BUMP")).toBe(false);
});

test("le numéro de série et le tore sont obligatoires pour Total", () => {
  const manq = photosManquantes([]).map((p) => p.categorie);
  expect(manq).toContain("total_numero_serie");
  expect(manq).toContain("total_tore");
  expect(manq).not.toContain("total_vehicule");
});

test("une installation Total demande les photos du PV Total", () => {
  expect([...categoriesRetourObligatoires("installation", "ENSIO", "TOTALENERGIES")]).toEqual(CATEGORIES_TOTAL_OBLIGATOIRES);
  expect(categoriesRetourObligatoires("maintenance", "ENSIO", "TOTALENERGIES")).not.toContain("total_avant" as never);
});
