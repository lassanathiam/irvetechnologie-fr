import { useState, type InputHTMLAttributes } from "react";

/** « lundi 13 octobre » à partir d'une valeur de champ date / date-heure. */
export function jourTexte(v: string | null | undefined) {
  if (!v) return "";
  const d = new Date(v.length === 10 ? `${v}T12:00` : v);
  if (Number.isNaN(d.getTime())) return "";
  const j = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  return v.length > 10 ? `${j} à ${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : j;
}

/** Champ date ou date-heure qui affiche le nom du jour en dessous. */
export function DateAvecJour(props: InputHTMLAttributes<HTMLInputElement>) {
  const [val, setVal] = useState(String(props.value ?? props.defaultValue ?? ""));
  const courant = props.value !== undefined ? String(props.value) : val;
  return (
    <>
      <input
        {...props}
        onChange={(e) => {
          setVal(e.target.value);
          props.onChange?.(e);
        }}
      />
      {courant && <span className="mt-1 block text-sm font-semibold capitalize text-primary">{jourTexte(courant)}</span>}
    </>
  );
}
