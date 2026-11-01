import { describe, expect, it } from "bun:test";
import {
  dansPeriode,
  periodeDepuisCle,
  totauxParClient,
  type FacturePourTotal,
} from "./factures-par-client";

const f = (
  numero: string,
  client_nom: string,
  date_emission: string,
  total_ht: number,
  total_ttc: number,
  statut = "envoyee",
): FacturePourTotal => ({
  id: numero,
  numero,
  client_nom,
  objet: null,
  statut,
  total_ht,
  total_ttc,
  date_emission,
});

// 1er novembre 2026 : « mois dernier » = octobre 2026.
const AUJOURDHUI = new Date(2026, 10, 1);

const FACTURES: FacturePourTotal[] = [
  f("F-2026-0001", "ENSIO", "2026-09-30", 1000, 1200),
  f("F-2026-0002", "ENSIO", "2026-10-05", 2000, 2400, "payee"),
  f("F-2026-0003", "ENSIO", "2026-10-20", 500, 600),
  f("F-2026-0004", "NCO", "2026-10-11", 300, 360),
  f("F-2026-0005", "ENSIO", "2026-10-25", 999, 1199, "annulee"),
  f("F-2026-0006", "  ensio  ", "2026-10-26", 100, 120),
];

describe("période de facturation", () => {
  it("« depuis le début » ne borne aucune date", () => {
    expect(periodeDepuisCle("tout", AUJOURDHUI)).toEqual({
      du: null,
      au: null,
      libelle: "Depuis le début",
    });
  });
  it("« mois dernier » couvre tout octobre 2026", () => {
    const p = periodeDepuisCle("mois_precedent", AUJOURDHUI);
    expect(p).toEqual({ du: "2026-10-01", au: "2026-10-31", libelle: "Octobre 2026" });
    expect(dansPeriode("2026-10-01", p)).toBeTrue();
    expect(dansPeriode("2026-10-31", p)).toBeTrue();
    expect(dansPeriode("2026-11-01", p)).toBeFalse();
    expect(dansPeriode("2026-09-30", p)).toBeFalse();
  });
  it("« ce mois-ci » couvre novembre 2026", () => {
    expect(periodeDepuisCle("mois_courant", AUJOURDHUI)).toEqual({
      du: "2026-11-01",
      au: "2026-11-30",
      libelle: "Novembre 2026",
    });
  });
  it("une période personnalisée garde les dates choisies", () => {
    const p = periodeDepuisCle("personnalise", AUJOURDHUI, "2026-08-15", "2026-09-02");
    expect(p.du).toEqual("2026-08-15");
    expect(p.au).toEqual("2026-09-02");
    expect(dansPeriode("2026-08-14", p)).toBeFalse();
    expect(dansPeriode("2026-09-02", p)).toBeTrue();
  });
});

describe("total par client", () => {
  it("additionne toutes les factures d'un client depuis le début", () => {
    const ensio = totauxParClient(FACTURES, periodeDepuisCle("tout", AUJOURDHUI)).find(
      (x) => x.nom === "ENSIO",
    );
    expect(ensio?.nb).toEqual(4);
    expect(ensio?.ht).toEqual(3600);
    expect(ensio?.ttc).toEqual(4320);
    expect(ensio?.nbPayees).toEqual(1);
    expect(ensio?.htPaye).toEqual(2000);
    expect(ensio?.ttcPaye).toEqual(2400);
  });

  it("ne compte que les factures d'octobre quand la période est octobre", () => {
    const t = totauxParClient(FACTURES, periodeDepuisCle("mois_precedent", AUJOURDHUI));
    const ensio = t.find((x) => x.nom === "ENSIO");
    expect(ensio?.nb).toEqual(3);
    expect(ensio?.ht).toEqual(2600);
    expect(t.find((x) => x.nom === "NCO")?.ht).toEqual(300);
  });

  it("réunit les mêmes écrits de nom (« ensio » et « ENSIO ») en une seule ligne", () => {
    const t = totauxParClient(FACTURES, periodeDepuisCle("mois_precedent", AUJOURDHUI));
    expect(t.filter((x) => x.nom.toUpperCase() === "ENSIO").length).toEqual(1);
  });

  it("écarte les factures annulées", () => {
    const t = totauxParClient(FACTURES, periodeDepuisCle("mois_precedent", AUJOURDHUI));
    expect(t.find((x) => x.nom === "ENSIO")?.factures.map((x) => x.numero)).toEqual([
      "F-2026-0006",
      "F-2026-0003",
      "F-2026-0002",
    ]);
  });

  it("classe le plus gros client en premier et liste ses factures de la plus récente à la plus ancienne", () => {
    const t = totauxParClient(FACTURES, periodeDepuisCle("tout", AUJOURDHUI));
    expect(t[0].nom).toEqual("ENSIO");
    expect(t[0].factures.map((x) => x.numero)).toEqual([
      "F-2026-0006",
      "F-2026-0003",
      "F-2026-0002",
      "F-2026-0001",
    ]);
  });

  it("range les factures sans nom de client dans une ligne à part", () => {
    const t = totauxParClient(
      [...FACTURES, f("F-2026-0007", "", "2026-10-28", 50, 60)],
      periodeDepuisCle("mois_precedent", AUJOURDHUI),
    );
    expect(t.find((x) => x.nom === "Client non renseigné")?.ht).toEqual(50);
  });
});
