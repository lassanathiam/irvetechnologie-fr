import { describe, expect, it } from "bun:test";
import { modifierReponseMateriel, reponseMateriel, interventionLibelle } from "./chantier-intervention";

describe("Matériel récupéré", () => {
  it("conserve les anciennes confirmations de récupération", () => { expect(reponseMateriel({ borne: true }, "borne")).toBe("oui"); });
  it("distingue une réponse non d’une absence de réponse", () => { expect(reponseMateriel({ protections: false }, "protections")).toBe("non"); expect(reponseMateriel({}, "protections")).toBe("inconnu"); });
  it("modifie une réponse sans effacer les autres matériels", () => { expect(modifierReponseMateriel({ borne: true, parafoudre: true }, "protections", "non")).toEqual({ borne: true, parafoudre: true, protections: false }); });
  it("réinitialise une réponse sans inventer une récupération", () => { expect(modifierReponseMateriel({ borne: true, cable: false }, "borne", "inconnu")).toEqual({ cable: false }); });
});
describe("Nature d’intervention", () => {
  it("respecte la nature explicite indépendamment de la catégorie", () => { expect(interventionLibelle({ nature_dossier: "remplacement", type: "installation" })).toBe(interventionLibelle({ nature_dossier: "remplacement", type: "maintenance" })); expect(interventionLibelle({ nature_dossier: "remplacement" })).not.toBe(interventionLibelle({ nature_dossier: "installation" })); });
});