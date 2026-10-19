import { expect, it } from "bun:test";
import { saisieCommande, saisieCommandeSchema } from "./commandes-memoire";
it("conserve les choix et les montants après sérialisation pour un retour ultérieur", () => {
  const saisie = { lu: { numero: "CST 02048127", attachement: "AT-2026-0021", client: "ALAGON", montantHt: 365 }, attId: "attachement", choix: "attachement" as const, rapportSelectionne: true };
  expect(saisieCommandeSchema.parse(JSON.parse(JSON.stringify(saisieCommande(saisie))))).toEqual(saisie);
});