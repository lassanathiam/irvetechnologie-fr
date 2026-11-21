import { describe, expect, it } from "bun:test";
import { attachementConsulte, attachementEnvoye, doublonsChantier, etapeChantier, numeroCommandeValide, nomDonneur, receptionnesSansCommande, recuSansCommande, resumeEtapes, totalReceptionnes } from "./etape-chantier";

const base = { attachement: true, envoye: true, commande: false, receptionne: false, facture: false, depose: false, paye: false };

describe("circuit unique du chantier en 7 étapes", () => {
  const base0 = { ...base, envoye: false };
  it("1 : chantier terminé sans attachement", () => expect(etapeChantier({ ...base0, attachement: false })).toBe(1));
  it("2 : attachement fait, pas encore envoyé", () => expect(etapeChantier(base0)).toBe(2));
  it("3 : envoyé mais pas encore consulté par le client", () => expect(etapeChantier(base)).toBe(3));
  it("4 : consulté par le client, commande attendue", () => expect(etapeChantier({ ...base, consulte: true })).toBe(4));
  it("4 : facturé alors que la commande manque encore", () => expect(etapeChantier({ ...base, facture: true })).toBe(4));
  it("5 : commande intégrée, à facturer (même déjà réceptionné)", () => {
    expect(etapeChantier({ ...base, consulte: true, commande: true })).toBe(5);
    expect(etapeChantier({ ...base, commande: true, receptionne: true })).toBe(5);
  });
  it("une commande reçue prouve l'envoi d'un attachement resté en brouillon", () => expect(etapeChantier({ ...base0, commande: true })).toBe(5));
  it("6 : facturé, à réceptionner", () => expect(etapeChantier({ ...base, commande: true, facture: true })).toBe(6));
  it("7 : réceptionné, à déposer dans le système du client", () => expect(etapeChantier({ ...base, commande: true, facture: true, receptionne: true })).toBe(7));
  it("ligne sans chantier : pas de réception, directement à déposer", () => expect(etapeChantier({ ...base, commande: true, facture: true, sansReception: true })).toBe(7));
  it("terminé : déposé après réception, ou payé", () => {
    expect(etapeChantier({ ...base, commande: true, facture: true, receptionne: true, depose: true })).toBe(8);
    expect(etapeChantier({ ...base, facture: true, paye: true })).toBe(8);
  });
  it("déposé mais pas réceptionné : reste à réceptionner", () => expect(etapeChantier({ ...base, commande: true, facture: true, depose: true })).toBe(6));
  it("réceptionné sans commande est signalé", () => expect(recuSansCommande({ ...base, receptionne: true })).toBe(true));
  it("consultation : lien ouvert ou attachement validé", () => {
    expect(attachementConsulte({ viewed_at: "2026-11-20" })).toBe(true);
    expect(attachementConsulte({ accepted_at: "2026-11-20" })).toBe(true);
    expect(attachementConsulte({ view_count: 0 })).toBe(false);
  });
  it("statut envoyé sans date compte comme envoyé", () => expect(attachementEnvoye({ statut: "envoye" })).toBe(true));
  it("brouillon jamais envoyé", () => expect(attachementEnvoye({ statut: "brouillon" })).toBe(false));
  it("totaux par étape", () => {
    const r = resumeEtapes([{ etape: 3, montantHt: 300 }, { etape: 3, montantHt: 65.5 }, { etape: 5, montantHt: 100 }]);
    expect(r[8]).toEqual({ nb: 0, ht: 0 });
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
