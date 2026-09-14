import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Item = { src: string; title: string; place: string; spec: string };

export function RealisationsSlider({ items }: { items: Item[] }) {
  const safeItems = (items ?? []).filter(
    (it): it is Item =>
      Boolean(it && typeof it.src === "string" && it.src.trim() && typeof it.title === "string"),
  );
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || safeItems.length < 2) return;
    const t = setInterval(() => setI((v) => (v + 1) % safeItems.length), 2200);
    return () => clearInterval(t);
  }, [paused, safeItems.length]);

  useEffect(() => {
    if (safeItems.length === 0) setI(0);
    else if (i >= safeItems.length) setI(0);
  }, [i, safeItems.length]);

  if (safeItems.length === 0) {
    return (
      <div className="border border-border rounded-sm p-6 bg-card/50">
        <p className="text-sm text-muted-foreground">
          Les réalisations seront visibles ici dès que les photos publiques seront disponibles.
        </p>
      </div>
    );
  }

  const current = safeItems[i] ?? safeItems[0];
  const go = (direction: number) => setI((value) => (value + direction + safeItems.length) % safeItems.length);

  return (
    <div
      className="relative overflow-hidden border border-border bg-card"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative aspect-[16/9] sm:aspect-[15/8]">
        {safeItems.map((it, idx) => (
          <img
            key={it.src}
            src={it.src}
            alt={it.title}
            loading={idx === 0 ? "eager" : "lazy"}
            decoding="async"
            fetchPriority={idx === 0 ? "high" : "auto"}
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-300 ${
              idx === i ? "opacity-100" : "pointer-events-none opacity-0"
            }`}
          />
        ))}
        <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-4 bg-gradient-to-t from-premium-night via-premium-night/70 to-transparent p-5 pt-20 text-premium-foreground sm:p-7">
          <div className="min-w-0">
            <p className="truncate font-display text-xl font-bold sm:text-2xl">{current.title}</p>
            <p className="mt-1 truncate text-sm text-premium-foreground/70">{[current.place, current.spec].filter(Boolean).join(" · ")}</p>
          </div>
          <span className="shrink-0 text-xs font-semibold text-premium-energy">{i + 1} / {safeItems.length}</span>
        </div>
        {safeItems.length > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="Réalisation précédente" className="absolute left-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center border border-premium-foreground/30 bg-premium-night/75 text-premium-foreground backdrop-blur transition hover:border-premium-energy hover:text-premium-energy">
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button type="button" onClick={() => go(1)} aria-label="Réalisation suivante" className="absolute right-3 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center border border-premium-foreground/30 bg-premium-night/75 text-premium-foreground backdrop-blur transition hover:border-premium-energy hover:text-premium-energy">
              <ChevronRight className="h-5 w-5" />
            </button>
          </>
        )}
      </div>
      {safeItems.length > 1 && (
        <div className="flex gap-2 overflow-x-auto border-t border-border bg-card p-3">
          {safeItems.map((item, idx) => (
            <button key={item.src} type="button" onClick={() => setI(idx)} aria-label={`Afficher ${item.title}`} className={`h-14 w-20 shrink-0 overflow-hidden border-2 transition ${idx === i ? "border-primary" : "border-transparent opacity-60 hover:opacity-100"}`}>
              <img src={item.src} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
