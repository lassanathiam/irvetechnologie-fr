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
  /** Couleur du partenaire / donneur d'ordre (repère visuel sur la carte). */
  couleur?: string | null;
};

const BASE = { lat: 47.2184, lng: -1.5536, label: "Nantes" };

/** Couleurs de statut : orange = programmé, vert = réalisé / validé. */
export const STATUT_COLORS: Record<string, string> = {
  planifie: "#f59e0b",
  confirme: "#0284c7",
  en_cours: "#7c3aed",
  termine: "#0d9488",
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
  selectionMode = false,
  selectedIds = [],
  onToggleSelect,
  lienCoords,
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
  /** Mode « programmer ensemble » : un clic sur un repère coche le chantier. */
  selectionMode?: boolean;
  /** Chantiers cochés, dans l'ordre de sélection. */
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  /** Tracé routier d'un chantier coché au suivant. */
  lienCoords?: [number, number][] | null;
}) {

  const el = useRef<HTMLDivElement | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const map = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layer = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const routeLayer = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const L = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const byId = useRef<Record<string, any>>({});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const moiRef = useRef<any>(null);

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
      routeLayer.current = leaflet.layerGroup().addTo(map.current);
      drawMarkers();
      drawRoutes();
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

  function dot(
    color: string,
    active: boolean,
    n?: number,
    etat?: string,
    rang?: number | null,
  ) {
    const coche = rang != null;
    const size = coche ? 48 : active ? 44 : 34;
    const anneau = coche
      ? `box-shadow:0 0 0 6px #2563eb;`
      : `box-shadow:0 0 0 ${active ? 8 : 5}px ${etat ?? color}55;`;
    return L.current.divIcon({
      className: "",
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
      html: `<span style="display:grid;place-items:center;width:${size}px;height:${size}px;border-radius:9999px;background:${coche ? "#2563eb" : color};border:3px solid #fff;${anneau}color:#fff;font:800 ${coche ? 18 : active ? 16 : 13}px/1 system-ui">${coche ? rang : (n ?? "")}</span>`,
    });
  }

  function drawMarkers() {
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

    markers.forEach((m, i) => {
      const etat = STATUT_COLORS[m.statut ?? "planifie"] ?? STATUT_COLORS.planifie;
      const color = m.couleur || etat;
      const idx = selectedIds.indexOf(m.id);
      const rang = idx >= 0 ? idx + 1 : null;
      const mk = leaflet
        .marker([m.lat, m.lng], { icon: dot(color, activeId === m.id, i + 1, etat, rang) })
        .addTo(layer.current)
        .bindPopup(
          `<strong style="font-weight:700">${escapeHtml(m.label)}</strong>${
            m.sub ? `<br/>${escapeHtml(m.sub)}` : ""
          }${m.date ? `<br/><span style="opacity:.7">${escapeHtml(m.date)}</span>` : ""}${
            m.trajet
              ? `<br/><span style="font-weight:600">Trajet : ${escapeHtml(m.trajet)}</span>`
              : ""
          }${
            selectionMode
              ? `<br/><span style="font-weight:700;color:#2563eb">${
                  rang ? `Coché n°${rang} — cliquez pour retirer` : "Cliquez pour cocher ce chantier"
                }</span>`
              : ""
          }`,
        );
      mk.on("click", () => {
        if (selectionMode) onToggleSelect?.(m.id);
        onSelect?.(m.id);
      });
      byId.current[m.id] = mk;
    });


    const cle = markers.map((m) => m.id).join("|");
    if (markers.length && fitRef.current !== cle) {
      fitRef.current = cle;
      const bounds = leaflet.latLngBounds([
        [BASE.lat, BASE.lng],
        ...markers.map((m) => [m.lat, m.lng] as [number, number]),
      ]);
      map.current.fitBounds(bounds, { padding: [34, 34], maxZoom: 9 });
    }
  }

  function drawRoutes() {
    const leaflet = L.current;
    if (!leaflet || !routeLayer.current) return;
    routeLayer.current.clearLayers();

    // Tournée complète (réseau routier réel)
    if (tourneeCoords && tourneeCoords.length > 1) {
      leaflet
        .polyline(tourneeCoords, { color: "#0f172a", weight: 3, opacity: 0.35 })
        .addTo(routeLayer.current);
    }

    // Itinéraire réel vers le chantier sélectionné (pas de ligne droite à vol d'oiseau)
    if (routeCoords && routeCoords.length > 1 && !routeEstime) {
      leaflet
        .polyline(routeCoords, { color: "#16a34a", weight: 6, opacity: 0.25 })
        .addTo(routeLayer.current);
      leaflet
        .polyline(routeCoords, { color: "#16a34a", weight: 3, opacity: 0.95 })
        .addTo(routeLayer.current);
    }

    // Trajet d'un chantier coché au suivant (programmation groupée)
    if (lienCoords && lienCoords.length > 1) {
      leaflet
        .polyline(lienCoords, { color: "#2563eb", weight: 7, opacity: 0.2 })
        .addTo(routeLayer.current);
      leaflet
        .polyline(lienCoords, { color: "#2563eb", weight: 4, opacity: 0.95, dashArray: "10 8" })
        .addTo(routeLayer.current);
    }
  }

  useEffect(() => {
    drawMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [markers, selectedIds, selectionMode]);

  useEffect(() => {
    const mk = activeId ? byId.current[activeId] : null;
    if (mk) mk.openPopup();
  }, [activeId]);

  useEffect(() => {
    drawRoutes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeCoords, routeEstime, tourneeCoords, lienCoords]);


  /** Centre la carte sur la position réelle de l'appareil (« Ma position »). */
  function maPosition() {
    if (!navigator.geolocation || !map.current) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const leaflet = L.current;
        const p: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        if (moiRef.current) moiRef.current.remove();
        moiRef.current = leaflet
          .circleMarker(p, {
            radius: 8,
            color: "#fff",
            weight: 3,
            fillColor: "#2563eb",
            fillOpacity: 1,
          })
          .addTo(map.current)
          .bindTooltip("Ma position", { direction: "top" });
        map.current.setView(p, 11);
      },
      () => {
        // Position refusée ou indisponible : la carte reste inchangée.
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  return (
    <div className="relative rounded-sm overflow-hidden border border-border">
      <button
        type="button"
        onClick={maPosition}
        className="absolute right-2 top-2 z-[500] text-mono text-[11px] font-bold px-3 py-2 rounded-sm bg-card/95 border border-border shadow hover:border-primary hover:text-primary"
      >
        Ma position
      </button>
      <div ref={el} style={{ height }} className="w-full bg-muted" />
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}
