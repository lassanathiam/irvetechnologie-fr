import { describe, expect, it } from "bun:test";
import { COMPANY_CONFIG, headOfficeLine, operatingBaseLine } from "./company";

describe("coordonnées affichées", () => {
  it("l'établissement est Rue du Stade, 44522 Mésanger", () => {
    expect(operatingBaseLine).toEqual("Rue du Stade, 44522 Mésanger");
    expect(COMPANY_CONFIG.operatingBase.postalCode).toEqual("44522");
  });

  it("le siège reste 60 rue François Ier, 75008 Paris", () => {
    expect(headOfficeLine).toEqual("60 rue François Ier, 75008 Paris");
  });

  it("un seul numéro affiché : 07 68 08 43 67", () => {
    expect(COMPANY_CONFIG.phoneDisplay).toEqual("07 68 08 43 67");
    expect(COMPANY_CONFIG.phoneHref).toEqual("tel:+33768084367");
  });

  it("horaires : du lundi au samedi, 8 h – 18 h", () => {
    const jours = COMPANY_CONFIG.openingHours.flatMap((h) => [...h.days]);
    expect(jours).toEqual(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]);
    for (const h of COMPANY_CONFIG.openingHours) {
      expect(h.opens).toEqual("08:00");
      expect(h.closes).toEqual("18:00");
    }
    expect(COMPANY_CONFIG.openingHoursDisplay).toEqual("Du lundi au samedi, 8 h – 18 h");
  });

  it("les liens officiels ne sont pas inventés en attendant", () => {
    expect(COMPANY_CONFIG.sameAs).toEqual([]);
  });
});
