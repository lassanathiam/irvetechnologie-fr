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
