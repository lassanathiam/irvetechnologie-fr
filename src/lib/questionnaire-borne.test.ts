import { describe, expect, it } from "bun:test";
import { estDansZone, niveauDemande, type ReponsesQuestionnaire } from "./questionnaire-borne";

const base: ReponsesQuestionnaire = {
  occupation: "proprietaire",
  delai: "vite",
  code_postal: "44522",
};

describe("questionnaire borne maison", () => {
  it("accepte la Bretagne et les Pays de la Loire seulement", () => {
    expect(estDansZone("29200")).toBe(true);
    expect(estDansZone("85000")).toBe(true);
    expect(estDansZone("75011")).toBe(false);
    expect(estDansZone("44")).toBe(false);
  });
  it("propriétaire dans la zone avec projet proche = prêt à installer", () => {
    expect(niveauDemande(base)).toBe("chaud");
  });
  it("hors zone ou simple renseignement = froid", () => {
    expect(niveauDemande({ ...base, code_postal: "33000" })).toBe("froid");
    expect(niveauDemande({ ...base, delai: "renseigne" })).toBe("froid");
  });
  it("locataire dans la zone avec projet proche = à qualifier", () => {
    expect(niveauDemande({ ...base, occupation: "locataire" })).toBe("tiede");
  });
});
