import { describe, expect, it } from "bun:test";
import { categorieBilan, resumeBilan, type LigneBilan } from "./bilan-reception";

const ligne = (p: Partial<LigneBilan>): LigneBilan => ({ id: "a", numero: "AT-1", donneur: "ENSIO SAS", objet: null, ticket: null, totalHt: 100, envoyeLe: null, facture: null, commande: null, chantiers: [], ...p });
const recu = [{ id: "r1", nom: "X", ville: null, date: null, receptionneLe: "2026-11-14T10:00:00Z" }];
const nonRecu = [{ id: "r2", nom: "Y", ville: null, date: null, receptionneLe: null }];

describe("bilan de réception", () => {
  it("réceptionné avec commande", () => expect(categorieBilan(ligne({ chantiers: recu, commande: "CST 1" }))).toBe("recu_commande"));
  it("commande reçue mais chantier non réceptionné", () => expect(categorieBilan(ligne({ chantiers: nonRecu, commande: "CST 1" }))).toBe("commande_non_recu"));
  it("réceptionné sans commande", () => expect(categorieBilan(ligne({ chantiers: recu }))).toBe("recu_sans_commande"));
  it("envoyé sans commande ni réception", () => expect(categorieBilan(ligne({ chantiers: nonRecu, envoyeLe: "2026-11-01" }))).toBe("envoye_sans_commande"));
  it("jamais envoyé", () => expect(categorieBilan(ligne({ chantiers: nonRecu }))).toBe("non_envoye"));
  it("un attachement sans chantier n'est jamais compté réceptionné", () => expect(categorieBilan(ligne({ envoyeLe: "2026-11-01" }))).toBe("envoye_sans_commande"));
  it("compte chantiers réceptionnés et commandes manquantes", () => {
    const r = resumeBilan([ligne({ id: "1", chantiers: recu, commande: "CST 1", totalHt: 150 }), ligne({ id: "2", chantiers: nonRecu, totalHt: 120 })]);
    const { attachements, chantiers, receptionnes, nonReceptionnes, commandesRecues, commandesManquantes, totalHt } = r;
    expect({ attachements, chantiers, receptionnes, nonReceptionnes, commandesRecues, commandesManquantes, totalHt }).toEqual({ attachements: 2, chantiers: 2, receptionnes: 1, nonReceptionnes: 1, commandesRecues: 1, commandesManquantes: 1, totalHt: 270 });
    expect(r.parCategorie.recu_commande).toEqual({ nb: 1, ht: 150 });
  });
});
