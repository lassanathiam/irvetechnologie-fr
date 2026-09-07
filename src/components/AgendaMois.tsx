import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export type AgendaEvent = {
  id: string;
  date_debut: string;
  duree_min: number | string | null;
  client_nom: string;
  titre?: string | null;
  cp_ville?: string | null;
  statut?: string | null;
  distance_km?: number | string | null;
};

const DOTS: Record<string, string> = {
  planifie: "bg-primary",
  confirme: "bg-sky-500",
  realise: "bg-emerald-500",
  annule: "bg-muted-foreground",
};

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const key = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Agenda mensuel : charge par jour, créneaux libres et sélection d'une date. */
export function AgendaMois({
  events,
  activeId,
  onSelectEvent,
  onPickDay,
}: {
  events: AgendaEvent[];
  activeId?: string | null;
  onSelectEvent?: (id: string) => void;
  onPickDay?: (isoDate: string) => void;
}) {
  const today = new Date();
  const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState<string>(key(today));

  const byDay = useMemo(() => {
    const m = new Map<string, AgendaEvent[]>();
    for (const e of events) {
      const k = key(new Date(e.date_debut));
      m.set(k, [...(m.get(k) ?? []), e]);
    }
    for (const [, list] of m)
      list.sort((a, b) => a.date_debut.localeCompare(b.date_debut));
    return m;
  }, [events]);

  const cells = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const offset = (first.getDay() + 6) % 7; // lundi = 0
    const start = new Date(first);
    start.setDate(first.getDate() - offset);
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
  }, [cursor]);

  const moisFr = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" }).format(cursor);
  const daySelected = byDay.get(selected) ?? [];

  const charge = (list: AgendaEvent[]) =>
    list
      .filter((e) => e.statut !== "annule")
      .reduce((t, e) => t + Number(e.duree_min ?? 0) + Number(e.distance_km ?? 0) * 1.3, 0);

  return (
    <div className="bg-card border border-border rounded-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-bold tracking-tight capitalize">{moisFr}</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Mois précédent"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="p-1.5 rounded-sm border border-border hover:border-primary hover:text-primary"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setCursor(new Date(today.getFullYear(), today.getMonth(), 1))}
            className="text-mono text-[11px] font-semibold px-2 py-1.5 rounded-sm border border-border hover:border-primary hover:text-primary"
          >
            Aujourd&apos;hui
          </button>
          <button
            type="button"
            aria-label="Mois suivant"
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="p-1.5 rounded-sm border border-border hover:border-primary hover:text-primary"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-mono text-[10px] font-semibold uppercase text-muted-foreground mb-1">
        {JOURS.map((j) => (
          <div key={j} className="text-center py-1">
            {j}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((d) => {
          const k = key(d);
          const list = byDay.get(k) ?? [];
          const inMonth = d.getMonth() === cursor.getMonth();
          const isToday = k === key(today);
          const isSel = k === selected;
          const load = charge(list);
          const plein = load >= 420;
          return (
            <button
              key={k}
              type="button"
              onClick={() => {
                setSelected(k);
                onPickDay?.(k);
              }}
              className={`text-left h-16 rounded-sm border px-1.5 py-1 transition ${
                isSel
                  ? "border-primary bg-primary/10"
                  : plein
                    ? "border-amber-500/40 bg-amber-500/5"
                    : "border-border hover:border-primary/50"
              } ${inMonth ? "" : "opacity-40"}`}
            >
              <span
                className={`text-mono text-[11px] ${isToday ? "font-extrabold text-primary" : "font-semibold"}`}
              >
                {d.getDate()}
              </span>
              <span className="mt-1 flex flex-wrap gap-0.5">
                {list.slice(0, 4).map((e) => (
                  <span
                    key={e.id}
                    className={`h-1.5 w-1.5 rounded-full ${DOTS[e.statut ?? "planifie"] ?? "bg-primary"}`}
                  />
                ))}
              </span>
              {list.length > 0 && (
                <span className="block text-mono text-[9px] text-muted-foreground mt-0.5">
                  {list.length} rdv
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-border">
        <p className="text-mono text-[11px] font-semibold uppercase text-muted-foreground">
          {new Intl.DateTimeFormat("fr-FR", {
            weekday: "long",
            day: "2-digit",
            month: "long",
          }).format(new Date(`${selected}T12:00:00`))}
        </p>
        {daySelected.length === 0 ? (
          <p className="text-sm text-muted-foreground mt-2">
            Journée libre — créneau disponible pour un chantier.
          </p>
        ) : (
          <ul className="mt-2 space-y-1.5">
            {daySelected.map((e) => (
              <li key={e.id}>
                <button
                  type="button"
                  onClick={() => onSelectEvent?.(e.id)}
                  className={`w-full text-left text-sm flex items-center gap-2 rounded-sm px-2 py-1.5 ${
                    activeId === e.id ? "bg-primary/10" : "hover:bg-muted/60"
                  }`}
                >
                  <span className="text-mono text-[11px] font-bold">
                    {new Intl.DateTimeFormat("fr-FR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(e.date_debut))}
                  </span>
                  <span className="font-semibold truncate">{e.client_nom}</span>
                  <span className="ml-auto text-mono text-[11px] text-muted-foreground shrink-0">
                    {e.cp_ville ?? ""}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
