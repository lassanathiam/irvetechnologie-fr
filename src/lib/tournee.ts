/** Optimisation de tournée : ordre de passage au plus proche voisin depuis la base. */
import { BASE, haversineKm } from "@/lib/geo";

export type TourneeStop = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  sub?: string | null;
};

export type TourneeEtape = TourneeStop & {
  ordre: number;
  /** Distance routière estimée depuis l'étape précédente (ou la base). */
  km: number;
};

const routier = (km: number) => Math.round(km * 1.18);

/** Ordonne les étapes au plus proche voisin (heuristique rapide et stable). */
export function optimiserTournee(stops: TourneeStop[]): {
  etapes: TourneeEtape[];
  kmTotal: number;
  kmDirect: number;
  minutes: number;
} {
  const restants = [...stops];
  const etapes: TourneeEtape[] = [];
  let courant = { lat: BASE.lat, lng: BASE.lng };
  let kmTotal = 0;

  while (restants.length) {
    let best = 0;
    let bestKm = Infinity;
    restants.forEach((s, i) => {
      const d = haversineKm(courant, s);
      if (d < bestKm) {
        bestKm = d;
        best = i;
      }
    });
    const stop = restants.splice(best, 1)[0]!;
    const km = routier(bestKm);
    kmTotal += km;
    etapes.push({ ...stop, ordre: etapes.length + 1, km });
    courant = { lat: stop.lat, lng: stop.lng };
  }

  // Retour à la base
  const retour = etapes.length ? routier(haversineKm(courant, BASE)) : 0;
  kmTotal += retour;

  // Comparaison : aller-retour indépendant depuis la base pour chaque chantier
  const kmDirect = stops.reduce((t, s) => t + routier(haversineKm(BASE, s)) * 2, 0);

  return {
    etapes,
    kmTotal,
    kmDirect,
    minutes: Math.round((kmTotal / 80) * 60),
  };
}

/** Regroupe les chantiers proches (rayon en km) pour repérer les tournées possibles. */
export function groupesProximite(stops: TourneeStop[], rayonKm = 25): TourneeStop[][] {
  const restants = [...stops];
  const groupes: TourneeStop[][] = [];
  while (restants.length) {
    const seed = restants.shift()!;
    const groupe = [seed];
    for (let i = restants.length - 1; i >= 0; i--) {
      if (groupe.some((g) => haversineKm(g, restants[i]!) <= rayonKm)) {
        groupe.push(restants.splice(i, 1)[0]!);
      }
    }
    groupes.push(groupe);
  }
  return groupes.sort((a, b) => b.length - a.length);
}

/** Économie carburant estimée (l/100 km et prix au litre indicatifs). */
export function economieCarburant(kmEconomises: number, conso = 7.5, prixLitre = 1.85) {
  const litres = (kmEconomises * conso) / 100;
  return { litres: Math.round(litres * 10) / 10, euros: Math.round(litres * prixLitre) };
}
