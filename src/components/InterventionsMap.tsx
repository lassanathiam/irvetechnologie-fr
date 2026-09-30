import { useEffect, useRef } from "react";
import { TECHNICIENS } from "@/lib/geo";

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
  /** Intervenant affecté. */
  technicien?: string | null;
};

/** Bases de départ : une par intervenant (domicile de chacun). */
const BASES = TECHNICIENS.map((t) => ({
  lat: t.lat,
  lng: t.lng,
  label: `${t.nom.split(" ")[0]} · ${t.label}`,
}));

/** Couleurs de statut : bleu = programmé, vert = réalisé / validé. */
export const STATUT_COLORS: Record<string, string> = {
  planifie: "#2563eb",
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
  visible = true,
  bases: basesProp,
  onAssign,
}: {
  /** Affecter un intervenant depuis la bulle du repère (null = retirer). */
  onAssign?: (id: string, technicien: string | null) => void;
  /** Remplace les bases affichées (ex. base du sous-traitant). */
  bases?: { lat: number; lng: number; label: string }[];
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
  /** Indique si la carte est actuellement visible à l'écran (mobile accordéon). */
  visible?: boolean;
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
  /** Dernier repère cliqué directement sur la carte : seul lui ouvre l'affectation. */
  const clicDirect = useRef<string | null>(null);
  /** Signature des repères déjà cadrés (évite de recadrer à chaque clic). */
  const fitRef = useRef<string>("");

  function refreshSize() {
    if (!map.current) return;
    requestAnimationFrame(() => {
      map.current?.invalidateSize(false);
    });
    window.setTimeout(() => {
      map.current?.invalidateSize(false);
    }, 160);
  }

  const assignRef = useRef(onAssign);
  assignRef.current = onAssign;
  const basesRef = useRef(basesProp);
  basesRef.current = basesProp;
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
      refreshSize();
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

  useEffect(() => {
    if (!map.current || !visible) return;
    refreshSize();
  }, [visible, height]);

  useEffect(() => {
    if (!el.current || !map.current) return;
    const onResize = () => refreshSize();
    window.addEventListener("resize", onResize);
    window.addEventListener("orientationchange", onResize);
    const ro = new ResizeObserver(() => refreshSize());
    ro.observe(el.current);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("orientationchange", onResize);
      ro.disconnect();
    };
  }, []);

  /** Petite pancarte sur piquet : icône éclair + numéro du rendez-vous. */
  function dot(
    color: string,
    active: boolean,
    n?: number,
    _etat?: string,
    rang?: number | null,
  ) {
    const coche = rang != null;
    const fond = coche ? "#2563eb" : color;
    const w = 46;
    const h = 34;
    const eclair = `<svg width="12" height="12" viewBox="0 0 24 24" fill="#fff" stroke="none"><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z"/></svg>`;
    return L.current.divIcon({
      className: "",
      iconSize: [w, h],
      iconAnchor: [w / 2, h],
      popupAnchor: [0, -h],
      html: `<div style="display:flex;flex-direction:column;align-items:center;width:${w}px;height:${h}px;${active ? "transform:scale(1.15);transform-origin:bottom center;" : ""}">
        <div style="display:flex;align-items:center;gap:3px;height:22px;padding:0 6px;border-radius:6px;background:${fond};border:2px solid #fff;box-shadow:0 2px 6px rgba(15,23,42,.35)${active ? `,0 0 0 3px ${fond}66` : ""};color:#fff;font:800 11px/1 system-ui;white-space:nowrap">${eclair}<span>${coche ? rang : (n ?? "")}</span></div>
        <div style="width:2px;height:10px;background:#334155"></div>
      </div>`,
    });
  }

  function drawMarkers() {
    const leaflet = L.current;
    if (!leaflet || !layer.current) return;
    layer.current.clearLayers();
    byId.current = {};

    (basesRef.current ?? BASES).forEach((b) => {
      leaflet
        .marker([b.lat, b.lng], {
          icon: leaflet.divIcon({
            className: "",
            iconSize: [30, 32],
            iconAnchor: [15, 32],
            html: `<div style="display:flex;flex-direction:column;align-items:center;width:30px;height:32px">
              <div style="display:grid;place-items:center;width:26px;height:22px;border-radius:6px;background:#0f172a;border:2px solid #fff;box-shadow:0 2px 6px rgba(15,23,42,.35)"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/></svg></div>
              <div style="width:2px;height:10px;background:#334155"></div>
            </div>`,
          }),
        })
        .addTo(layer.current)
        .bindTooltip(`Base · ${escapeHtml(b.label)}`, { direction: "top" });
    });

    markers.forEach((m, i) => {
      const etat = STATUT_COLORS[m.statut ?? "planifie"] ?? STATUT_COLORS.planifie;
      const color = m.couleur || etat;
      const idx = selectedIds.indexOf(m.id);
      const rang = idx >= 0 ? idx + 1 : null;
      const mk = leaflet
        .marker([m.lat, m.lng], { icon: dot(color, activeId === m.id, i + 1, etat, rang) })
        .addTo(layer.current)
        .bindPopup(
          `<div style="font:13px/1.45 system-ui,sans-serif;color:#0f172a;white-space:normal;word-break:normal;overflow-wrap:break-word">` +
          `<div style="font-weight:700;font-size:14px">${escapeHtml(m.label)}</div>${
            m.sub ? `<div style="margin-top:2px">${escapeHtml(m.sub)}</div>` : ""
          }${m.date ? `<div style="opacity:.7">${escapeHtml(m.date)}</div>` : ""}${
            m.trajet
              ? `<div style="font-weight:600;margin-top:2px">Trajet : ${escapeHtml(m.trajet)}</div>`
              : ""
          }${
            selectionMode
              ? `<div style="font-weight:700;color:#2563eb;margin-top:4px">${
                  rang ? `Coché n°${rang} — cliquez pour retirer` : "Cliquez pour cocher ce chantier"
                }</div>`
              : ""
          }${
            onAssign && !selectionMode
              ? `<div data-assign-block style="margin-top:8px"><div style="font-weight:700">Intervenant : ${escapeHtml(m.technicien || "non affecté")}</div><div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:6px">${TECHNICIENS.map(
                  (t) =>
                    `<button type="button" data-assign="${escapeHtml(t.nom)}" style="padding:6px 10px;border-radius:8px;border:1px solid #2563eb;font-weight:700;${m.technicien === t.nom ? "background:#2563eb;color:#fff" : "background:#fff;color:#2563eb"}">${escapeHtml(t.nom.split(" ")[0])}</button>`,
                ).join("")}</div></div>`
              : ""
          }</div>`,
          { minWidth: 220, maxWidth: 280, className: "rdv-popup" },
        );
      mk.on("popupopen", (ev: { popup: { getElement: () => HTMLElement | undefined } }) => {
        // L'affectation n'apparaît que si le repère a été cliqué directement sur la carte.
        const bloc = ev.popup.getElement()?.querySelector<HTMLElement>("[data-assign-block]");
        if (bloc) bloc.style.display = clicDirect.current === m.id ? "" : "none";
        ev.popup.getElement()?.querySelectorAll<HTMLButtonElement>("[data-assign]").forEach((b) => {
          b.onclick = (e) => {
            e.stopPropagation();
            const nom = b.dataset["assign"] ?? null;
            if (window.confirm(`Affecter ce chantier (${m.label}) à ${nom} ?`)) {
              assignRef.current?.(m.id, nom);
              mk.closePopup();
            }
          };
        });
      });
      mk.on("popupclose", () => {
        if (clicDirect.current === m.id) clicDirect.current = null;
      });
      mk.on("click", () => {
        clicDirect.current = m.id;
        if (selectionMode) onToggleSelect?.(m.id);
        onSelect?.(m.id);
      });
      byId.current[m.id] = mk;
    });


    const cle = markers.map((m) => m.id).join("|");
    if (markers.length && fitRef.current !== cle) {
      fitRef.current = cle;
      const bounds = leaflet.latLngBounds([
        ...(basesRef.current ?? BASES).map((b) => [b.lat, b.lng] as [number, number]),
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
    <div className="relative w-full min-w-0 max-w-full overflow-hidden rounded-sm border border-border">
      <button
        type="button"
        onClick={maPosition}
        title="Ma position"
        aria-label="Ma position"
        className="absolute bottom-3 left-3 z-[500] flex h-11 w-11 items-center justify-center rounded-full border border-border bg-card/95 text-foreground shadow-md transition-colors hover:border-primary hover:text-primary"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
          <circle cx="12" cy="12" r="4.5" />
          <circle cx="12" cy="12" r="0.5" fill="currentColor" />
          <line x1="12" y1="1.5" x2="12" y2="4.5" />
          <line x1="12" y1="19.5" x2="12" y2="22.5" />
          <line x1="1.5" y1="12" x2="4.5" y2="12" />
          <line x1="19.5" y1="12" x2="22.5" y2="12" />
        </svg>
      </button>
      <div ref={el} style={{ height }} className="w-full min-w-0 max-w-full bg-muted" />
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}
