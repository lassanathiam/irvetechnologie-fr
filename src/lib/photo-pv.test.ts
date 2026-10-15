import { describe, expect, it } from "bun:test";
import { photoPvObligatoire, verifierPhotoPv } from "./photo-pv";

describe("Photo PV obligatoire ENSIO", () => {
  for (const reseau of ["CAP BORNES", "AMARA", "50FIVE", "TIME2PLUG"]) {
    it(`exige le PV pour ENSIO / ${reseau}`, () => {
      expect(photoPvObligatoire("ENSIO", reseau)).toBe(true);
      expect(() => verifierPhotoPv("ENSIO", reseau, [])).toThrow();
      expect(() => verifierPhotoPv("ENSIO", reseau, [{ categorie: "pv_signe" }])).not.toThrow();
    });
  }
  it("reconnaît NCO comme dossier ENSIO", () => expect(photoPvObligatoire("NCO", "AMARA")).toBe(true));
  it("exclut BUMP / Kizéo", () => expect(photoPvObligatoire("ENSIO", "BUMP")).toBe(false));
  it("exclut DKV / Docusign", () => expect(photoPvObligatoire("ENSIO", "DKV")).toBe(false));
  it("n'impose rien aux autres donneurs d'ordre", () => expect(photoPvObligatoire("50FIVE", "50FIVE")).toBe(false));
  it("n'invente pas un PV sans réseau renseigné", () => expect(photoPvObligatoire("ENSIO", null)).toBe(false));
});