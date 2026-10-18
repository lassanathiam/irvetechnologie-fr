import { describe, expect, it } from "bun:test";
import { lireCommande } from "./commandes-ensio";

const texte = `Bon de Commande Référence commande Date 14/10/2026 Numéro * CST 02048127 Fournisseur 0000002995
10368 IRVE - ALAGON GEOFFREY - Semaine 42 (12/10/2026 au 18/10/2026) : Installation borne U 1 365,0000 0.00 % 365,00 14/10/2026
Devis n° AT-2026-0021 Nom et visa Maxime Henard VIREMENT SIMPLE SEPA 45 jours fin de mois Montant HT (EUR) 1 365,00`;

describe("lecture bon de commande ENSIO", () => {
  const c = lireCommande(texte);
  it("numéro de commande", () => expect(c.numero).toEqual("CST 02048127"));
  it("attachement lié", () => expect(c.attachement).toEqual("AT-2026-0021"));
  it("client", () => expect(c.client).toEqual("ALAGON GEOFFREY"));
  it("montant HT total avec milliers", () => expect(c.montantHt).toEqual(1365));
});

describe("lecture des autres donneurs d’ordre", () => {
  it("lit une commande AXIANS avec total HT", () => expect(lireCommande("AXIANS Bon de commande n° AX-2026-123 Devis AT-2026-0042 Total HT : 430,00")).toEqual({ numero: "AX-2026-123", attachement: "AT-2026-0042", client: null, montantHt: 430 }));
  it("n’invente pas un total HT à partir d’un TTC inconnu", () => expect(lireCommande("Commande n° BC-123 Total TTC 516,00").montantHt).toEqual(null));
});
