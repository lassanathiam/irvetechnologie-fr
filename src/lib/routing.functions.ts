/**
 * Itinéraires routiers réels (réseau routier OSRM / OpenStreetMap).
 * Remplace les estimations à vol d'oiseau : distances, durées et tracés réels.
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { BASE, haversineKm } from "@/lib/geo";

const OSRM = "https://router.project-osrm.org";

const point = z.object({
  id: z.string(),
  lat: z.number(),
  lng: z.number(),
  label: z.string().max(160).optional(),
  sub: z.string().max(160).nullable().optional(),
});

export type RoutePoint = z.infer<typeof point>;

export type Itineraire = {
  km: number;
  minutes: number;
  /** Tracé réel [lat, lng] prêt pour Leaflet. */
  coords: [number, number][];
  /** true si le réseau routier n'a pas répondu (valeur estimée). */
  estime: boolean;
};

const lonlat = (p: { lat: number; lng: number }) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`;

async function osrm(path: string): Promise<Record<string, unknown> | null> {
  try {
    const res = await fetch(`${OSRM}${path}`, {
      headers: { accept: "application/json" },
      signal: AbortSignal.timeout(9000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, unknown>;
    return json["code"] === "Ok" ? json : null;
  } catch {
    return null;
  }
}

const toCoords = (geometry: unknown): [number, number][] => {
  const c = (geometry as { coordinates?: [number, number][] } | undefined)?.coordinates ?? [];
  return c.map(([lng, lat]) => [lat, lng] as [number, number]);
};

const baseSchema = z
  .object({ lat: z.number(), lng: z.number() })
  .optional()
  .nullable();

/** Itinéraire routier réel entre le point de départ du technicien et un chantier. */
export const itineraireDepuisBase = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z.object({ lat: z.number(), lng: z.number(), base: baseSchema }).parse(d),
  )
  .handler(async ({ data }): Promise<Itineraire> => {
    const from = data.base ?? BASE;
    const json = await osrm(
      `/route/v1/driving/${lonlat(from)};${lonlat(data)}?overview=full&geometries=geojson`,
    );
    const route = (json?.["routes"] as { distance: number; duration: number; geometry: unknown }[] | undefined)?.[0];
    if (!route) {
      const km = Math.round(haversineKm(from, data) * 1.18);
      return {
        km,
        minutes: Math.round((km / 80) * 60),
        coords: [
          [from.lat, from.lng],
          [data.lat, data.lng],
        ],
        estime: true,
      };
    }
    return {
      km: Math.round(route.distance / 100) / 10,
      minutes: Math.round(route.duration / 60),
      coords: toCoords(route.geometry),
      estime: false,
    };
  });


export type TourneeReelle = {
  etapes: { id: string; ordre: number; km: number; minutes: number; label: string; sub?: string | null }[];
  kmTotal: number;
  minutes: number;
  /** Km cumulés si chaque chantier était fait en aller-retour depuis la base. */
  kmSepares: number;
  coords: [number, number][];
  estime: boolean;
};

/**
 * Tournée optimisée sur le réseau routier réel (boucle depuis la base, retour base).
 * Repli sur une heuristique plus proche voisin si le service de calcul est indisponible.
 */
export const tourneeReelle = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ stops: z.array(point).max(12), base: baseSchema }).parse(d))
  .handler(async ({ data }): Promise<TourneeReelle> => {
    const stops = data.stops;
    const from = data.base ?? BASE;
    if (!stops.length)
      return { etapes: [], kmTotal: 0, minutes: 0, kmSepares: 0, coords: [], estime: false };

    const coordsParam = [from, ...stops].map(lonlat).join(";");
    const json =
      stops.length > 1
        ? await osrm(
            `/trip/v1/driving/${coordsParam}?source=first&roundtrip=true&overview=full&geometries=geojson`,
          )
        : await osrm(
            `/route/v1/driving/${coordsParam};${lonlat(from)}?overview=full&geometries=geojson`,
          );

    const trip = (json?.["trips"] ?? json?.["routes"]) as
      | { distance: number; duration: number; geometry: unknown; legs: { distance: number; duration: number }[] }[]
      | undefined;
    const t = trip?.[0];

    const kmSepares = Math.round(
      stops.reduce((sum, s) => sum + haversineKm(from, s) * 1.18 * 2, 0),
    );

    if (!t) {
      // Repli : plus proche voisin à vol d'oiseau majoré du facteur routier.
      const restants = [...stops];
      let cur: { lat: number; lng: number } = from;
      let kmTotal = 0;
      const etapes: TourneeReelle["etapes"] = [];
      while (restants.length) {
        let bi = 0;
        let bk = Infinity;
        restants.forEach((s, i) => {
          const k = haversineKm(cur, s);
          if (k < bk) {
            bk = k;
            bi = i;
          }
        });
        const s = restants.splice(bi, 1)[0]!;
        const km = Math.round(bk * 1.18);
        kmTotal += km;
        etapes.push({
          id: s.id,
          ordre: etapes.length + 1,
          km,
          minutes: Math.round((km / 80) * 60),
          label: s.label ?? "",
          sub: s.sub ?? null,
        });
        cur = s;
      }
      kmTotal += Math.round(haversineKm(cur, from) * 1.18);
      return {
        etapes,
        kmTotal,
        minutes: Math.round((kmTotal / 80) * 60),
        kmSepares,
        coords: [[from.lat, from.lng], ...etapes.map((e) => {
          const s = stops.find((x) => x.id === e.id)!;
          return [s.lat, s.lng] as [number, number];
        }), [from.lat, from.lng]],
        estime: true,
      };
    }

    // Ordre de passage renvoyé par le service (waypoint_index dans l'ordre du trajet).
    const waypoints = (json?.["waypoints"] as { waypoint_index: number }[] | undefined) ?? [];
    const ordonne = stops
      .map((s, i) => ({ s, wi: waypoints[i + 1]?.waypoint_index ?? i + 1 }))
      .sort((a, b) => a.wi - b.wi)
      .map((x) => x.s);

    const legs = t.legs ?? [];
    const etapes = ordonne.map((s, i) => ({
      id: s.id,
      ordre: i + 1,
      km: Math.round((legs[i]?.distance ?? 0) / 100) / 10,
      minutes: Math.round((legs[i]?.duration ?? 0) / 60),
      label: s.label ?? "",
      sub: s.sub ?? null,
    }));

    return {
      etapes,
      kmTotal: Math.round(t.distance / 1000),
      minutes: Math.round(t.duration / 60),
      kmSepares,
      coords: toCoords(t.geometry),
      estime: false,
    };
  });
