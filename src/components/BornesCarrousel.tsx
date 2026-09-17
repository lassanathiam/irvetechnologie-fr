import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowRight, ChevronLeft, ChevronRight, MoveHorizontal } from "lucide-react";
import { BORNES_CATALOGUE, BORNES_VEDETTES } from "@/lib/bornes-catalogue";

/**
 * Carrousel des bornes : défilement automatique (diaporama) + glisser-déplacer
 * à la souris ou au doigt, avec flèches et pause au survol.
 */
export function BornesCarrousel() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [grabbing, setGrabbing] = useState(false);
  const dragging = useRef(false);
  const moved = useRef(false);
  const startX = useRef(0);
  const startScroll = useRef(0);
  const pausedUntil = useRef(0);

  // Défilement automatique, en boucle (contenu dupliqué).
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    let raf = 0;
    let last = performance.now();
    const speed = 0.045; // px par ms
    const tick = (now: number) => {
      const dt = now - last;
      last = now;
      if (!dragging.current && now > pausedUntil.current) {
        el.scrollLeft += speed * dt;
        const half = el.scrollWidth / 2;
        if (el.scrollLeft >= half) el.scrollLeft -= half;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const pauseTemporairement = () => {
    pausedUntil.current = performance.now() + 3500;
  };

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    dragging.current = true;
    moved.current = false;
    startX.current = e.clientX;
    startScroll.current = trackRef.current?.scrollLeft ?? 0;
  };
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    const delta = e.clientX - startX.current;
    if (Math.abs(delta) > 6) {
      moved.current = true;
      setGrabbing(true);
    }
    if (moved.current && trackRef.current) {
      trackRef.current.scrollLeft = startScroll.current - delta;
    }
  };
  const endDrag = () => {
    dragging.current = false;
    setGrabbing(false);
    pauseTemporairement();
    // Laisse le clic se terminer puis réarme.
    setTimeout(() => {
      moved.current = false;
    }, 50);
  };

  const defiler = (sens: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    pauseTemporairement();
    el.scrollBy({ left: sens * 240, behavior: "smooth" });
  };

  return (
    <section className="border-y border-border py-10 overflow-hidden bg-white/[0.03]">
      <div className="mx-auto max-w-6xl px-6 pb-6 text-center">
        <p className="text-mono text-xs uppercase tracking-widest text-primary">Nos bornes</p>
        <h2 className="mt-3 text-3xl font-medium tracking-tight md:text-4xl">
          Vous connaissez déjà votre borne&nbsp;?
        </h2>
        <p className="mt-3 text-sm text-muted-foreground md:text-base">
          Demandez un devis rapidement : un clic sur la borne et votre demande s&apos;ouvre déjà préremplie avec le modèle et sa puissance.
        </p>
        <p className="mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-1.5 text-xs font-semibold text-muted-foreground">
          <MoveHorizontal className="h-4 w-4 text-primary" /> Glissez pour voir plus — ou laissez défiler
        </p>
      </div>

      <div className="relative">
        <button
          type="button"
          aria-label="Voir les bornes précédentes"
          onClick={() => defiler(-1)}
          className="absolute left-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-border bg-card/90 p-2.5 text-foreground shadow-lg transition hover:border-primary hover:text-primary sm:block"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label="Voir les bornes suivantes"
          onClick={() => defiler(1)}
          className="absolute right-2 top-1/2 z-10 hidden -translate-y-1/2 rounded-full border border-border bg-card/90 p-2.5 text-foreground shadow-lg transition hover:border-primary hover:text-primary sm:block"
        >
          <ChevronRight className="h-5 w-5" />
        </button>

        <div
          ref={trackRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerLeave={endDrag}
          onClickCapture={(e) => {
            if (moved.current) {
              e.preventDefault();
              e.stopPropagation();
            }
          }}
          className={`flex gap-6 overflow-x-auto px-6 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
            grabbing ? "cursor-grabbing select-none" : "cursor-grab"
          }`}
          style={{ touchAction: "pan-y" }}
        >
          {[...BORNES_VEDETTES, ...BORNES_VEDETTES].map((p, i) => (
            <Link
              key={i}
              to="/demande"
              search={{ borne: p.id }}
              draggable={false}
              className="group flex w-44 shrink-0 flex-col items-center gap-3 rounded-xl border border-border bg-card/70 p-4 transition hover:border-primary hover:bg-card"
            >
              <div className="flex h-24 w-24 items-center justify-center rounded-lg border border-border bg-premium-night/60 p-2">
                <img src={p.img} alt={`Borne ${p.nom}`} loading="lazy" width={96} height={96} draggable={false} className="h-full w-full object-contain" />
              </div>
              <span className="text-center text-sm font-semibold text-foreground">{p.nom}</span>
              <span className="hero-grad rounded-full px-3 py-1 text-xs font-semibold text-primary-foreground">
                {p.puissance} · {p.phase}
              </span>
              <span className="text-center text-xs text-muted-foreground">{p.atout}</span>
              {p.badge && (
                <span className="rounded-full border border-primary/50 bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                  {p.badge}
                </span>
              )}
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-primary opacity-0 transition group-hover:opacity-100">
                Demander un devis <ArrowRight className="h-3 w-3" />
              </span>
            </Link>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-6 pt-8 text-center">
        <Link
          to="/bornes"
          className="inline-flex items-center gap-2 rounded-full border border-primary/50 bg-primary/10 px-5 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary/20"
        >
          Plus de choix — voir les {BORNES_CATALOGUE.length} modèles
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
