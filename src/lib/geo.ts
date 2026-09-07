/** Techniciens et leur point de départ (domicile). */
export type Technicien = {
  id: string;
  nom: string;
  adresse: string;
  lat: number;
  lng: number;
  label: string;
};

export const TECHNICIENS: Technicien[] = [
  {
    id: "altaj",
    nom: "Altaj Mohamed",
    adresse: "36 rue Saint-Médard, 44300 Nantes",
    lat: 47.235974,
    lng: -1.499838,
    label: "Nantes",
  },
  {
    id: "lassana",
    nom: "Lassana Thiam",
    adresse: "280 rue des Chevaliers de Malte, 44522 Mésanger",
    lat: 47.433547,
    lng: -1.228373,
    label: "Mésanger",
  },
];

export const technicienByNom = (nom?: string | null) =>
  nom
    ? TECHNICIENS.find(
        (t) => t.nom.toLowerCase() === nom.trim().toLowerCase() || t.id === nom.trim().toLowerCase(),
      )
    : undefined;

/** Base opérationnelle par défaut (départ Nantes). */
export const BASE = { lat: 47.235974, lng: -1.499838, label: "Nantes" };


/** Bornes de la carte (France métropolitaine + Corse). */
const BOUNDS = { lngMin: -5.4, lngMax: 9.8, latMin: 41.2, latMax: 51.3 };

export const MAP_W = 500;
export const MAP_H = 520;

/** Projection équirectangulaire simple, suffisante à l'échelle de la France. */
export function project(lat: number, lng: number): { x: number; y: number } {
  const k = Math.cos((46.5 * Math.PI) / 180);
  const w = (BOUNDS.lngMax - BOUNDS.lngMin) * k;
  const h = BOUNDS.latMax - BOUNDS.latMin;
  const x = (((lng - BOUNDS.lngMin) * k) / w) * MAP_W;
  const y = ((BOUNDS.latMax - lat) / h) * MAP_H;
  return { x, y };
}

export function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Distance routière estimée (facteur 1,25) et temps de trajet depuis la base. */
export function trajetDepuisBase(lat: number, lng: number) {
  const km = Math.round(haversineKm(BASE, { lat, lng }) * 1.18);
  const min = km === 0 ? 10 : Math.round((km / 95) * 60) + 10;
  return { distance_km: km, duree_trajet_min: min };
}

export const dureeFr = (min: number) => {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h} h${m ? ` ${String(m).padStart(2, "0")}` : ""}` : `${m} min`;
};

/** Contour simplifié de la France métropolitaine (lat, lng). */
export const FRANCE_OUTLINE: Array<[number, number]> = [
  [51.05, 2.37], [50.95, 1.85], [50.12, 1.63], [49.7, 0.2], [49.72, -1.94],
  [48.64, -1.57], [48.72, -3.0], [48.72, -4.32], [47.8, -4.1], [47.5, -2.5],
  [47.2, -2.2], [46.5, -1.8], [45.6, -1.05], [44.7, -1.2], [43.4, -1.65],
  [42.85, 0.3], [42.5, 1.7], [42.45, 3.1], [43.35, 3.3], [43.4, 4.85],
  [43.3, 5.4], [43.1, 6.1], [43.55, 7.1], [43.75, 7.5], [44.3, 6.9],
  [45.1, 6.9], [45.9, 6.8], [46.4, 6.3], [47.0, 6.8], [47.6, 7.6],
  [48.6, 8.0], [49.0, 8.2], [49.5, 6.4], [49.9, 5.8], [50.35, 4.2],
  [50.75, 3.2],
];

/** Corse. */
export const CORSE_OUTLINE: Array<[number, number]> = [
  [43.0, 9.4], [42.6, 9.55], [41.9, 9.4], [41.37, 9.2], [41.7, 8.7], [42.4, 8.55],
];

export const toPath = (pts: Array<[number, number]>) =>
  pts
    .map(([lat, lng], i) => {
      const { x, y } = project(lat, lng);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ") + " Z";
