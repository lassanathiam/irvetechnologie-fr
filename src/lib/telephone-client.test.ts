import { describe, expect, it } from "bun:test";
import { premierTelephoneClient, telephoneClient } from "./telephone-client";
import { lireRdvSansIA } from "./import-chantier-local";

describe("numéro du client à l'import", () => {
  it("ignore le numéro de l'entreprise et garde celui du client", () => {
    expect(premierTelephoneClient("SST IRVE TECHNOLOGIE 07 68 08 43 67\nClient : 06 12 34 56 78")).toEqual("0612345678");
  });
  it("ne met aucun numéro si seul celui de l'entreprise est présent", () => {
    expect(lireRdvSansIA("Client : WARIN\nAdresse : 3 rue des Pins\nSST IRVE TECHNOLOGIE +33 7 68 08 43 67")[0]?.client_telephone ?? null).toEqual(null);
  });
  it("retire le numéro de l'entreprise lu par l'IA", () => {
    expect(telephoneClient("0633657840")).toEqual(null);
    expect(telephoneClient("06 37 23 34 52")).toEqual("06 37 23 34 52");
  });
});
