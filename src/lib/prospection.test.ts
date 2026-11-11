import { describe, expect, it } from "bun:test";
import { finaliserCorps, lienMailto, dateRelance, etatEnvoi, envoiPermis, blocageDoublon, objetPourEnvoi, type ProspectSuivi } from "./prospection";

const base: ProspectSuivi = { id: "a", entreprise: "A", statut: "a_envoyer", email: "contact@a.fr", telephone: null, site_web: null, envoye_le: null, relance_le: null, nb_envois: 0, mail_ouvert_le: null };

describe("prospection", () => {
  it("chaque mail porte le téléphone 07 68 08 43 67 et l'adresse de contact", () => {
    const t = finaliserCorps("Bonjour");
    expect(t).toContain("07 68 08 43 67");
    expect(t).toContain("contacts@irvetechnologie.fr");
  });
  it("chaque mail propose de répondre STOP", () => {
    expect(finaliserCorps("Bonjour")).toContain("STOP");
  });
  it("un prospect en STOP ne peut plus recevoir de mail", () => {
    expect(lienMailto({ email: "contact@exemple.fr", statut: "stop", objet: "x", corps: "y" })).toEqual(null);
  });
  it("relance prévue 7 jours après l'envoi", () => {
    expect(dateRelance(new Date("2026-11-11T20:00:00Z"))).toEqual("2026-11-18");
  });
  it("un prospect déjà envoyé ne se renvoie pas avant la date de relance", () => {
    const p = { ...base, statut: "envoye" as const, nb_envois: 1, envoye_le: "2026-11-11T20:00:00Z", relance_le: "2026-11-18" };
    expect(etatEnvoi(p, "2026-11-12")).toEqual("deja_envoye");
    expect(envoiPermis(p, "2026-11-12")).toEqual(false);
    expect(envoiPermis(p, "2026-11-18")).toEqual(true);
  });
  it("un mail ouvert mais pas confirmé demande confirmation", () => {
    expect(etatEnvoi({ ...base, mail_ouvert_le: "2026-11-11T21:00:00Z" }, "2026-11-11")).toEqual("a_confirmer");
  });
  it("même email qu'une fiche en STOP : envoi bloqué", () => {
    const stop = { ...base, id: "b", statut: "stop" as const, email: "CONTACT@a.fr " };
    expect(blocageDoublon(base, [base, stop])?.type).toEqual("stop");
  });
  it("même entreprise déjà contactée via une autre fiche : signalée", () => {
    const autre = { ...base, id: "b", email: null, site_web: "https://www.a.fr", nb_envois: 1 };
    expect(blocageDoublon({ ...base, site_web: "a.fr" }, [autre])?.type).toEqual("deja_contacte");
  });
  it("une relance porte « Relance — » dans l'objet", () => {
    expect(objetPourEnvoi("Bornes", 1)).toEqual("Relance — Bornes");
    expect(objetPourEnvoi("Bornes", 0)).toEqual("Bornes");
  });
});
