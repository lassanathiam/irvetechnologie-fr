import { describe, expect, it } from "bun:test";
import { detecterSourceLead } from "./lead-source";

const SITE = "https://irvetechnologie.fr";

describe("detecterSourceLead", () => {
  it("un clic sur une publicité Google (gclid) est classé Publicité Google", () => {
    expect(detecterSourceLead(`${SITE}/installation-borne-recharge/rennes?gclid=abc`, "https://www.google.com/").source).toEqual("google_ads");
  });
  it("une arrivée depuis la recherche Google est classée Recherche Google", () => {
    expect(detecterSourceLead(`${SITE}/`, "https://www.google.fr/").source).toEqual("google");
  });
  it("Facebook est classé Réseaux sociaux", () => {
    expect(detecterSourceLead(`${SITE}/`, "https://m.facebook.com/").source).toEqual("reseaux_sociaux");
  });
  it("sans site précédent, la visite est directe et garde la page d'arrivée", () => {
    const o = detecterSourceLead(`${SITE}/borne-recharge-professionnels`, "");
    expect(o.source).toEqual("direct");
    expect(o.page).toEqual("/borne-recharge-professionnels");
  });
  it("le nom de campagne est conservé", () => {
    expect(detecterSourceLead(`${SITE}/?utm_source=google&utm_medium=cpc&utm_campaign=bretagne`, null).campagne).toEqual("bretagne");
  });
});
