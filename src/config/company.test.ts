import { test, expect } from "bun:test";
import { COMPANY_CONFIG, headOfficeLine, operatingBaseLine } from "./company";

/** Coordonnées imposées par l'entreprise : une seule source, jamais d'invention. */
test("l'établissement affiché est Rue du Stade, 44522 Mésanger", () => {
  expect(operatingBaseLine).toBe("Rue du Stade, 44522 Mésanger");
  expect(COMPANY_CONFIG.operatingBase.postalCode).toBe("44522");
});

test("le siège reste 60 rue François Ier, 75008 Paris", () => {
  expect(headOfficeLine).toBe("60 rue François Ier, 75008 Paris");
});

test("un seul numéro affiché : 07 68 08 43 67", () => {
  expect(COMPANY_CONFIG.phoneDisplay).toBe("07 68 08 43 67");
  expect(COMPANY_CONFIG.phoneHref).toBe("tel:+33768084367");
});

test("horaires : du lundi au samedi, 8 h – 18 h", () => {
  const jours = COMPANY_CONFIG.openingHours.flatMap((h) => [...h.days]);
  expect(jours).toEqual([
    "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
  ]);
  for (const h of COMPANY_CONFIG.openingHours) {
    expect(h.opens).toBe("08:00");
    expect(h.closes).toBe("18:00");
  }
  expect(COMPANY_CONFIG.openingHoursDisplay).toBe("Du lundi au samedi, 8 h – 18 h");
});

test("les liens officiels ne sont pas inventés en attendant", () => {
  expect(COMPANY_CONFIG.sameAs).toEqual([]);
});
