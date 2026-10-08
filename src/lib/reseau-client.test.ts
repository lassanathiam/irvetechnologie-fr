import { describe, expect, it as test } from "bun:test";
import { nomReseauClient, precisionReseauClient } from "./reseau-client";

describe("client du donneur d’ordre", () => {
  test("conserve le nom lu, y compris les sigles incertains", () => {
    for (const nom of ["Bun", "Fifty Five", "Amara", "KV2", "KDB"]) {
      expect(nomReseauClient(` ${nom} `)).toEqual(nom);
    }
  });
  test("ne remplace pas un client absent par une marque supposée", () => {
    expect(nomReseauClient(null)).toEqual(null);
    expect(nomReseauClient(" ")).toEqual(null);
  });
  test("transmet le client à chaque installation de l’attachement", () => {
    expect(precisionReseauClient("Amara").includes("Amara")).toEqual(true);
    expect(precisionReseauClient("KDB").includes("KDB")).toEqual(true);
  });
});