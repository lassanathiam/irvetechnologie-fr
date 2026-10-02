import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export type PhotoLightboxPhoto = {
  id: string;
  url: string;
  libelle?: string;
};

/**
 * Visionneuse plein écran : une photo en grand, on fait défiler pour voir
 * toutes les photos du chantier (glisser du doigt, flèches ou boutons).
 */
export default function PhotoLightbox({
  photos,
  index,
  onIndexChange,
  onClose,
}: {
  photos: PhotoLightboxPhoto[];
  index: number;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) {
  const touchX = useRef<number | null>(null);
  const [chargement, setChargement] = useState(true);
  const photo = photos[index];

  useEffect(() => {
    setChargement(true);
  }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && index > 0) onIndexChange(index - 1);
      if (e.key === "ArrowRight" && index < photos.length - 1) onIndexChange(index + 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, photos.length, onClose, onIndexChange]);

  if (!photo) return null;
  const plusieurs = photos.length > 1;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-black/95"
      role="dialog"
      aria-label="Visionneuse de photos"
      onTouchStart={(e) => {
        touchX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const depart = touchX.current;
        touchX.current = null;
        if (depart == null) return;
        const delta = (e.changedTouches[0]?.clientX ?? depart) - depart;
        if (delta < -50 && index < photos.length - 1) onIndexChange(index + 1);
        if (delta > 50 && index > 0) onIndexChange(index - 1);
      }}
    >
      <div className="flex items-center justify-between gap-2 p-3">
        <span className="text-sm font-bold text-white">
          {plusieurs ? `${index + 1} / ${photos.length}` : ""}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="grid h-11 w-11 place-items-center rounded-lg bg-white/10 text-white"
          aria-label="Fermer la visionneuse"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2">
        {plusieurs && index > 0 && (
          <button
            type="button"
            onClick={() => onIndexChange(index - 1)}
            className="absolute left-1 z-10 grid h-12 w-12 place-items-center rounded-full bg-white/10 text-white"
            aria-label="Photo précédente"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        <img
          key={photo.id}
          src={photo.url}
          alt={photo.libelle ?? "Photo de chantier"}
          onLoad={() => setChargement(false)}
          className="max-h-full max-w-full rounded-lg object-contain"
        />
        {chargement && (
          <span className="absolute text-sm text-white/70">Chargement…</span>
        )}
        {plusieurs && index < photos.length - 1 && (
          <button
            type="button"
            onClick={() => onIndexChange(index + 1)}
            className="absolute right-1 z-10 grid h-12 w-12 place-items-center rounded-full bg-white/10 text-white"
            aria-label="Photo suivante"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>

      {photo.libelle && (
        <p className="px-4 pb-1 pt-2 text-center text-sm font-semibold text-white">
          {photo.libelle}
        </p>
      )}
      {plusieurs && (
        <div className="flex gap-1.5 overflow-x-auto px-4 pb-4 pt-2">
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => onIndexChange(i)}
              className={`h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 ${
                i === index ? "border-primary" : "border-transparent opacity-60"
              }`}
              aria-label={`Voir la photo ${i + 1}`}
            >
              <img src={p.url} alt="" className="h-full w-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
