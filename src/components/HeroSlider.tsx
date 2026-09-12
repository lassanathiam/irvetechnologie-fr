import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Slide = { src: string; label: string; meta: string };

export function HeroSlider({ slides, interval = 5000 }: { slides: Slide[]; interval?: number }) {
  if (!slides?.length) {
    return (
      <div className="relative rounded-sm w-full aspect-square overflow-hidden bg-card border border-border p-6 flex items-end">
        <div className="backdrop-blur-md bg-background/70 border border-border rounded-sm p-4">
          <p className="text-mono text-primary">Photos en cours de publication</p>
          <p className="text-sm text-muted-foreground mt-1">
            Ajoutez des photos réelles depuis l&apos;espace pro pour alimenter ce diaporama.
          </p>
        </div>
      </div>
    );
  }

  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setI((v) => (v + 1) % slides.length), interval);
    return () => clearInterval(t);
  }, [paused, interval, slides.length]);

  const go = (d: number) => setI((v) => (v + d + slides.length) % slides.length);

  return (
    <div
      className="relative"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="absolute inset-0 -m-4 border border-primary/20 rounded-sm animate-glow" aria-hidden />
      <div className="relative rounded-sm w-full aspect-square overflow-hidden bg-card">
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

        {/* caption + dots */}
        <div className="absolute bottom-6 left-6 right-6 backdrop-blur-md bg-background/70 border border-border p-4 rounded-sm flex justify-between items-center">
          <div>
            <div className="text-mono text-primary flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              {slides[i].label}
            </div>
            <div className="mt-1 text-sm">{slides[i].meta}</div>
          </div>
          <div className="flex gap-1.5">
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
    </div>
  );
}
