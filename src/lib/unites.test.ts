import { describe, expect, test } from "bun:test";
import { formatQuantite } from "./unites";

describe("formatQuantite", () => {
  test("demi-heure", () => expect(formatQuantite(0.5, "h")).toBe("30 min"));
  test("tiers d'heure", () => expect(formatQuantite(0.3333, "h")).toBe("20 min"));
  test("1 h 30", () => expect(formatQuantite(1.5, "h")).toBe("1 h 30"));
  test("pièces", () => expect(formatQuantite(2, "u")).toBe("2"));
});
