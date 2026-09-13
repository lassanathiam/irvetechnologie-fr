import { useEffect, useState } from "react";

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
    const t = setInterval(() => setI((v) => (v + 1) % safeItems.length), 2800);
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
      </div>
    </div>
  );
}
