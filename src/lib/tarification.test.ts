import { describe, expect, it } from "bun:test";
import {
  analyserMarge,
  COUTS_DEFAUT,
  palierPourDistance,
  prixMinimumTtc,
  prixRevientHt,
  ttcVersHt,
  type CoutsReference,
} from "./tarification";

const couts: CoutsReference = {
  protections_mono_ht: 100,
  protections_tri_ht: 180,
  cable_mono_m_ht: 6,
  cable_tri_m_ht: 9,
  fournitures_ht: 40,
  temps_pose_h: 4,
  minutes_par_metre_supp: 6,
  cout_horaire_ht: 40,
  deplacement_ht: 50,
  publicite_par_client_ht: 30,
};

describe("forfaits de câble", () => {
  it("choisit le forfait 5, 10, 15 ou 20 m selon la distance", () => {
    expect(palierPourDistance(3)).toBe(5);
    expect(palierPourDistance(5)).toBe(5);
    expect(palierPourDistance(7)).toBe(10);
    expect(palierPourDistance(15)).toBe(15);
    expect(palierPourDistance(18)).toBe(20);
  });
  it("au-delà de 20 m : étude personnalisée, pas de prix automatique", () => {
    expect(palierPourDistance(21)).toBeNull();
  });
});

describe("règle des 500 € de marge", () => {
  it("prix TTC minimum = (prix de revient HT + 500 €) × 1,20", () => {
    expect(prixMinimumTtc(800)).toBe(1560);
  });
  it("TVA de référence 20 % : 1 299 € TTC = 1 082,50 € HT", () => {
    expect(ttcVersHt(1299)).toBe(1082.5);
  });
  it("calcule le prix de revient réel avec la pub à 30 € et le temps de câble en plus", () => {
    const r = prixRevientHt({
      achat: { prix_achat_ht: 700, remise_pct: 0, frais_livraison_ht: 0 },
      couts,
      phase: "mono",
      metres: 10,
    });
    // 700 + 100 + 60 + 40 + (4 h + 5 m × 6 min) × 40 € + 50 + 30
    expect(r.total_ht).toBe(700 + 100 + 60 + 40 + 180 + 50 + 30);
  });
  it("signale une marge insuffisante sous 500 €", () => {
    const r = prixRevientHt({
      achat: { prix_achat_ht: 700, remise_pct: 0, frais_livraison_ht: 0 },
      couts,
      phase: "mono",
      metres: 10,
    });
    const a = analyserMarge(1350, r);
    expect(a.marge_ht).toBe(1125 - 1160);
    expect(a.suffisante).toBe(false);
  });
  it("accepte une marge d'au moins 500 €", () => {
    const r = prixRevientHt({
      achat: { prix_achat_ht: 700, remise_pct: 0, frais_livraison_ht: 0 },
      couts,
      phase: "mono",
      metres: 10,
    });
    expect(analyserMarge(prixMinimumTtc(r.total_ht!), r).suffisante).toBe(true);
  });
  it("sans prix d'achat confirmé, la marge n'est jamais considérée suffisante", () => {
    const r = prixRevientHt({ achat: null, couts, phase: "mono", metres: 5 });
    expect(r.total_ht).toBeNull();
    expect(analyserMarge(5000, r).suffisante).toBe(false);
  });
  it("les coûts non renseignés rendent la marge provisoire", () => {
    const r = prixRevientHt({
      achat: { prix_achat_ht: 700, remise_pct: 0, frais_livraison_ht: 0 },
      couts: COUTS_DEFAUT,
      phase: "mono",
      metres: 5,
    });
    expect(analyserMarge(3000, r).provisoire).toBe(true);
  });
});
