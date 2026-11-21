import { describe, expect, it } from "bun:test";
import { motifRappel, preparerRappel } from "./rappel-client";
import type { LigneSuivi } from "./etape-chantier";

const l = (cle: string, etape: LigneSuivi["etape"], montantHt: number, extra: Partial<LigneSuivi> = {}): LigneSuivi => ({
  cle, rdvId: cle, attId: `att-${cle}`, attNumero: `AT-${cle}`, ts: false, client: cle, donneur: "ENSIO", ville: null, date: null, montantHt,
  commande: null, receptionneLe: null, factureId: null, factureNumero: null, deposeLe: null, payeLe: null, envoyeLe: null,
  consulteLe: null, derniereConsultation: null, vues: 0, valideLe: null, statutPlanning: "termine", etape, recuSansCommande: false, ...extra,
});

describe("rappel client", () => {
  it("attend la commande aux étapes 3 et 4, la réception à l'étape 6", () => {
    expect(motifRappel({ etape: 3 })).toBe("commande");
    expect(motifRappel({ etape: 4 })).toBe("commande");
    expect(motifRappel({ etape: 6 })).toBe("reception");
    expect(motifRappel({ etape: 5 })).toBeNull();
    expect(motifRappel({ etape: 7 })).toBeNull();
  });
  it("ne garde que les chantiers cochés en attente du client", () => {
    const r = preparerRappel([l("a", 4, 150), l("b", 6, 400), l("c", 5, 90), l("d", 3, 120)], ["a", "b", "c"]);
    expect(r.commandes.map((x) => x.cle)).toEqual(["a"]);
    expect(r.receptions.map((x) => x.cle)).toEqual(["b"]);
    expect(r.ignores).toBe(1);
    expect(r.totalCommandes).toBe(150);
    expect(r.totalReceptions).toBe(400);
  });
  it("ignore un chantier sans attachement", () => {
    expect(preparerRappel([l("a", 4, 150, { attId: null })], ["a"]).commandes).toEqual([]);
  });
});
