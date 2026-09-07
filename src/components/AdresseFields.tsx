import { useEffect, useRef, useState } from "react";
import { MapPin } from "lucide-react";

type AdresseFeature = {
  properties: {
    label: string;
    name: string;
    housenumber?: string;
    street?: string;
    postcode: string;
    city: string;
  };
};

const INPUT_CLS =
  "mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm focus:outline-none focus:border-primary";

/**
 * Champs « Adresse » + « Code postal & ville » avec suggestions automatiques
 * via l'API Adresse officielle (data.gouv.fr), gratuite et sans clé.
 * La sélection remplit les deux champs, qui restent modifiables à la main.
 */
export function AdresseFields({ required }: { required?: boolean }) {
  const [adresse, setAdresse] = useState("");
  const [cpVille, setCpVille] = useState("");
  const [suggestions, setSuggestions] = useState<AdresseFeature[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function onAdresseChange(value: string) {
    setAdresse(value);
    if (timer.current) clearTimeout(timer.current);
    if (value.trim().length < 4) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://api-adresse.data.gouv.fr/search/?limit=5&q=${encodeURIComponent(value.trim())}`,
          { headers: { accept: "application/json" } },
        );
        if (!res.ok) return;
        const json = (await res.json()) as { features?: AdresseFeature[] };
        setSuggestions(json.features ?? []);
        setOpen(true);
      } catch {
        /* réseau indisponible : saisie manuelle toujours possible */
      }
    }, 300);
  }

  function pick(f: AdresseFeature) {
    const p = f.properties;
    setAdresse(p.name || p.label);
    setCpVille(`${p.postcode} ${p.city}`);
    setSuggestions([]);
    setOpen(false);
  }

  return (
    <>
      <div className="relative" ref={boxRef}>
        <label className="block">
          <span className="text-mono text-xs text-muted-foreground">Adresse du chantier</span>
          <input
            name="adresse"
            type="text"
            required={required}
            placeholder="12 rue des Lilas"
            value={adresse}
            onChange={(e) => onAdresseChange(e.target.value)}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            autoComplete="off"
            className={INPUT_CLS}
          />
        </label>
        {open && suggestions.length > 0 && (
          <ul className="absolute z-30 left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
            {suggestions.map((f, i) => (
              <li key={`${f.properties.label}-${i}`}>
                <button
                  type="button"
                  onClick={() => pick(f)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted/70 transition flex items-center gap-2"
                >
                  <MapPin className="h-3.5 w-3.5 text-primary shrink-0" />
                  <span className="truncate">{f.properties.label}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <label className="block">
        <span className="text-mono text-xs text-muted-foreground">Code postal & ville</span>
        <input
          name="cp_ville"
          type="text"
          placeholder="44000 Nantes"
          value={cpVille}
          onChange={(e) => setCpVille(e.target.value)}
          autoComplete="off"
          className={INPUT_CLS}
        />
      </label>
    </>
  );
}
