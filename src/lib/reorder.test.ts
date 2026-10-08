import { describe, it as test, expect } from "bun:test";
import { deplacerVers } from "./reorder";
describe("deplacerVers", () => {
  test("glisse une ligne du bas entre deux lignes", () => { expect(deplacerVers(["a", "b", "c", "d"], 3, 1)).toEqual(["a", "d", "b", "c"]); });
  test("glisse une ligne du haut vers le bas", () => { expect(deplacerVers(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]); });
});
