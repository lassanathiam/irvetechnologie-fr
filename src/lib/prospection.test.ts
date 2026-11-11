import { describe, expect, it } from "vitest";
import { finaliserCorps, lienMailto, dateRelance } from "./prospection";

describe("prospection", () => {
  it("chaque mail porte le téléphone 07 68 08 43 67 et l'adresse de contact", () => {
    const t = finaliserCorps("Bonjour");
    expect(t).toContain("07 68 08 43 67");
    expect(t).toContain("contacts@irvetechnologie.fr");
  });
  it("chaque mail propose de répondre STOP", () => {
    expect(finaliserCorps("Bonjour")).toContain("STOP");
  });
  it("un prospect en STOP ne peut plus recevoir de mail", () => {
    expect(lienMailto({ email: "contact@exemple.fr", statut: "stop", objet: "x", corps: "y" })).toBeNull();
  });
  it("relance prévue 7 jours après l'envoi", () => {
    expect(dateRelance(new Date("2026-11-11T20:00:00Z"))).toBe("2026-11-18");
  });
});
