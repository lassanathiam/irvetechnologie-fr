import { describe, expect, it } from "bun:test";
import { photoPvObligatoire, verifierPhotoPv } from "./photo-pv";

function verificationAcceptee(reseau: string, photos: { categorie: string }[]): boolean {
  try { verifierPhotoPv("ENSIO", reseau, photos); return true; }
  catch { return false; }
}

describe("Photo PV obligatoire ENSIO", () => {
  for (const reseau of ["CAP BORNES", "AMARA", "50FIVE", "TIME2PLUG"]) {
    it(`exige le PV pour ENSIO / ${reseau}`, () => {
      expect(photoPvObligatoire("ENSIO", reseau)).toEqual(true);
      expect(verificationAcceptee(reseau, [])).toEqual(false);
      expect(verificationAcceptee(reseau, [{ categorie: "pv_signe" }])).toEqual(true);
    });
  }
  it("reconnaît NCO comme dossier ENSIO", () => expect(photoPvObligatoire("NCO", "AMARA")).toEqual(true));
  it("exclut BUMP / Kizéo", () => expect(photoPvObligatoire("ENSIO", "BUMP")).toEqual(false));
  it("exclut DKV / Docusign", () => expect(photoPvObligatoire("ENSIO", "DKV")).toEqual(false));
  it("n'impose rien aux autres donneurs d'ordre", () => expect(photoPvObligatoire("50FIVE", "50FIVE")).toEqual(false));
  it("n'invente pas un PV sans réseau renseigné", () => expect(photoPvObligatoire("ENSIO", null)).toEqual(false));
});