import { expect, it } from "bun:test";
import { commandesAValider } from "./commande-validation";
const attachements = [{ id: "att-1", total_ht: 365 }, { id: "att-2", total_ht: 400 }];
const commandes = [
  { id: "commande-1", attId: "att-1", lu: { numero: "CST02048127", montantHt: 365 }, choix: "" as const },
  { id: "commande-2", attId: "att-2", lu: { numero: "CST02048128", montantHt: 400 }, choix: "" as const },
];
it("valide une seule commande sans signature", () => {
  expect(commandesAValider(commandes, attachements, "commande-2").map((c) => c.id)).toEqual(["commande-2"]);
});
it("valide toutes les commandes sans signature", () => {
  expect(commandesAValider(commandes, attachements).map((c) => c.id)).toEqual(["commande-1", "commande-2"]);
});
it("ne retraite pas une commande déjà facturée", () => {
  expect(commandesAValider([{ ...commandes[0], factureId: "facture-1" }, commandes[1]], attachements).map((c) => c.id)).toEqual(["commande-2"]);
});
it("bloque un écart non arbitré", () => {
  expect(commandesAValider([{ ...commandes[0], lu: { numero: "CST02048127", montantHt: 300 } }], attachements)).toEqual([]);
});
it("bloque les commandes ciblant le même attachement", () => {
  expect(commandesAValider([commandes[0], { ...commandes[1], attId: "att-1", lu: commandes[0].lu }], attachements)).toEqual([]);
});