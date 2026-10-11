import { describe, it, expect } from "bun:test";
import { pvPourReseau } from "./rapport-modeles";

describe("PV selon le client du chantier", () => {
  it("50FIVE → PV 50FIVE", () => expect(pvPourReseau("50FIVE")).toEqual({ kind: "pv", cle: "50FIVE" }));
  it("TIME2PLUG → PV Time2plug", () => expect(pvPourReseau("Time2plug")).toEqual({ kind: "pv", cle: "TIME2PLUG" }));
  it("CAP'BORNES → PV ENSIO", () => expect(pvPourReseau("CAP BORNES")).toEqual({ kind: "pv", cle: "ENSIO" }));
  it("AMARA → PV ENSIO", () => expect(pvPourReseau("AMARA")).toEqual({ kind: "pv", cle: "ENSIO" }));
  it("BUMP → Kizéo", () => expect(pvPourReseau("BUMP")).toEqual({ kind: "crm", outil: "Kizéo" }));
  it("DKV → Docusign", () => expect(pvPourReseau("DKV")).toEqual({ kind: "crm", outil: "Docusign" }));
});

import { valeursConformite } from "./rapport-modeles";
describe("PV pré-cochés conformes", () => {
  const st = (ids: string[]) => ({ titre: "", sections: [{ titre: "", champs: ids.map((id) => ({ id, label: id, type: "texte" as const })) }] });
  it("ENSIO : finale, acceptée, sans réserve", () =>
    expect(valeursConformite(st(["reception_finale", "prestation_acceptee", "reserves"]), "01/10/2026")).toEqual({ reception_finale: true, prestation_acceptee: "oui", reserves: "non" }));
  it("Time2plug : sans réserve à la date", () =>
    expect(valeursConformite(st(["reception_sans_reserve", "date_effet_sans_reserve"]), "01/10/2026")).toEqual({ reception_sans_reserve: true, date_effet_sans_reserve: "01/10/2026" }));
});

import { couplesSerrage, avecCouples } from "./rapport-checklist";
describe("couples de serrage", () => {
  it("6 mm² → 2,5 N·m borne", () => expect(couplesSerrage("3G6").couple_borne).toEqual("2,5"));
  it("10 mm² → 3 N·m protections", () => expect(couplesSerrage("5G10").couple_protections).toEqual("3"));
  it("ne remplace pas une saisie", () => expect(avecCouples({ couple_borne: "1,8" }).couple_borne).toEqual("1,8"));
});
