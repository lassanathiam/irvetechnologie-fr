import { describe, expect, it } from "bun:test";
import { CHOIX_PERIODE_DEFAUT, correspondTexte, dateDansPeriode, periodeRecherche } from "./recherche-periode";

// Samedi 21 novembre 2026
const AUJ = new Date(2026, 10, 21, 12);
const c = (p: Partial<typeof CHOIX_PERIODE_DEFAUT>) => ({ ...CHOIX_PERIODE_DEFAUT, ...p });

describe("recherche par semaine, mois ou dates saisies", () => {
  it("cette semaine va du lundi au dimanche", () => {
    const p = periodeRecherche(c({ cle: "semaine_courante" }), AUJ);
    expect([p.du, p.au]).toEqual(["2026-11-16", "2026-11-22"]);
    expect(p.libelle).toContain("Semaine 47");
  });
  it("semaine dernière", () => {
    const p = periodeRecherche(c({ cle: "semaine_precedente" }), AUJ);
    expect([p.du, p.au]).toEqual(["2026-11-09", "2026-11-15"]);
  });
  it("semaine choisie à partir d'un jour", () => {
    const p = periodeRecherche(c({ cle: "semaine", semaine: "2026-10-01" }), AUJ);
    expect([p.du, p.au]).toEqual(["2026-09-28", "2026-10-04"]);
  });
  it("mois choisi et mois dernier", () => {
    const fev = periodeRecherche(c({ cle: "mois", mois: "2026-02" }), AUJ);
    expect([fev.du, fev.au]).toEqual(["2026-02-01", "2026-02-28"]);
    const oct = periodeRecherche(c({ cle: "mois_precedent" }), AUJ);
    expect([oct.du, oct.au]).toEqual(["2026-10-01", "2026-10-31"]);
  });
  it("dates saisies à la main, même inversées", () => {
    const p = periodeRecherche(c({ cle: "personnalise", du: "2026-11-10", au: "2026-11-03" }), AUJ);
    expect([p.du, p.au]).toEqual(["2026-11-03", "2026-11-10"]);
    expect(dateDansPeriode("2026-11-10", p)).toBe(true);
    expect(dateDansPeriode("2026-11-11", p)).toBe(false);
  });
  it("le texte ignore accents et majuscules", () => {
    expect(correspondTexte("leborgne cst", ["LEBORGNE Bruno", "CST 0204"])).toBe(true);
    expect(correspondTexte("glais", ["LEBORGNE Bruno"])).toBe(false);
  });
});
