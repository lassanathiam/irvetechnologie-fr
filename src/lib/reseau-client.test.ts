import { describe, expect, it as test } from "bun:test";
import { detecterReseauClient, estLivraisonDirecte, nomReseauClient, precisionReseauClient } from "./reseau-client";

describe("client du donneur d’ordre", () => {
  test("conserve le nom lu, y compris les sigles incertains", () => {
    expect(nomReseauClient(" Fifty Five ")).toEqual("50FIVE");
    expect(nomReseauClient("Inconnu SA")).toEqual("Inconnu SA");
  });
  test("ne remplace pas un client absent par une marque supposée", () => {
    expect(nomReseauClient(null)).toEqual(null);
    expect(nomReseauClient(" ")).toEqual(null);
  });
  test("transmet le client à chaque installation de l’attachement", () => {
    expect(precisionReseauClient("Amara").includes("AMARA")).toEqual(true);
    expect(precisionReseauClient("DKV").includes("DKV")).toEqual(true);
  });
 test("DKV = borne livrée chez le client", () => {
    expect(estLivraisonDirecte("Borne de recharge — DKV")).toEqual(true);
    expect(estLivraisonDirecte("BUMP")).toEqual(false);
  });
  test("lit le donneur principal dans la désignation", () => {
    expect(detecterReseauClient("Borne de recharge — CAP BORNES")).toEqual("CAP BORNES");
    expect(detecterReseauClient("Borne triphasée - BUMP")).toEqual("BUMP");
  });
});
