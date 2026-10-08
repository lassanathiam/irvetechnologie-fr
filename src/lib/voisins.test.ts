import { describe, expect, it } from "bun:test";
import { chantiersVoisins } from "./voisins";

// 1° de latitude ≈ 111 km
const cible = { id: "c", lat: 47, lng: -1.5 };
const aKm = (id: string, km: number) => ({ id, lat: 47 + km / 111.19, lng: -1.5 });

describe("chantiersVoisins", () => {
  it("propose les chantiers à moins de 50 km", () => {
    const r = chantiersVoisins(cible, [aKm("a", 30), aKm("b", 55)]);
    expect(r.map((v) => v.rdv.id)).toEqual(["a"]);
    expect(r[0].elargi).toEqual(false);
  });
  it("élargit à 60 km s'il n'y a rien à moins de 50 km", () => {
    const r = chantiersVoisins(cible, [aKm("b", 55), aKm("z", 70)]);
    expect(r.map((v) => v.rdv.id)).toEqual(["b"]);
    expect(r[0].elargi).toEqual(true);
  });
  it("ne propose rien au-delà de 60 km", () => {
    expect(chantiersVoisins(cible, [aKm("z", 65)])).toEqual([]);
  });
});
