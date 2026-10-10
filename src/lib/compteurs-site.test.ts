import { expect, test } from "bun:test";
import { compter } from "./compteurs-site.functions";

test("compte seulement les chantiers terminés, ajoute le chiffre de départ", () => {
  const r = compter(
    [
      { type: "installation", statut: "termine", etiquettes: [] },
      { type: "installation", statut: "realise", etiquettes: ["B2B"] },
      { type: "installation", statut: "planifie", etiquettes: [] },
      { type: "sav", statut: "realise", etiquettes: [] },
    ],
    { b2c: 20, b2b: 5, maintenance: 3 },
  );
  expect(r).toEqual({ b2c: 21, b2b: 6, maintenance: 4 });
});
