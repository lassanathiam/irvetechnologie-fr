import { expect, it } from "bun:test";
import { etapeAttachement, prochainChamp } from "./suivi-facturation";

it("chantier sans attachement", () => {
  expect(etapeAttachement(null)).toEqual("sans_attachement");
});
it("attachement non déposé", () => {
  expect(etapeAttachement({})).toEqual("attachement");
});
it("envoyé en facturation l'emporte sur déposé", () => {
  expect(etapeAttachement({ depose_at: "2026-10-01", envoye_facturation_at: "2026-10-02" })).toEqual("envoye_facturation");
});
it("après déposé, la case suivante est Envoyé en facturation", () => {
  expect(prochainChamp("depose")?.champ).toEqual("envoye_facturation_at");
});
it("payé n'a plus d'étape", () => {
  expect(prochainChamp("paye")).toEqual(null);
});
