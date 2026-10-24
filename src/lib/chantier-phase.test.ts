import { describe, expect, it } from "bun:test";
import { estChantierTriphase } from "./chantier-phase";

describe("Repérage des chantiers triphasés", () => {
  it("signale les alimentations explicitement triphasées", () => {
    for (const phase of ["Triphasé", " TRIPHASÉ ", "Triphasée", "triphase", "tri", "Triphasé 400 V"]) {
      expect(estChantierTriphase({ phase_installation: phase })).toEqual(true);
    }
  });
  it("ne signale pas les chantiers monophasés", () => {
    expect(estChantierTriphase({ phase_installation: "Monophasé" })).toEqual(false);
  });
  it("ne transforme pas une alimentation inconnue ou contradictoire en triphasé", () => {
    for (const phase of [null, "", "À définir", "Monophasé ou triphasé", "distribution"]) {
      expect(estChantierTriphase({ phase_installation: phase })).toEqual(false);
    }
  });
});