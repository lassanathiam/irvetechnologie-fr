import { describe, it, expect } from "bun:test";
import { estAttachementCloture } from "./attachement-classement";

describe("Classement des attachements transformés en facture", () => {
  it("classe un attachement facturé dans les clôturés", () => {
    expect(estAttachementCloture({ statut: "facture" })).toEqual(true);
  });
  it("classe un attachement lié à une facture malgré son ancien statut envoyé", () => {
    expect(estAttachementCloture({ statut: "envoye", facture_id: "facture-1" })).toEqual(true);
  });
  it("conserve un attachement accepté sans facture dans les actifs", () => {
    expect(estAttachementCloture({ statut: "accepte", facture_id: null })).toEqual(false);
  });
});