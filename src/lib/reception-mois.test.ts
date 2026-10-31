import { expect, it } from "bun:test";
import {
  cleMoisReception,
  grouperReceptionParMois,
  libelleMoisReception,
  moisAAfficher,
  totalReceptionne,
} from "./reception-mois";

// Référence fixes : 31 octobre 2026, pour que les mois affichés ne dépendent pas de la date du jour.
const REF = new Date(2026, 9, 31, 12);

const chantiers = [
  { receptionne_at: "2026-10-31T08:00:00.000Z", montant_ht: 365 },
  { receptionne_at: "2026-10-31T10:00:00.000Z", montant_ht: "300.5" },
  { receptionne_at: "2026-08-12T09:00:00.000Z", montant_ht: 1200 },
  { receptionne_at: null, montant_ht: 999 },
];

it("clé le mois de réception", () => {
  expect(cleMoisReception("2026-10-31T08:00:00.000Z")).toEqual("2026-10");
});

it("écrit le mois en français", () => {
  expect(libelleMoisReception("2026-08")).toEqual("Août 2026");
});

it("affiche août même sans chantier réceptionné ce mois-là", () => {
  const mois = grouperReceptionParMois(chantiers, 6, REF).map((m) => m.cle);
  expect(mois).toContain("2026-08");
  expect(mois[0]).toEqual("2026-10");
});

it("compte et somme les chantiers réceptionnés de chaque mois", () => {
  const groupes = grouperReceptionParMois(chantiers, 6, REF);
  const octobre = groupes.find((m) => m.cle === "2026-10");
  const aout = groupes.find((m) => m.cle === "2026-08");
  const juillet = groupes.find((m) => m.cle === "2026-07");
  expect(octobre?.nb).toEqual(2);
  expect(octobre?.total_ht).toEqual(665.5);
  expect(aout?.nb).toEqual(1);
  expect(aout?.total_ht).toEqual(1200);
  expect(juillet?.nb).toEqual(0);
  expect(juillet?.total_ht).toEqual(0);
});

it("ne compte pas un chantier non réceptionné dans le total", () => {
  expect(totalReceptionne(chantiers)).toEqual(1865.5);
});

it("garde un mois ancien même hors des six derniers", () => {
  const avecJanvier = [...chantiers, { receptionne_at: "2026-01-05T09:00:00.000Z", montant_ht: 500 }];
  expect(moisAAfficher(avecJanvier, 6, REF)).toContain("2026-01");
});
