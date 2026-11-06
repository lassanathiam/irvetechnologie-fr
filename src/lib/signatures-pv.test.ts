import { describe, expect, it as test } from "bun:test";
import { fusionnerSignatures } from "./signatures-pv";

const NOW = "2026-11-06T17:00:00.000Z";

describe("conservation des signatures du PV", () => {
  test("un enregistrement sans signature ne supprime pas celles déjà posées", () => {
    const r = fusionnerSignatures(
      { signature_client: "C", signature_technicien: "T", signed_at: "2026-11-05T10:00:00.000Z" },
      { signature_client: null, signature_technicien: null },
      NOW,
    );
    expect(r).toEqual({ signature_client: "C", signature_technicien: "T", signed_at: "2026-11-05T10:00:00.000Z" });
  });

  test("la date de signature d'origine est gardée", () => {
    const r = fusionnerSignatures({ signature_client: "C", signature_technicien: "T", signed_at: "2026-11-05T10:00:00.000Z" }, { signature_client: "C", signature_technicien: "T" }, NOW);
    expect(r.signed_at).toEqual("2026-11-05T10:00:00.000Z");
  });

  test("le PV devient signé quand la deuxième signature arrive", () => {
    const r = fusionnerSignatures({ signature_client: "C", signature_technicien: null, signed_at: null }, { signature_technicien: "T" }, NOW);
    expect(r.signed_at).toEqual(NOW);
  });

  test("une seule signature : pas encore signé", () => {
    const r = fusionnerSignatures(null, { signature_technicien: "T" }, NOW);
    expect(r.signed_at).toEqual(null);
  });

  test("une nouvelle signature remplace l'ancienne", () => {
    const r = fusionnerSignatures({ signature_client: "C1", signature_technicien: "T", signed_at: NOW }, { signature_client: "C2" }, NOW);
    expect(r.signature_client).toEqual("C2");
  });
});
