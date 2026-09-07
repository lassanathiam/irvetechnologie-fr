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
 *
 * Les deux champs sont NON contrôlés : la saisie clavier est toujours native
 * (aucun risque de perte de frappe si le parent se ré-affiche). La sélection
 * d'une suggestion écrit directement dans les champs.
 */
export function AdresseFields({ required }: { required?: boolean }) {
  const [suggestions, setSuggestions] = useState<AdresseFeature[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const adresseRef = useRef<HTMLInputElement>(null);
  const cpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  function onAdresseChange(value: string) {
    if (timer.current) clearTimeout(timer.current);
    if (value.trim().length < 4) {
      setSuggestions([]);
      setOpen(false);
      return;
    }
    timer.current = setTimeout(async () => {
      try {
        // On enrichit la recherche avec le code postal / la ville si déjà saisi,
        // cela améliore fortement les résultats en zone rurale.
        const cpVille = cpRef.current?.value.trim() ?? "";
        const q = cpVille ? `${value.trim()} ${cpVille}` : value.trim();
        const res = await fetch(
          `https://api-adresse.data.gouv.fr/search/?limit=7&q=${encodeURIComponent(q)}`,
          { headers: { accept: "application/json" } },
        );
        if (!res.ok) return;
        const json = (await res.json()) as { features?: AdresseFeature[] };
        setSuggestions(json.features ?? []);
        setOpen(true);
      } catch {
        /* réseau indisponible : saisie manuelle toujours possible */
      }
    }, 350);
  }

  function pick(f: AdresseFeature) {
    const p = f.properties;
    if (adresseRef.current) adresseRef.current.value = p.name || p.label;
    if (cpRef.current) cpRef.current.value = `${p.postcode} ${p.city}`;
    setSuggestions([]);
    setOpen(false);
  }

  return (
    <>
      <div className="relative" ref={boxRef}>
        <label className="block">
          <span className="text-mono text-xs text-muted-foreground">Adresse du chantier</span>
          <input
            ref={adresseRef}
            name="adresse"
            type="text"
            required={required}
            placeholder="12 rue des Lilas"
            onChange={(e) => onAdresseChange(e.target.value)}
            onFocus={() => suggestions.length > 0 && setOpen(true)}
            autoComplete="off"
            className={INPUT_CLS}
          />
        </label>
        {open && suggestions.length === 0 && (
          <div className="absolute z-30 left-0 right-0 mt-1 bg-popover border border-border rounded-lg shadow-lg px-3 py-2 text-xs text-muted-foreground">
            Aucune suggestion trouvée — continuez la saisie manuellement, l'adresse sera enregistrée telle quelle.
          </div>
        )}
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
          ref={cpRef}
          name="cp_ville"
          type="text"
          placeholder="44000 Nantes"
          autoComplete="off"
          className={INPUT_CLS}
        />
      </label>
    </>
  );
}
