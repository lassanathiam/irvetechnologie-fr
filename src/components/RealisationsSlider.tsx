import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, MapPin } from "lucide-react";

type Item = { src: string; title: string; place: string; spec: string };

export function RealisationsSlider({ items }: { items: Item[] }) {
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setI((v) => (v + 1) % items.length), 4500);
    return () => clearInterval(t);
  }, [paused, items.length]);

  const go = (d: number) => setI((v) => (v + d + items.length) % items.length);
  const active = items[i];

  return (
    <div
      className="grid lg:grid-cols-5 gap-6 items-stretch"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative lg:col-span-3 aspect-[4/3] rounded-sm overflow-hidden border border-border bg-card">
        {items.map((it, idx) => (
          <img
            key={it.src}
            src={it.src}
            alt={it.title}
            loading="lazy"
            className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-700 ${
              idx === i ? "opacity-100 animate-kenburns" : "opacity-0"
            }`}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" aria-hidden />
        <button onClick={() => go(-1)} className="absolute left-3 top-1/2 -translate-y-1/2 bg-background/70 backdrop-blur border border-border p-2 rounded-sm hover:border-primary hover:text-primary transition" aria-label="Précédent">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button onClick={() => go(1)} className="absolute right-3 top-1/2 -translate-y-1/2 bg-background/70 backdrop-blur border border-border p-2 rounded-sm hover:border-primary hover:text-primary transition" aria-label="Suivant">
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="absolute bottom-3 left-3 right-3 flex justify-between items-end">
          <div className="text-mono text-primary bg-background/80 backdrop-blur px-2 py-1 rounded-sm">
            {String(i + 1).padStart(2, "0")} / {String(items.length).padStart(2, "0")}
          </div>
          <div className="flex gap-1.5">
            {items.map((_, idx) => (
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

      <div className="lg:col-span-2 flex flex-col justify-between gap-6 border border-border rounded-sm p-8 bg-card/50">
        <div key={active.title} className="animate-fade-up">
          <div className="text-mono text-primary mb-3 flex items-center gap-2">
            <MapPin className="h-3 w-3" /> {active.place}
          </div>
          <h3 className="text-2xl md:text-3xl font-medium tracking-tight">{active.title}</h3>
          <p className="mt-4 text-muted-foreground">{active.spec}</p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {items.map((it, idx) => (
            <button
              key={it.src}
              onClick={() => setI(idx)}
              className={`aspect-square rounded-sm overflow-hidden border-2 transition ${idx === i ? "border-primary" : "border-border hover:border-muted-foreground"}`}
              aria-label={it.title}
            >
              <img src={it.src} alt="" loading="lazy" className="w-full h-full object-cover" />
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
