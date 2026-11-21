/**
 * Recherche des documents (devis, attachements, factures) par période et par texte.
 *
 * Module navigateur, sans base de données : la même règle sert aux trois listes.
 * Les semaines vont du lundi au dimanche ; la date utilisée est la date d'émission.
 */
import type { Periode } from "@/lib/factures-par-client";

export type CleRecherche =
  | "tout"
  | "semaine_courante"
  | "semaine_precedente"
  | "mois_courant"
  | "mois_precedent"
  | "semaine"
  | "mois"
  | "personnalise";

export type ChoixPeriode = {
  cle: CleRecherche;
  /** Un jour quelconque de la semaine choisie (YYYY-MM-DD). */
  semaine: string;
  /** Mois choisi (YYYY-MM). */
  mois: string;
  /** Dates saisies à la main (YYYY-MM-DD), chacune facultative. */
  du: string;
  au: string;
};

export const CHOIX_PERIODE_DEFAUT: ChoixPeriode = { cle: "tout", semaine: "", mois: "", du: "", au: "" };

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const jourFr = (s: string) => {
  const [a, m, j] = s.split("-");
  return `${j}/${m}/${a}`;
};
const moisLong = (ymdStr: string) => {
  const [a, m] = ymdStr.split("-");
  const s = new Date(Number(a), Number(m) - 1, 1).toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
};
const versDate = (s: string) => {
  const [a, m, j] = s.split("-").map(Number);
  return new Date(a ?? 1970, (m ?? 1) - 1, j ?? 1, 12);
};

/** Numéro de semaine ISO (celui des calendriers français). */
export function numeroSemaine(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const jour = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - jour);
  const debutAnnee = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - debutAnnee.getTime()) / 864e5 + 1) / 7);
}

/** Semaine du lundi au dimanche contenant la date. */
export function semaineDe(date: Date): Periode {
  const lundi = new Date(date.getFullYear(), date.getMonth(), date.getDate() - ((date.getDay() + 6) % 7), 12);
  const dimanche = new Date(lundi.getFullYear(), lundi.getMonth(), lundi.getDate() + 6, 12);
  const du = ymd(lundi);
  const au = ymd(dimanche);
  return { du, au, libelle: `Semaine ${numeroSemaine(lundi)} · du ${jourFr(du)} au ${jourFr(au)}` };
}

function moisDe(annee: number, mois0: number): Periode {
  const du = ymd(new Date(annee, mois0, 1, 12));
  const au = ymd(new Date(annee, mois0 + 1, 0, 12));
  return { du, au, libelle: moisLong(du) };
}

/** Période correspondant au choix de l'écran. `aujourdhui` rend la règle testable. */
export function periodeRecherche(choix: ChoixPeriode, aujourdhui: Date = new Date()): Periode {
  switch (choix.cle) {
    case "tout":
      return { du: null, au: null, libelle: "Toutes les dates" };
    case "semaine_courante":
      return semaineDe(aujourdhui);
    case "semaine_precedente":
      return semaineDe(new Date(aujourdhui.getFullYear(), aujourdhui.getMonth(), aujourdhui.getDate() - 7, 12));
    case "mois_courant":
      return moisDe(aujourdhui.getFullYear(), aujourdhui.getMonth());
    case "mois_precedent":
      return moisDe(aujourdhui.getFullYear(), aujourdhui.getMonth() - 1);
    case "semaine":
      return /^\d{4}-\d{2}-\d{2}$/.test(choix.semaine) ? semaineDe(versDate(choix.semaine)) : semaineDe(aujourdhui);
    case "mois": {
      const m = /^(\d{4})-(\d{2})$/.exec(choix.mois);
      return m ? moisDe(Number(m[1]), Number(m[2]) - 1) : moisDe(aujourdhui.getFullYear(), aujourdhui.getMonth());
    }
    case "personnalise": {
      let du = choix.du.trim() || null;
      let au = choix.au.trim() || null;
      if (du && au && du > au) [du, au] = [au, du];
      const libelle =
        du && au
          ? `Du ${jourFr(du)} au ${jourFr(au)}`
          : du
            ? `À partir du ${jourFr(du)}`
            : au
              ? `Jusqu'au ${jourFr(au)}`
              : "Toutes les dates";
      return { du, au, libelle };
    }
  }
}

/** La date (YYYY-MM-DD…) est-elle dans la période, bornes comprises ? */
export function dateDansPeriode(date: string | null | undefined, periode: Periode): boolean {
  if (!periode.du && !periode.au) return true;
  const d = String(date ?? "").slice(0, 10);
  if (!d) return false;
  if (periode.du && d < periode.du) return false;
  if (periode.au && d > periode.au) return false;
  return true;
}

const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Tous les mots tapés doivent se retrouver dans au moins une des valeurs (accents et casse ignorés). */
export function correspondTexte(texte: string, valeurs: (string | number | null | undefined)[]): boolean {
  const mots = norm(texte).split(/\s+/).filter(Boolean);
  if (!mots.length) return true;
  const t = norm(valeurs.filter((v) => v !== null && v !== undefined && v !== "").join(" "));
  return mots.every((m) => t.includes(m));
}
