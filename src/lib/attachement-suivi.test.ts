import { expect, it } from "bun:test";
import { rapprocherAttachement } from "./attachement-suivi";
const atts = [
  { id: "fait", numero: "AT-2026-0021", bon_commande: "CST 02048127", facture_id: "facture-1", client_nom: "ENSIO" },
  { id: "reste", numero: "AT-2026-0023", bon_commande: null, facture_id: null, client_nom: "ENSIO" },
];
it("retrouve une commande déjà facturée malgré les espaces", () => {
  expect(rapprocherAttachement({ numero: "cst02048127", attachement: null }, atts)?.facture_id).toEqual("facture-1");
});
it("retrouve un attachement restant par sa référence", () => {
  expect(rapprocherAttachement({ attachement: "AT-2026-0023" }, atts)?.id).toEqual("reste");
});
it("ne rapproche pas des références contradictoires", () => {
  expect(rapprocherAttachement({ numero: "CST02048127", attachement: "AT-2026-0023" }, atts)).toEqual(undefined);
});
it("ne choisit pas entre deux numéros de commande identiques", () => {
  expect(rapprocherAttachement({ numero: "CST02048127", attachement: null }, [...atts, { ...atts[0], id: "doublon" }])).toEqual(undefined);
});