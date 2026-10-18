import { describe, expect, test } from "bun:test";
import { lireCommande } from "./commandes-ensio";

const texte = `Bon de Commande Référence commande Date 14/10/2026 Numéro * CST 02048127 Fournisseur 0000002995
10368 IRVE - ALAGON GEOFFREY - Semaine 42 (12/10/2026 au 18/10/2026) : Installation borne U 1 365,0000 0.00 % 365,00 14/10/2026
Devis n° AT-2026-0021 Nom et visa Maxime Henard VIREMENT SIMPLE SEPA 45 jours fin de mois Montant HT (EUR) 1 365,00`;

describe("lecture bon de commande ENSIO", () => {
  const c = lireCommande(texte);
  test("numéro de commande", () => expect(c.numero).toBe("CST 02048127"));
  test("attachement lié", () => expect(c.attachement).toBe("AT-2026-0021"));
  test("client", () => expect(c.client).toBe("ALAGON GEOFFREY"));
  test("montant HT total avec milliers", () => expect(c.montantHt).toBe(1365));
});
