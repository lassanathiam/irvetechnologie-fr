import { describe, expect, test } from "bun:test";
import { decouperDossier, deplacer } from "./reorder";

describe("deplacer", () => {
  test("monte une ligne", () => expect(deplacer(["a", "b", "c"], 2, -1)).toEqual(["a", "c", "b"]));
  test("descend une ligne", () => expect(deplacer(["a", "b", "c"], 0, 1)).toEqual(["b", "a", "c"]));
  test("ne sort pas des limites", () => expect(deplacer(["a", "b"], 0, -1)).toEqual(["a", "b"]));
});

test("sous-dossier", () => {
  expect(decouperDossier("clients/MODOP")).toEqual({ parent: "clients", sous: "MODOP" });
  expect(decouperDossier("contrats")).toEqual({ parent: "contrats", sous: null });
});
