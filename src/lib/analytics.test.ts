import { describe, expect, it } from "vitest";
import { estPagePubliqueMesuree } from "./analytics";

describe("suivi Google limité aux pages publiques", () => {
  it("mesure l'accueil, la demande et les pages ville", () => {
    expect(estPagePubliqueMesuree("/")).toBe(true);
    expect(estPagePubliqueMesuree("/demande")).toBe(true);
    expect(estPagePubliqueMesuree("/installation-borne-recharge-nantes")).toBe(true);
    expect(estPagePubliqueMesuree("/installation-borne-recharge/rennes")).toBe(true);
  });
  it("ne mesure jamais l'espace pro ni les liens privés", () => {
    expect(estPagePubliqueMesuree("/espace")).toBe(false);
    expect(estPagePubliqueMesuree("/planning")).toBe(false);
    expect(estPagePubliqueMesuree("/devis-client/abc")).toBe(false);
    expect(estPagePubliqueMesuree("/partenaire/xyz")).toBe(false);
    expect(estPagePubliqueMesuree("/signer-pv/tok")).toBe(false);
  });
});
