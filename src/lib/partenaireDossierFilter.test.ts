import { describe, expect, it } from "bun:test";
import { dossierCorrespondAuFiltre } from "./partenaireDossierFilter";

describe("partenaireDossierFilter", () => {
  const dossier = {
    client_nom: "Mme Ndiaye",
    adresse: "14 rue des Almadies",
    cp_ville: "Dakar",
    designation: "Pose borne 11 kW",
    client_telephone: "77 000 00 00",
    client_email: "client@example.com",
  };

  it("accepte tous les dossiers si le filtre est vide", () => {
    expect(dossierCorrespondAuFiltre(dossier, "")).toBeTrue();
    expect(dossierCorrespondAuFiltre(dossier, "   ")).toBeTrue();
  });

  it("trouve le dossier par nom, adresse, ville ou désignation", () => {
    expect(dossierCorrespondAuFiltre(dossier, "ndiaye")).toBeTrue();
    expect(dossierCorrespondAuFiltre(dossier, "almadies")).toBeTrue();
    expect(dossierCorrespondAuFiltre(dossier, "dakar")).toBeTrue();
    expect(dossierCorrespondAuFiltre(dossier, "11 kw")).toBeTrue();
  });

  it("trouve le dossier par téléphone et email", () => {
    expect(dossierCorrespondAuFiltre(dossier, "77 000")).toBeTrue();
    expect(dossierCorrespondAuFiltre(dossier, "example.com")).toBeTrue();
  });

  it("retourne false si aucun champ ne correspond", () => {
    expect(dossierCorrespondAuFiltre(dossier, "thies")).toBeFalse();
  });
});
