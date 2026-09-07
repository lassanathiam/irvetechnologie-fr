import { useEffect, useRef } from "react";

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  sub?: string | null;
  statut?: string | null;
  date?: string | null;
};

const BASE = { lat: 47.2184, lng: -1.5536, label: "Nantes" };

const COLORS: Record<string, string> = {
  planifie: "#2563eb",
  confirme: "#0ea5e9",
  realise: "#16a34a",
  annule: "#94a3b8",
};

/**
 * Vraie carte de France (OpenStreetMap / Leaflet) avec marqueurs cliquables.
 * Leaflet est chargé dynamiquement : aucune exécution côté serveur.
 */
export function InterventionsMap({
  markers,
  activeId,
  onSelect,
  height = 420,
}: {
  markers: MapMarker[];
  activeId?: string | null;
  onSelect?: (id: string) => void;
  height?: number;
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
        center: [46.7, 2.4],
        zoom: 5,
        scrollWheelZoom: false,
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

  function dot(color: string, active: boolean) {
    const size = active ? 22 : 16;
    return L.current.divIcon({
      className: "",
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:9999px;background:${color};border:3px solid #fff;box-shadow:0 0 0 ${active ? 6 : 3}px ${color}33"></span>`,
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

    for (const m of markers) {
      const color = COLORS[m.statut ?? "planifie"] ?? COLORS.planifie;
      const mk = leaflet
        .marker([m.lat, m.lng], { icon: dot(color, activeId === m.id) })
        .addTo(layer.current)
        .bindPopup(
          `<strong style="font-weight:700">${escapeHtml(m.label)}</strong>${
            m.sub ? `<br/>${escapeHtml(m.sub)}` : ""
          }${m.date ? `<br/><span style="opacity:.7">${escapeHtml(m.date)}</span>` : ""}`,
        );
      mk.on("click", () => onSelect?.(m.id));
      byId.current[m.id] = mk;

      leaflet
        .polyline(
          [
            [BASE.lat, BASE.lng],
            [m.lat, m.lng],
          ],
          { color, weight: activeId === m.id ? 3 : 1, opacity: 0.45, dashArray: "5 6" },
        )
        .addTo(layer.current);
    }

    if (markers.length) {
      const bounds = leaflet.latLngBounds([
        [BASE.lat, BASE.lng],
        ...markers.map((m) => [m.lat, m.lng] as [number, number]),
      ]);
      map.current.fitBounds(bounds, { padding: [30, 30], maxZoom: 11 });
    }
  }

  useEffect(() => {
    draw();
    const mk = activeId ? byId.current[activeId] : null;
    if (mk) mk.openPopup();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, activeId]);

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
