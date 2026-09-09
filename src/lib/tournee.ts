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
export function optimiserTournee(
  stops: TourneeStop[],
  base: { lat: number; lng: number } = BASE,
): {
  etapes: TourneeEtape[];
  kmTotal: number;
  kmDirect: number;
  minutes: number;
} {
  const restants = [...stops];
  const etapes: TourneeEtape[] = [];
  let courant = { lat: base.lat, lng: base.lng };
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
  const retour = etapes.length ? routier(haversineKm(courant, base)) : 0;
  kmTotal += retour;

  // Comparaison : aller-retour indépendant depuis la base pour chaque chantier
  const kmDirect = stops.reduce((t, s) => t + routier(haversineKm(base, s)) * 2, 0);

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

/* ------------------------------------------------------------------ */
/* Programmation : tournée par journée + campagne sur plusieurs jours  */
/* ------------------------------------------------------------------ */

export type JourCampagne = {
  jour: number;
  /** Ville principale du secteur visité ce jour-là. */
  secteur: string;
  stops: TourneeStop[];
  /** Km depuis l'étape précédente (ou la base pour le jour 1). */
  km: number;
  /** true quand la distance impose une nuit sur place (pas de retour le soir). */
  nuitee: boolean;
};

export type Campagne = {
  jours: JourCampagne[];
  kmTotal: number;
  /** Km cumulés si chaque chantier était fait en aller-retour depuis la base. */
  kmSepares: number;
  nuitees: number;
};

/**
 * Répartit des chantiers sur plusieurs journées : on regroupe les chantiers
 * proches (même secteur), puis on enchaîne les secteurs du plus proche au plus
 * éloigné. Au-delà de `rayonJournee` km de la base, la journée impose une nuitée
 * (impossible de faire l'aller-retour et d'intervenir le même jour).
 */
export function planifierCampagne(
  stops: TourneeStop[],
  base: { lat: number; lng: number } = BASE,
  options: { jours?: number; parJour?: number; rayonKm?: number; rayonJournee?: number } = {},
): Campagne {
  const { jours: maxJours = 365, parJour = 3, rayonKm = 45, rayonJournee = 150 } = options;
  if (!stops.length) return { jours: [], kmTotal: 0, kmSepares: 0, nuitees: 0 };

  // 1. Secteurs géographiques
  const secteurs = groupesProximite(stops, rayonKm);

  // 2. Enchaînement des secteurs au plus proche voisin depuis la base
  const restants = [...secteurs];
  const centre = (g: TourneeStop[]) => ({
    lat: g.reduce((t, s) => t + s.lat, 0) / g.length,
    lng: g.reduce((t, s) => t + s.lng, 0) / g.length,
  });
  const ordre: TourneeStop[][] = [];
  let courant: { lat: number; lng: number } = base;
  while (restants.length) {
    let bi = 0;
    let bk = Infinity;
    restants.forEach((g, i) => {
      const d = haversineKm(courant, centre(g));
      if (d < bk) {
        bk = d;
        bi = i;
      }
    });
    const g = restants.splice(bi, 1)[0]!;
    ordre.push(g);
    courant = centre(g);
  }

  // 3. Découpage en journées
  const joursPlan: JourCampagne[] = [];
  let position: { lat: number; lng: number } = base;
  let kmTotal = 0;

  for (const secteur of ordre) {
    const interne = optimiserTournee(secteur, centre(secteur)).etapes;
    for (let i = 0; i < interne.length; i += parJour) {
      if (joursPlan.length >= maxJours) break;
      const lot = interne.slice(i, i + parJour).map(({ ordre: _o, km: _k, ...s }) => s);
      const c = centre(lot);
      const km = routier(haversineKm(position, c));
      const depuisBase = routier(haversineKm(base, c));
      kmTotal += km;
      joursPlan.push({
        jour: joursPlan.length + 1,
        secteur: lot[0]?.sub || lot[0]?.label || "Secteur",
        stops: lot,
        km,
        nuitee: depuisBase > rayonJournee,
      });
      position = c;
    }
  }

  // Retour à la base en fin de campagne
  if (joursPlan.length) kmTotal += routier(haversineKm(position, base));

  const kmSepares = stops.reduce((t, s) => t + routier(haversineKm(base, s)) * 2, 0);
  return {
    jours: joursPlan,
    kmTotal,
    kmSepares,
    nuitees: joursPlan.filter((j) => j.nuitee).length,
  };
}
