import { useEffect, useRef, useState } from "react";
import { LocateFixed } from "lucide-react";
import { TECHNICIENS } from "@/lib/geo";
import { Button } from "@/components/ui/button";

export type MapMarker = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  sub?: string | null;
  statut?: string | null;
  date?: string | null;
  dateCourte?: string | null;
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const precisionRef = useRef<any>(null);
  /** Signature des repères déjà cadrés (évite de recadrer à chaque clic). */
  const fitRef = useRef<string>("");
  const [locationPending, setLocationPending] = useState(false);

  function refreshSize() {
    if (!map.current) return;
    requestAnimationFrame(() => {
      map.current?.invalidateSize(false);
    });
    window.setTimeout(() => {
      map.current?.invalidateSize(false);
    }, 160);
  }

  function positionsUtiles() {
    const chantiersEnFrance = markers
      .filter((m) => m.lat >= 41.2 && m.lat <= 51.3 && m.lng >= -5.4 && m.lng <= 9.8)
      .map((m) => [m.lat, m.lng] as [number, number]);
    if (chantiersEnFrance.length) return chantiersEnFrance;
    return (basesRef.current ?? BASES).map((b) => [b.lat, b.lng] as [number, number]);
  }

  function cadrerChantiers() {
    const leaflet = L.current;
    if (!leaflet || !map.current) return;
    const positions = positionsUtiles();
    if (!positions.length) return;
    map.current.fitBounds(leaflet.latLngBounds(positions), {
      padding: [36, 36],
      maxZoom: 12,
    });
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
    window.setTimeout(() => cadrerChantiers(), 180);
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    (basesRef.current ?? BASES).forEach((b) => {
      leaflet
        .marker([b.lat, b.lng], {
          icon: leaflet.divIcon({
            className: "",
            iconSize: [18, 18],
            iconAnchor: [9, 9],
            html: `<span style="display:block;width:18px;height:18px;border-radius:4px;background:#0f172a;border:3px solid #fff;box-shadow:0 0 0 3px #0f172a33"></span>`,
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
        .addTo(layer.current);
      mk.bindTooltip(
        `<strong>${escapeHtml(m.label)}</strong>${m.date ? `<br>${escapeHtml(m.date)}` : ""}`,
        { direction: "top", offset: [0, -18], className: "rdv-map-date-tooltip" },
      );
      mk.bindPopup(
        () => {
          const contenu = document.createElement("div");
          contenu.className = "rdv-map-popup-content";
          const titre = document.createElement("strong");
          titre.textContent = m.label;
          contenu.append(titre);
          for (const texte of [m.date, m.sub, m.trajet ? `Trajet : ${m.trajet}` : null]) {
            if (!texte) continue;
            const ligne = document.createElement("span");
            ligne.textContent = texte;
            if (texte === m.date) ligne.className = "rdv-map-popup-date";
            contenu.append(ligne);
          }
          const statut = document.createElement("span");
          statut.textContent = ({ planifie: "Planifié", confirme: "Confirmé", en_cours: "Travaux en cours", en_pause: "En pause", termine: "Terminé", realise: "Réalisé", annule: "Annulé" } as Record<string, string>)[m.statut ?? "planifie"] ?? m.statut ?? "";
          contenu.append(statut);
          if (selectionMode) {
            const aide = document.createElement("span");
            aide.className = "rdv-map-popup-accent";
            aide.textContent = rang ? `Coché n°${rang} — cliquez pour retirer` : "Cliquez pour cocher ce chantier";
            contenu.append(aide);
          }
          if (assignRef.current && !selectionMode) {
            const affectation = document.createElement("div");
            affectation.className = "rdv-map-assignment";
            const libelle = document.createElement("strong");
            libelle.textContent = `Intervenant : ${m.technicien || "non affecté"}`;
            affectation.append(libelle);
            const actions = document.createElement("div");
            actions.className = "rdv-map-assignment-actions";
            for (const technicien of TECHNICIENS) {
              const bouton = document.createElement("button");
              bouton.type = "button";
              bouton.className = m.technicien === technicien.nom ? "is-active" : "";
              bouton.textContent = technicien.nom.split(" ")[0] ?? technicien.nom;
              bouton.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();
                if (!window.confirm(`Affecter ce chantier (${m.label}) à ${technicien.nom} ?`)) return;
                assignRef.current?.(m.id, technicien.nom);
                mk.closePopup();
              });
              actions.append(bouton);
            }
            affectation.append(actions);
            contenu.append(affectation);
          }
          return contenu;
        },
        { className: "rdv-popup", maxWidth: 280 },
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
      cadrerChantiers();
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


  /** Centre la carte sur la position GPS réelle de l'appareil. */
  function maPosition() {
    if (!navigator.geolocation || !map.current) return;
    setLocationPending(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const leaflet = L.current;
        const p: [number, number] = [pos.coords.latitude, pos.coords.longitude];
        if (moiRef.current) moiRef.current.remove();
        if (precisionRef.current) precisionRef.current.remove();
        precisionRef.current = leaflet
          .circle(p, {
            radius: Math.max(pos.coords.accuracy, 10),
            color: "#2563eb",
            weight: 1,
            fillColor: "#2563eb",
            fillOpacity: 0.08,
          })
          .addTo(map.current);
        moiRef.current = leaflet
          .circleMarker(p, {
            radius: 8,
            color: "#fff",
            weight: 3,
            fillColor: "#2563eb",
            fillOpacity: 1,
          })
          .addTo(map.current)
          .bindTooltip(`Ma position · précision ${Math.round(pos.coords.accuracy)} m`, { direction: "top" });
        map.current.setView(p, pos.coords.accuracy <= 100 ? 15 : 13);
        setLocationPending(false);
      },
      () => {
        // Position refusée ou indisponible : la carte reste inchangée.
        setLocationPending(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  }

  return (
    <div className="relative w-full min-w-0 max-w-full overflow-hidden rounded-sm border border-border">
      <div ref={el} style={{ height }} className="w-full min-w-0 max-w-full bg-muted" />
      <div className="absolute bottom-3 left-3 z-[500]">
        <Button
          type="button"
          size="icon"
          onClick={maPosition}
          disabled={locationPending}
          className="h-11 w-11 rounded-full shadow-md"
          title="Afficher ma position"
          aria-label="Afficher ma position"
        >
          <LocateFixed className={locationPending ? "h-5 w-5 animate-pulse" : "h-5 w-5"} />
        </Button>
      </div>
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}
