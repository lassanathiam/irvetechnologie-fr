import { useEffect, useRef } from "react";

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  sub?: string | null;
  statut?: string | null;
  date?: string | null;
  /** Ex. "54 km · 48 min" — trajet routier depuis la base. */
  trajet?: string | null;
};

const BASE = { lat: 47.2184, lng: -1.5536, label: "Nantes" };

/** Couleurs de statut : orange = programmé, vert = réalisé / validé. */
export const STATUT_COLORS: Record<string, string> = {
  planifie: "#f59e0b",
  confirme: "#0284c7",
  realise: "#16a34a",
  annule: "#94a3b8",
};

/**
 * Vraie carte (OpenStreetMap / Leaflet) avec marqueurs cliquables et
 * itinéraires routiers réels lorsque le tracé est fourni.
 * Leaflet est chargé dynamiquement : aucune exécution côté serveur.
 */
export function InterventionsMap({
  markers,
  activeId,
  onSelect,
  height = 420,
  routeCoords,
  routeEstime = false,
  tourneeCoords,
  scrollWheelZoom = false,
}: {
  markers: MapMarker[];
  activeId?: string | null;
  onSelect?: (id: string) => void;
  height?: number;
  /** Itinéraire routier réel base → chantier sélectionné. */
  routeCoords?: [number, number][] | null;
  /** true si l'itinéraire est estimé (réseau routier indisponible) : ne pas tracer la ligne droite. */
  routeEstime?: boolean;
  /** Tracé routier réel de la tournée complète. */
  tourneeCoords?: [number, number][] | null;
  scrollWheelZoom?: boolean;
}) {
  const el = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layer = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const L = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byId = useRef<Record<string, any>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mod = await import("leaflet");
      if (cancelled || !el.current || map.current) return;
      L.current = mod.default ?? mod;
      const leaflet = L.current;
      map.current = leaflet.map(el.current, {
        center: [46.9, -1.2],
        zoom: 6,
        scrollWheelZoom,
        attributionControl: true,
      });
      leaflet
        .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          maxZoom: 18,
          attribution: "&copy; OpenStreetMap",
        })
        .addTo(map.current);
      layer.current = leaflet.layerGroup().addTo(map.current);
      draw();
    })();
    return () => {
      cancelled = true;
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function dot(color: string, active: boolean, n?: number) {
    const size = active ? 40 : 30;
    return L.current.divIcon({
      className: "",
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      html: `<span style="display:grid;place-items:center;width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:3px solid #fff;box-shadow:0 0 0 ${active ? 7 : 4}px ${color}33;color:#fff;font:700 ${active ? 15 : 12}px/1 system-ui">${n ?? ""}</span>`,
    });
  }

  function draw() {
    const leaflet = L.current;
    if (!leaflet || !layer.current) return;
    layer.current.clearLayers();
    byId.current = {};

    leaflet
      .marker([BASE.lat, BASE.lng], {
        icon: leaflet.divIcon({
          className: "",
          iconSize: [18, 18],
          iconAnchor: [9, 9],
          html: `<span style="display:block;width:18px;height:18px;border-radius:4px;background:#0f172a;border:3px solid #fff;box-shadow:0 0 0 3px #0f172a33"></span>`,
        }),
      })
      .addTo(layer.current)
      .bindTooltip(`Base · ${BASE.label}`, { direction: "top" });

    // Tournée complète (réseau routier réel)
    if (tourneeCoords && tourneeCoords.length > 1) {
      leaflet
        .polyline(tourneeCoords, { color: "#0f172a", weight: 3, opacity: 0.35 })
        .addTo(layer.current);
    }

    // Itinéraire réel vers le chantier sélectionné (pas de ligne droite à vol d'oiseau)
    if (routeCoords && routeCoords.length > 1 && !routeEstime) {
      leaflet
        .polyline(routeCoords, { color: "#16a34a", weight: 6, opacity: 0.25 })
        .addTo(layer.current);
      leaflet
        .polyline(routeCoords, { color: "#16a34a", weight: 3, opacity: 0.95 })
        .addTo(layer.current);
    }

    markers.forEach((m, i) => {
      const color = STATUT_COLORS[m.statut ?? "planifie"] ?? STATUT_COLORS.planifie;
      const mk = leaflet
        .marker([m.lat, m.lng], { icon: dot(color, activeId === m.id, i + 1) })
        .addTo(layer.current)
        .bindPopup(
          `<strong style="font-weight:700">${escapeHtml(m.label)}</strong>${
            m.sub ? `<br/>${escapeHtml(m.sub)}` : ""
          }${m.date ? `<br/><span style="opacity:.7">${escapeHtml(m.date)}</span>` : ""}${
            m.trajet
              ? `<br/><span style="font-weight:600">Trajet : ${escapeHtml(m.trajet)}</span>`
              : ""
          }`,
        );
      mk.on("click", () => onSelect?.(m.id));
      byId.current[m.id] = mk;
    });

    if (markers.length) {
      const bounds = leaflet.latLngBounds([
        [BASE.lat, BASE.lng],
        ...markers.map((m) => [m.lat, m.lng] as [number, number]),
      ]);
      map.current.fitBounds(bounds, { padding: [34, 34], maxZoom: 9 });
    }
  }

  useEffect(() => {
    draw();
    const mk = activeId ? byId.current[activeId] : null;
    if (mk) mk.openPopup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, activeId, routeCoords, routeEstime, tourneeCoords]);

  return (
    <div className="rounded-sm overflow-hidden border border-border">
      <div ref={el} style={{ height }} className="w-full bg-muted" />
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}
