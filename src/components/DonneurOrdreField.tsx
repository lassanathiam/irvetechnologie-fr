import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listPartenaires } from "@/lib/partenaires.functions";

const norm = (x: string) => x.normalize("NFD").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();

/** Choix du donneur d'ordre : reconnaît la fiche partenaire et affiche ses coordonnées. */
export function DonneurOrdreField({ name, defaultValue = "", value, onChange, onMatch, className }: {
  name?: string;
  defaultValue?: string;
  value?: string;
  onChange?: (v: string) => void;
  onMatch?: (p: { nom: string; delai_paiement_jours: number } | null) => void;
  className?: string;
}) {
  const fn = useServerFn(listPartenaires);
  const q = useQuery({ queryKey: ["partenaires"], queryFn: () => fn() });
  const [local, setLocal] = useState(defaultValue);
  const v = value ?? local;
  const p = v.trim() ? (q.data ?? []).find((x) => norm(x.nom) === norm(v)) : undefined;
  return (
    <div>
      <input
        name={name}
        list="liste-donneurs-ordre"
        value={v}
        placeholder="Choisissez ou tapez (ex. ENSIO)"
        className={className ?? "mt-2 w-full bg-input border border-border rounded-sm px-3 py-2.5 text-sm"}
        onChange={(e) => {
          setLocal(e.target.value);
          onChange?.(e.target.value);
          const m = (q.data ?? []).find((x) => norm(x.nom) === norm(e.target.value));
          onMatch?.(m ? { nom: m.nom, delai_paiement_jours: m.delai_paiement_jours } : null);
          if (m) {
            const origine = e.target.form?.elements.namedItem("origine");
            if (origine instanceof HTMLSelectElement) origine.value = "sous_traitance";
          }
        }}
      />
      <datalist id="liste-donneurs-ordre">
        {(q.data ?? []).filter((x) => x.actif).map((x) => <option key={x.id} value={x.nom} />)}
      </datalist>
      {p && (
        <p className="mt-1 text-xs text-primary">
          Fiche reconnue : {p.raison_sociale || p.nom}
          {p.contact_nom ? ` · ${p.contact_nom}` : ""}
          {p.email ? ` · retours envoyés à ${p.email}` : " · aucun email enregistré (à ajouter dans Partenaires)"}
          {` · paiement ${p.delai_paiement_jours} j`}
        </p>
      )}
    </div>
  );
}
