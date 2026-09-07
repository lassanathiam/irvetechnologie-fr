import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Plus } from "lucide-react";

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
  planifie: "bg-amber-500",
  confirme: "bg-sky-500",
  realise: "bg-emerald-500",
  annule: "bg-muted-foreground",
};

const BARS: Record<string, string> = {
  planifie: "bg-amber-500",
  confirme: "bg-sky-500",
  realise: "bg-emerald-500",
  annule: "bg-muted-foreground",
};

const JOURS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];

const key = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const heureFr = (iso: string) =>
  new Intl.DateTimeFormat("fr-FR", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

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
    for (const [, list] of m) list.sort((a, b) => a.date_debut.localeCompare(b.date_debut));
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

  const rdvDuMois = cells.filter((d) => d.getMonth() === cursor.getMonth()).reduce(
    (t, d) => t + (byDay.get(key(d))?.length ?? 0),
    0,
  );

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden shadow-sm">
      {/* En-tête */}
      <div className="hero-grad px-5 py-4 text-primary-foreground">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-mono text-[11px] font-bold uppercase tracking-[0.16em] opacity-80 flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" /> Agenda
            </p>
            <h2 className="text-lg font-extrabold tracking-tight capitalize mt-0.5 truncate">
              {moisFr}
            </h2>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              aria-label="Mois précédent"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
              className="p-1.5 rounded-lg bg-primary-foreground/15 hover:bg-primary-foreground/30 transition"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => {
                setCursor(new Date(today.getFullYear(), today.getMonth(), 1));
                setSelected(key(today));
              }}
              className="text-mono text-[11px] font-bold px-2.5 py-1.5 rounded-lg bg-primary-foreground/15 hover:bg-primary-foreground/30 transition"
            >
              Aujourd&apos;hui
            </button>
            <button
              type="button"
              aria-label="Mois suivant"
              onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
              className="p-1.5 rounded-lg bg-primary-foreground/15 hover:bg-primary-foreground/30 transition"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
        <p className="text-mono text-[11px] font-semibold mt-2 opacity-90">
          {rdvDuMois} rendez-vous ce mois-ci
        </p>
      </div>

      <div className="p-4 sm:p-5">
        <div className="grid grid-cols-7 gap-1.5 text-mono text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1.5">
          {JOURS.map((j) => (
            <div key={j} className="text-center py-1">
              {j}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5">
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
                onClick={() => setSelected(k)}
                onDoubleClick={() => onPickDay?.(k)}
                title={list.length ? `${list.length} rendez-vous` : "Journée libre"}
                className={`group relative text-left h-[62px] rounded-lg border px-1.5 pt-1.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
                  isSel
                    ? "border-primary bg-primary/12 shadow-sm"
                    : plein
                      ? "border-amber-500/50 bg-amber-500/10"
                      : list.length
                        ? "border-border bg-muted/40 hover:border-primary/60"
                        : "border-border/70 hover:border-primary/50"
                } ${inMonth ? "" : "opacity-35"}`}
              >
                <span
                  className={`text-mono text-[12px] leading-none ${
                    isToday
                      ? "font-extrabold text-primary-foreground bg-primary rounded-md px-1.5 py-0.5 inline-block"
                      : "font-bold"
                  }`}
                >
                  {d.getDate()}
                </span>
                <span className="absolute left-1.5 right-1.5 bottom-1.5 flex flex-col gap-[3px]">
                  {list.slice(0, 2).map((e) => (
                    <span
                      key={e.id}
                      className={`h-[4px] w-full rounded-full ${BARS[e.statut ?? "planifie"] ?? "bg-primary"}`}
                    />
                  ))}
                  {list.length > 2 && (
                    <span className="text-mono text-[9px] font-bold text-muted-foreground leading-none">
                      +{list.length - 2}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {/* Jour sélectionné */}
        <div className="mt-5 pt-4 border-t border-border">
          <div className="flex items-center justify-between gap-3">
            <p className="text-mono text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              {new Intl.DateTimeFormat("fr-FR", {
                weekday: "long",
                day: "2-digit",
                month: "long",
              }).format(new Date(`${selected}T12:00:00`))}
            </p>
            <button
              type="button"
              onClick={() => onPickDay?.(selected)}
              className="text-mono text-[11px] font-bold text-primary inline-flex items-center gap-1 hover:underline shrink-0"
            >
              <Plus className="h-3.5 w-3.5" /> Planifier
            </button>
          </div>

          {daySelected.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-2.5">
              Journée libre — créneau disponible pour un chantier.
            </p>
          ) : (
            <ul className="mt-2.5 space-y-1.5">
              {daySelected.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => onSelectEvent?.(e.id)}
                    className={`w-full text-left text-sm flex items-center gap-2.5 rounded-lg px-2.5 py-2 transition ${
                      activeId === e.id
                        ? "bg-primary/12 ring-1 ring-primary/40"
                        : "hover:bg-muted/70"
                    }`}
                  >
                    <span
                      className={`h-7 w-[3px] rounded-full shrink-0 ${DOTS[e.statut ?? "planifie"] ?? "bg-primary"}`}
                    />
                    <span className="text-mono text-[11px] font-bold shrink-0">
                      {heureFr(e.date_debut)}
                    </span>
                    <span className="font-bold truncate">{e.client_nom}</span>
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
    </div>
  );
}
