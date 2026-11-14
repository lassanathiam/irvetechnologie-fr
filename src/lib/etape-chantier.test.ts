import { describe, expect, it } from "bun:test";
import { attachementEnvoye, doublonsChantier, etapeChantier, numeroCommandeValide, nomDonneur, receptionnesSansCommande, recuSansCommande, resumeEtapes, totalReceptionnes } from "./etape-chantier";

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

describe("tous les chantiers réceptionnés", () => {
  it("compte les réceptionnés déjà facturés ou payés, pas les autres ; un chantier et son TS = 1 chantier", () => {
    const r = totalReceptionnes([
      { cle: "a", rdvId: "r1", receptionneLe: "2026-11-14", montantHt: 300 },
      { cle: "b", rdvId: "r1", receptionneLe: "2026-11-14", montantHt: 65 },
      { cle: "c", rdvId: "r2", receptionneLe: "2026-11-10", montantHt: 150 },
      { cle: "d", rdvId: "r3", receptionneLe: null, montantHt: 900 },
    ]);
    expect(r).toEqual({ nb: 2, ht: 515 });
  });
});

describe("doublons de chantier", () => {
  const l = (cle: string, rdvId: string, attId: string, ts = false) => ({ cle, rdvId, attId, attNumero: attId, ts });
  it("un attachement + son TS n'est pas un doublon", () => {
    expect(doublonsChantier([l("1", "r1", "AT-22"), l("2", "r1", "AT-76", true)]).size).toBe(0);
  });
  it("deux attachements ordinaires du même chantier = doublon signalé des deux côtés", () => {
    const d = doublonsChantier([l("1", "r1", "AT-70"), l("2", "r1", "AT-71")]);
    expect(d.get("1")).toEqual(["AT-71"]);
    expect(d.get("2")).toEqual(["AT-70"]);
  });
});

describe("numéro de commande", () => {
  it("garde un vrai numéro", () => expect(numeroCommandeValide(" CST 02048152 ")).toBe("CST 02048152"));
  it("écarte un nom ou un numéro d'attachement mal lu", () => {
    expect(numeroCommandeValide("GLAIS")).toBeNull();
    expect(numeroCommandeValide("AT-2026-0082")).toBeNull();
  });
});

describe("nom du donneur d'ordre", () => {
  it("ENSIO SAS, Ensio et ENSIO sont le même client", () => {
    expect(nomDonneur("ENSIO SAS")).toBe("ENSIO");
    expect(nomDonneur("Ensio")).toBe("ENSIO");
    expect(nomDonneur(" ENSIO ")).toBe("ENSIO");
  });
  it("garde deux clients différents séparés", () => expect(nomDonneur("INFRATEL SERVICES")).not.toBe(nomDonneur("ENSIO")));
});

describe("réceptionnés sans commande", () => {
  const l = (rdvId: string | null, receptionneLe: string | null, commande: string | null) => ({ rdvId, receptionneLe, commande });
  it("signale un chantier réceptionné sans aucune commande", () => {
    expect([...receptionnesSansCommande([l("r1", "2026-11-14", null)])]).toEqual(["r1"]);
  });
  it("un TS sans numéro hérite de la commande de l'attachement initial", () => {
    expect(receptionnesSansCommande([l("r1", "2026-11-14", "CST 02048154"), l("r1", "2026-11-14", null)]).size).toBe(0);
  });
  it("ignore les chantiers non réceptionnés", () => {
    expect(receptionnesSansCommande([l("r2", null, null)]).size).toBe(0);
  });
});
