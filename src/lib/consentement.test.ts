import { describe, expect, it } from "bun:test";
import { analyserChoix, autoriseMesure, autorisePublicite, VERSION_NOTICE_CONSENTEMENT } from "./consentement";

const choix = (mesure: boolean, publicite: boolean) =>
  JSON.stringify({ version: VERSION_NOTICE_CONSENTEMENT, date: "2026-11-10T18:00:00Z", mesure, publicite });

describe("consentement des visiteurs", () => {
  it("sans réponse, rien n'est mesuré ni envoyé pour la publicité", () => {
    expect(autoriseMesure(analyserChoix(null))).toEqual(false);
    expect(autorisePublicite(analyserChoix(null), false)).toEqual(false);
  });
  it("un refus bloque la mesure et la publicité", () => {
    const c = analyserChoix(choix(false, false));
    expect(autoriseMesure(c)).toEqual(false);
    expect(autorisePublicite(c, false)).toEqual(false);
  });
  it("accepter la mesure seule n'autorise pas la publicité", () => {
    const c = analyserChoix(choix(true, false));
    expect(autoriseMesure(c)).toEqual(true);
    expect(autorisePublicite(c, false)).toEqual(false);
  });
  it("Global Privacy Control bloque la publicité même après acceptation", () => {
    expect(autorisePublicite(analyserChoix(choix(true, true)), true)).toEqual(false);
    expect(autorisePublicite(analyserChoix(choix(true, true)), false)).toEqual(true);
  });
  it("un accord donné sur une ancienne notice est redemandé", () => {
    const ancien = JSON.stringify({ version: "2020-01-01", date: "2020-01-01", mesure: true, publicite: true });
    expect(analyserChoix(ancien)).toEqual(null);
  });
});
