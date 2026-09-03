import { CORSE_OUTLINE, FRANCE_OUTLINE, MAP_H, MAP_W, project, toPath, BASE } from "@/lib/geo";

export type MapPoint = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  sub?: string | null;
  statut?: string | null;
};

const COLOR: Record<string, string> = {
  planifie: "hsl(var(--primary))",
  confirme: "hsl(var(--primary))",
  realise: "hsl(150 25% 45%)",
  annule: "hsl(var(--muted-foreground))",
};

export function FranceMap({
  points,
  activeId,
  onSelect,
}: {
  points: MapPoint[];
  activeId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const base = project(BASE.lat, BASE.lng);

  return (
    <svg
      viewBox={`0 0 ${MAP_W} ${MAP_H}`}
      className="w-full h-auto"
      role="img"
      aria-label="Carte de France des interventions planifiées"
    >
      <path
        d={toPath(FRANCE_OUTLINE)}
        className="fill-muted/50 stroke-border"
        strokeWidth={1.5}
      />
      <path d={toPath(CORSE_OUTLINE)} className="fill-muted/50 stroke-border" strokeWidth={1.5} />

      {/* Trajets depuis la base */}
      {points.map((p) => {
        const { x, y } = project(p.lat, p.lng);
        return (
          <line
            key={`l-${p.id}`}
            x1={base.x}
            y1={base.y}
            x2={x}
            y2={y}
            className="stroke-primary/25"
            strokeWidth={activeId === p.id ? 1.6 : 0.7}
            strokeDasharray="3 3"
          />
        );
      })}

      {/* Base opérationnelle */}
      <g>
        <circle cx={base.x} cy={base.y} r={6} className="fill-primary/20" />
        <circle cx={base.x} cy={base.y} r={3} className="fill-primary" />
        <text
          x={base.x + 9}
          y={base.y + 3}
          className="fill-foreground"
          style={{ fontSize: 9, fontFamily: "monospace" }}
        >
          BASE · {BASE.label}
        </text>
      </g>

      {points.map((p) => {
        const { x, y } = project(p.lat, p.lng);
        const active = activeId === p.id;
        return (
          <g
            key={p.id}
            onClick={() => onSelect?.(p.id)}
            style={{ cursor: onSelect ? "pointer" : "default" }}
          >
            <circle
              cx={x}
              cy={y}
              r={active ? 11 : 8}
              fill={COLOR[p.statut ?? "planifie"] ?? "hsl(var(--primary))"}
              opacity={active ? 0.35 : 0.22}
            />
            <circle
              cx={x}
              cy={y}
              r={active ? 5.5 : 4}
              fill={COLOR[p.statut ?? "planifie"] ?? "hsl(var(--primary))"}
            />
            {active && (
              <text
                x={x + 8}
                y={y - 6}
                className="fill-foreground"
                style={{ fontSize: 9, fontFamily: "monospace" }}
              >
                {p.label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
