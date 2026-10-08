import { describe, expect, it } from "bun:test";
import { concerneEnsio, copieDistincte } from "./copie-ensio";

describe("copies documentaires ENSIO", () => {
  it("reconnaît les documents ENSIO par société ou destinataire", () => {
    expect(concerneEnsio("jerome.noel@ensio.eu")).toBe(true);
    expect(concerneEnsio("compta@exemple.fr", "ENSIO SAS")).toBe(true);
    expect(concerneEnsio("contacts@irvetechnologie.fr", "Rappel DKV")).toBe(false);
  });
  it("ajoute Antoni sans le recevoir deux fois s'il est déjà destinataire", () => {
    expect(copieDistincte("jerome.noel@ensio.eu", "antoni.gallelli@ensio.eu")).toBe("antoni.gallelli@ensio.eu");
    expect(copieDistincte("ANTONI.GALLELLI@ENSIO.EU", "antoni.gallelli@ensio.eu")).toBeNull();
  });
});