import { describe, expect, it as test } from "bun:test";
import { aGarder, doublonsPour, pairesDoublons, raisonDoublon, supprimable, type AttPourDoublon } from "./doublons-attachement";

const att = (p: Partial<AttPourDoublon> & { id: string }): AttPourDoublon => ({
  numero: p.id, client_nom: "ENSIO SAS", statut: "brouillon", total_ht: 150, numero_ticket: "S47-2026", date_emission: "2026-11-21",
  facture_id: null, sent_at: null, attachement_initial_id: null, rendezvous_id: null, created_at: null,
  lignes: [{ libelle: "Maintenance", quantite: 1, prix_unitaire: 150, rendezvous_id: null }], ...p,
});
const ligne = (rdv: string | null) => [{ libelle: "Maintenance", quantite: 1, prix_unitaire: 150, rendezvous_id: rdv }];

describe("doublons d'attachements", () => {
  test("même chantier chez le même client = doublon", () => {
    expect(raisonDoublon(att({ id: "a", lignes: ligne("r1") }), att({ id: "b", client_nom: "Ensio", lignes: ligne("r1") }))).toEqual({ type: "chantier", chantiers: ["r1"] });
  });
  test("ligne sans chantier, même semaine, mêmes lignes et même montant = doublon", () => {
    expect(raisonDoublon(att({ id: "a" }), att({ id: "b", lignes: ligne("r1") }))).toEqual({ type: "identique" });
  });
  test("deux maintenances à 150 € sur deux chantiers différents ne sont pas un doublon", () => {
    expect(raisonDoublon(att({ id: "a", lignes: ligne("r1") }), att({ id: "b", lignes: ligne("r2") }))).toBeNull();
  });
  test("semaine différente = pas un doublon", () => {
    expect(raisonDoublon(att({ id: "a" }), att({ id: "b", numero_ticket: "S46-2026" }))).toBeNull();
  });
  test("un TS ou un annulé n'est jamais un doublon", () => {
    expect(raisonDoublon(att({ id: "a", lignes: ligne("r1") }), att({ id: "b", lignes: ligne("r1"), attachement_initial_id: "a" }))).toBeNull();
    expect(raisonDoublon(att({ id: "a", lignes: ligne("r1") }), att({ id: "b", lignes: ligne("r1"), statut: "annule" }))).toBeNull();
  });
  test("autre client = pas un doublon", () => {
    expect(raisonDoublon(att({ id: "a", lignes: ligne("r1") }), att({ id: "b", client_nom: "AXIANS", lignes: ligne("r1") }))).toBeNull();
  });
  test("on garde le facturé, puis l'envoyé, puis celui relié à un chantier", () => {
    expect(aGarder(att({ id: "a", lignes: ligne("r1") }), att({ id: "b", lignes: ligne("r1"), facture_id: "f" })).id).toEqual("b");
    expect(aGarder(att({ id: "a", lignes: ligne("r1") }), att({ id: "b", lignes: ligne("r1"), sent_at: "2026-11-21" })).id).toEqual("b");
    expect(aGarder(att({ id: "a" }), att({ id: "b", lignes: ligne("r1") })).id).toEqual("b");
  });
  test("à égalité on garde le plus ancien", () => {
    expect(aGarder(att({ id: "b", lignes: ligne("r1"), created_at: "2026-11-21T21:18" }), att({ id: "a", lignes: ligne("r1"), created_at: "2026-11-21T21:11" })).id).toEqual("a");
  });
  test("seul un brouillon jamais envoyé ni facturé se supprime", () => {
    expect(supprimable(att({ id: "a" }))).toEqual(true);
    expect(supprimable(att({ id: "a", sent_at: "2026-11-21" }))).toEqual(false);
    expect(supprimable(att({ id: "a", facture_id: "f" }))).toEqual(false);
  });
  test("paires et vérification avant création", () => {
    const liste = [att({ id: "a91", created_at: "1" }), att({ id: "a92", lignes: ligne("desmet"), created_at: "2" }), att({ id: "a99", lignes: ligne("warin"), created_at: "3" })];
    const p = pairesDoublons(liste);
    expect(p.map((x) => x.doublon.id)).toEqual(["a91", "a91"]);
    expect(doublonsPour(att({ id: "nouveau", lignes: ligne("desmet") }), liste).map((d) => d.attachement.id)).toEqual(["a91", "a92"]);
  });
});
