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
    const t = setInterval(() => setI((v) => (v + 1) % safeItems.length), 4500);
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

  const go = (d: number) => setI((v) => (v + d + safeItems.length) % safeItems.length);
  return (
    <div
      className="relative overflow-hidden rounded-2xl border border-border bg-card"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative aspect-[16/9] sm:aspect-[15/8]">
        {safeItems.map((it, idx) => (
          <img
            key={it.src}
            src={it.src}
            alt={it.title}
            loading="lazy"
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ${
              idx === i ? "opacity-100 animate-kenburns" : "opacity-0"
            }`}
          />
        ))}
        <button onClick={() => go(-1)} className="absolute left-3 top-1/2 -translate-y-1/2 bg-background/75 backdrop-blur border border-border p-2 rounded-sm hover:border-primary hover:text-primary transition" aria-label="Précédent">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button onClick={() => go(1)} className="absolute right-3 top-1/2 -translate-y-1/2 bg-background/75 backdrop-blur border border-border p-2 rounded-sm hover:border-primary hover:text-primary transition" aria-label="Suivant">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="flex items-center justify-center gap-2 border-t border-border/70 bg-background/70 px-3 py-2.5">
        <span className="text-mono text-[11px] text-primary">
          {String(i + 1).padStart(2, "0")} / {String(safeItems.length).padStart(2, "0")}
        </span>
        <div className="flex gap-1.5">
          {safeItems.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setI(idx)}
              aria-label={`Réalisation ${idx + 1}`}
              className={`h-1.5 rounded-full transition-all ${idx === i ? "w-6 bg-primary" : "w-1.5 bg-border hover:bg-muted-foreground"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
