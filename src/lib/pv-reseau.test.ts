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
