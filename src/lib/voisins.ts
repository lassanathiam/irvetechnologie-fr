import { haversineKm } from "@/lib/geo";

/** Rayon de base, puis rayon élargi si rien n'est trouvé assez près. */
export const RAYON_VOISIN_KM = 50;
export const RAYON_VOISIN_ELARGI_KM = 60;

type Pos = { id: string; lat: number | string | null; lng: number | string | null };

export type Voisin<T> = { rdv: T; km: number; elargi: boolean };

/**
 * Chantiers à venir proches d'un chantier, même si les dates ne correspondent pas.
 * Cherche d'abord à moins de 50 km ; s'il n'y en a aucun, élargit à 60 km.
 */
export function chantiersVoisins<T extends Pos>(cible: Pos, candidats: T[], max = 5): Voisin<T>[] {
  if (cible.lat == null || cible.lng == null) return [];
  const a = { lat: Number(cible.lat), lng: Number(cible.lng) };
  const tous = candidats
    .filter((c) => c.id !== cible.id && c.lat != null && c.lng != null)
    .map((c) => ({ rdv: c, km: haversineKm(a, { lat: Number(c.lat), lng: Number(c.lng) }) }))
    .sort((x, y) => x.km - y.km);
  const proches = tous.filter((v) => v.km <= RAYON_VOISIN_KM);
  if (proches.length) return proches.slice(0, max).map((v) => ({ ...v, elargi: false }));
  return tous
    .filter((v) => v.km <= RAYON_VOISIN_ELARGI_KM)
    .slice(0, max)
    .map((v) => ({ ...v, elargi: true }));
}
