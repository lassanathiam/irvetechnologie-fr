import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Slide = { src: string; label: string; meta: string };

export function HeroSlider({ slides, interval = 5000 }: { slides: Slide[]; interval?: number }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  const count = slides?.length ?? 0;

  useEffect(() => {
    if (paused || count === 0) return;
    const t = setInterval(() => setI((v) => (v + 1) % count), interval);
    return () => clearInterval(t);
  }, [paused, interval, count]);

  if (count === 0) {
    return (
      <div className="relative rounded-2xl w-full aspect-[4/3] sm:aspect-square overflow-hidden bg-card border border-border p-6 flex items-end">
        <div className="backdrop-blur-md bg-background/70 border border-border rounded-sm p-4">
          <p className="text-mono text-primary">Photos en cours de publication</p>
          <p className="text-sm text-muted-foreground mt-1">
            Ajoutez des photos réelles depuis l'espace pro pour alimenter ce diaporama.
          </p>
        </div>
      </div>
    );
  }

  const go = (d: number) => setI((v) => (v + d + count) % count);

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="absolute inset-0 border border-primary/20 rounded-sm animate-glow md:-m-4" aria-hidden />
      <div className="relative rounded-2xl w-full aspect-[4/3] sm:aspect-square overflow-hidden bg-card border border-border">
        {slides.map((s, idx) => (
          <img
            key={s.src}
            src={s.src}
            alt={s.label}
            width={1280}
            height={1280}
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
              idx === i ? "opacity-100 animate-kenburns" : "opacity-0"
            }`}
          />
        ))}

        {/* gradient veil */}
        <div className="absolute inset-0 bg-gradient-to-t from-background/85 via-background/10 to-transparent" aria-hidden />

        {/* arrows */}
        <button
          type="button"
          onClick={() => go(-1)}
          className="absolute left-3 top-1/2 -translate-y-1/2 bg-background/70 backdrop-blur border border-border p-2 rounded-sm hover:border-primary hover:text-primary transition"
          aria-label="Précédent"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          className="absolute right-3 top-1/2 -translate-y-1/2 bg-background/70 backdrop-blur border border-border p-2 rounded-sm hover:border-primary hover:text-primary transition"
          aria-label="Suivant"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

      </div>

      {/* caption + dots (hors de l'image pour éviter de masquer la photo en mobile) */}
      <div className="mt-3 rounded-sm border border-border bg-card/80 backdrop-blur-md p-3 sm:p-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-mono text-primary flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            <span className="truncate">{slides[i].label}</span>
          </div>
          <div className="mt-1 text-xs sm:text-sm text-muted-foreground break-words">{slides[i].meta}</div>
        </div>
        <div className="flex gap-1.5 shrink-0 pt-1">
          {slides.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setI(idx)}
              aria-label={`Photo ${idx + 1}`}
              className={`h-1.5 rounded-full transition-all ${
                idx === i ? "w-6 bg-primary" : "w-1.5 bg-border hover:bg-muted-foreground"
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
