import { describe, expect, it } from "bun:test";
import { ecartCommande, choisirAttachementCommande } from "./commande-ecart";

describe("rapports d’écart et commandes multi-donneurs", () => {
  it("calcule le complément détaillé à demander", () => expect(ecartCommande(430, 365)).toEqual(65));
  it("conserve un écart négatif", () => expect(ecartCommande(365, 430)).toEqual(-65));
  it("compare les centimes sans erreur flottante", () => expect(ecartCommande(365.01, 365)).toEqual(0.01));
  const atts = [{ id: "axians", numero: "AT-2026-0022", texte: "DUPONT", client_nom: "AXIANS" }, { id: "ensio", numero: "AT-2026-0021", texte: "DUPONT", client_nom: "ENSIO" }];
  it("associe AXIANS par son attachement imprimé", () => expect(choisirAttachementCommande({ attachement: "AT-2026-0022", client: null }, atts, (s) => s)).toEqual("axians"));
  it("ne choisit pas arbitrairement entre deux clients homonymes", () => expect(choisirAttachementCommande({ attachement: null, client: "DUPONT" }, atts, (s) => s)).toEqual(""));
});