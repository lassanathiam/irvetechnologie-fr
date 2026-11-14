import { describe, expect, it } from "bun:test";
import { estPagePubliqueMesuree } from "./analytics";

describe("suivi Google limité aux pages publiques", () => {
  it("mesure l'accueil, la demande et les pages ville", () => {
    expect(estPagePubliqueMesuree("/")).toEqual(true);
    expect(estPagePubliqueMesuree("/demande")).toEqual(true);
    expect(estPagePubliqueMesuree("/devis-borne-recharge")).toEqual(true);
    expect(estPagePubliqueMesuree("/installation-borne-recharge-nantes")).toEqual(true);
    expect(estPagePubliqueMesuree("/installation-borne-recharge/rennes")).toEqual(true);
  });
  it("ne mesure jamais l'espace pro ni les liens privés", () => {
    expect(estPagePubliqueMesuree("/espace")).toEqual(false);
    expect(estPagePubliqueMesuree("/planning")).toEqual(false);
    expect(estPagePubliqueMesuree("/devis-client/abc")).toEqual(false);
    expect(estPagePubliqueMesuree("/partenaire/xyz")).toEqual(false);
    expect(estPagePubliqueMesuree("/signer-pv/tok")).toEqual(false);
  });
});
