import { describe, expect, it } from "bun:test";
import { attachementEnvoye, etapeChantier, recuSansCommande, resumeEtapes } from "./etape-chantier";

const base = { attachement: true, envoye: true, commande: false, receptionne: false, facture: false, depose: false, paye: false };

describe("circuit unique du chantier", () => {
  it("sans attachement = étape 1", () => expect(etapeChantier({ ...base, attachement: false, envoye: false })).toBe(1));
  it("attachement pas envoyé = étape 1", () => expect(etapeChantier({ ...base, envoye: false })).toBe(1));
  it("envoyé sans commande = étape 2", () => expect(etapeChantier(base)).toBe(2));
  it("sans commande, un chantier réceptionné reste à l'étape 2", () => {
    const e = { ...base, receptionne: true };
    expect(etapeChantier(e)).toBe(2);
    expect(recuSansCommande(e)).toBe(true);
  });
  it("commande reçue = étape 3 (à réceptionner)", () => expect(etapeChantier({ ...base, commande: true })).toBe(3));
  it("commande reçue + réceptionné = étape 4", () => expect(etapeChantier({ ...base, commande: true, receptionne: true })).toBe(4));
  it("facturé avec commande mais pas réceptionné = étape 3 (à réceptionner)", () => expect(etapeChantier({ ...base, commande: true, facture: true })).toBe(3));
  it("facturé sans commande ne passe jamais en réception", () => expect(etapeChantier({ ...base, facture: true })).toBe(5));
  it("payé = étape 6 même sans réception", () => expect(etapeChantier({ ...base, commande: true, facture: true, paye: true })).toBe(6));
  it("ligne sans chantier : rien à réceptionner", () => expect(etapeChantier({ ...base, commande: true, sansReception: true })).toBe(4));
  it("facturé = étape 5", () => expect(etapeChantier({ ...base, commande: true, receptionne: true, facture: true })).toBe(5));
  it("facture déposée ou payée = étape 6", () => {
    expect(etapeChantier({ ...base, receptionne: true, commande: true, facture: true, depose: true })).toBe(6);
    expect(etapeChantier({ ...base, facture: true, paye: true })).toBe(6);
  });
  it("une commande reçue prouve l'envoi d'un attachement resté en brouillon", () => expect(etapeChantier({ ...base, envoye: false, commande: true })).toBe(3));
  it("statut envoyé sans date compte comme envoyé", () => expect(attachementEnvoye({ statut: "envoye" })).toBe(true));
  it("brouillon jamais envoyé", () => expect(attachementEnvoye({ statut: "brouillon" })).toBe(false));
  it("totaux par étape", () => {
    const r = resumeEtapes([{ etape: 3, montantHt: 300 }, { etape: 3, montantHt: 65.5 }, { etape: 5, montantHt: 100 }]);
    expect(r[3]).toEqual({ nb: 2, ht: 365.5 });
    expect(r[5]).toEqual({ nb: 1, ht: 100 });
    expect(r[1]).toEqual({ nb: 0, ht: 0 });
  });
});
