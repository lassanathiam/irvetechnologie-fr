import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import type { ChoixPeriode, CleRecherche } from "@/lib/recherche-periode";
import { CHOIX_PERIODE_DEFAUT, periodeRecherche } from "@/lib/recherche-periode";

const BOUTONS: { cle: CleRecherche; label: string }[] = [
  { cle: "tout", label: "Toutes les dates" },
  { cle: "semaine_courante", label: "Cette semaine" },
  { cle: "semaine_precedente", label: "Semaine dernière" },
  { cle: "mois_courant", label: "Ce mois-ci" },
  { cle: "mois_precedent", label: "Mois dernier" },
  { cle: "semaine", label: "Choisir une semaine" },
  { cle: "mois", label: "Choisir un mois" },
  { cle: "personnalise", label: "Dates manuelles" },
];

const aujourdhui = () => new Date().toISOString().slice(0, 10);

/** Barre de recherche commune : texte + semaine / mois / dates saisies à la main. */
export function RechercheDocuments({
  texte,
  onTexte,
  choix,
  onChoix,
  placeholder,
  resultat,
}: {
  texte: string;
  onTexte: (v: string) => void;
  choix: ChoixPeriode;
  onChoix: (c: ChoixPeriode) => void;
  placeholder: string;
  /** Ex. « 12 devis · 4 320,00 € TTC » */
  resultat?: string;
}) {
  const periode = periodeRecherche(choix);
  const actif = texte.trim() !== "" || choix.cle !== "tout";
  const choisir = (cle: CleRecherche) =>
    onChoix({
      ...choix,
      cle,
      semaine: cle === "semaine" && !choix.semaine ? aujourdhui() : choix.semaine,
      mois: cle === "mois" && !choix.mois ? aujourdhui().slice(0, 7) : choix.mois,
    });
  const champ = "w-auto rounded-sm border border-border bg-background px-2 py-1.5 text-sm";

  return (
    <div className="space-y-3 rounded-md border border-border bg-card p-3">
      <div className="relative">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input className="pl-9" placeholder={placeholder} value={texte} onChange={(e) => onTexte(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Période">
        {BOUTONS.map((b) => (
          <button
            key={b.cle}
            type="button"
            aria-pressed={choix.cle === b.cle}
            onClick={() => choisir(b.cle)}
            className={`rounded-sm border px-3 py-2 text-xs ${
              choix.cle === b.cle
                ? "border-primary bg-primary/15 font-semibold text-primary"
                : "border-border text-muted-foreground hover:border-primary hover:text-primary"
            }`}
          >
            {b.label}
          </button>
        ))}
      </div>
      {(choix.cle === "semaine" || choix.cle === "mois" || choix.cle === "personnalise") && (
        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
          {choix.cle === "semaine" && (
            <label className="flex items-center gap-2">
              Un jour de la semaine
              <input type="date" className={champ} value={choix.semaine} onChange={(e) => onChoix({ ...choix, semaine: e.target.value })} />
            </label>
          )}
          {choix.cle === "mois" && (
            <label className="flex items-center gap-2">
              Mois
              <input type="month" className={champ} value={choix.mois} onChange={(e) => onChoix({ ...choix, mois: e.target.value })} />
            </label>
          )}
          {choix.cle === "personnalise" && (
            <>
              <label className="flex items-center gap-2">
                Du
                <input type="date" className={champ} value={choix.du} onChange={(e) => onChoix({ ...choix, du: e.target.value })} />
              </label>
              <label className="flex items-center gap-2">
                au
                <input type="date" className={champ} value={choix.au} onChange={(e) => onChoix({ ...choix, au: e.target.value })} />
              </label>
            </>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="font-semibold text-primary">{periode.libelle}</span>
        {resultat && <span className="font-bold">{resultat}</span>}
        {actif && (
          <button
            type="button"
            onClick={() => {
              onTexte("");
              onChoix(CHOIX_PERIODE_DEFAUT);
            }}
            className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
          >
            <X className="h-3.5 w-3.5" /> Effacer la recherche
          </button>
        )}
      </div>
    </div>
  );
}
