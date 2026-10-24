import type { RdvExtrait } from "./import-rdv.functions";
import type { FicheExtraite } from "./fiches-techniques.functions";
import { detecterReseauClient } from "./reseau-client";

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const mois = ["janvier", "fevrier", "mars", "avril", "mai", "juin", "juillet", "aout", "septembre", "octobre", "novembre", "decembre"];
const pad = (n: number) => String(n).padStart(2, "0");

export function dateLocaleImport(texte: string, maintenant = new Date()): string | null {
  const t = norm(texte);
  const iso = t.match(/\b(20\d{2})-(\d{2})-(\d{2})(?:t|\s)+(\d{1,2}):(\d{2})/);
  const fr = t.match(/\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{4}|\d{2}))?\b/);
  const longue = t.match(new RegExp(`\\b(\\d{1,2})\\s+(${mois.join("|")})(?:\\s+(20\\d{2}))?\\b`));
  const heure = t.match(/\b(\d{1,2})\s*[h:]\s*(\d{2})?\b/);
  if (!iso && !fr && !longue) return null;
  if (!iso && !heure) return null;
  const jour = Number(iso?.[3] ?? fr?.[1] ?? longue?.[1]);
  const m = iso ? Number(iso[2]) : fr ? Number(fr[2]) : mois.indexOf(longue?.[2] ?? "") + 1;
  const explicite = iso?.[1] ?? fr?.[3] ?? longue?.[3];
  let annee = explicite ? Number(explicite.length === 2 ? `20${explicite}` : explicite) : maintenant.getFullYear();
  const h = Number(iso?.[4] ?? heure?.[1]);
  const minute = Number(iso?.[5] ?? heure?.[2] ?? 0);
  if (h > 23 || minute > 59 || m < 1 || m > 12 || jour < 1) return null;
  const valid = (a: number) => new Date(a, m - 1, jour).getMonth() === m - 1 && new Date(a, m - 1, jour).getDate() === jour;
  if (!valid(annee)) return null;
  if (!explicite && new Date(annee, m - 1, jour, h, minute) < maintenant) annee++;
  if (!valid(annee)) return null;
  return `${annee}-${pad(m)}-${pad(jour)}T${pad(h)}:${pad(minute)}`;
}

function valeur(texte: string, labels: string): string | null {
  const re = new RegExp(`(?:^|[\\n;|]|\\s[—–]\\s)\\s*(?:${labels})\\s*[:=]\\s*([^\\n;|]+)`, "im");
  return texte.match(re)?.[1]?.split(/\s[—–]\s/)[0]?.trim() || null;
}

function intervention(texte: string, maintenant: Date): RdvExtrait {
  const telephone = texte.match(/(?:\+33\s*(?:\(0\)\s*)?|0)[1-9](?:[ .-]?\d{2}){4}\b/)?.[0] ?? null;
  const cp = texte.match(/\b\d{5}\s+[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ '\-]*/)?.[0]?.trim() ?? null;
  const adresse = valeur(texte, "adresse(?: du chantier| d'intervention)?") ?? texte.match(/\b\d{1,4}\s*(?:bis\s+|ter\s+)?(?:rue|avenue|av\.|boulevard|bd|route|chemin|impasse|allée|allee|place|lieu-dit)\s+[^\n;,|—–]+/i)?.[0]?.replace(/\s*\d{5}\s.*$/, "").trim() ?? "";
  const civilite = texte.match(/\b(?:Mme|Monsieur|Madame|Mr|M\.)\s+([^\n;,|—–]+)/i)?.[0]?.trim();
  const n = norm(texte);
  const type: RdvExtrait["type"] = /depannage|\bsav\b/.test(n) ? "sav" : /maintenance/.test(n) ? "maintenance" : /visite/.test(n) ? "visite" : /controle/.test(n) ? "controle" : "installation";
  const debut = dateLocaleImport(texte, maintenant);
  const plage = texte.match(/\b\d{1,2}[h:]\s*\d{0,2}\s*(?:et|à|a|-|–|\/|jusqu'à)\s*(\d{1,2})[h:]?\s*(\d{2})?\b/i);
  const fin = plage && Number(plage[1]) < 24 && Number(plage[2] ?? 0) < 60 ? `${pad(Number(plage[1]))}:${pad(Number(plage[2] ?? 0))}` : null;
  return {
    client_nom: valeur(texte, "client(?:_nom)?|nom(?: du client)?|bénéficiaire|beneficiaire") ?? civilite ?? "Client à préciser",
    reseau_client: valeur(texte, "réseau(?:_client)?|reseau(?:_client)?|enseigne|opérateur|operateur") ?? detecterReseauClient(texte),
    client_telephone: telephone?.replace(/[ .()-]/g, "").replace(/^\+33/, "0") ?? null,
    client_email: texte.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null,
    adresse, cp_ville: valeur(texte, "cp.?ville|code postal(?: et ville)?") ?? cp,
    date_debut: debut, creneau_fin: fin, type,
    designation: valeur(texte, "désignation|designation|matériel|materiel|prestation"),
    numero_dossier: valeur(texte, "(?:n[°o]\\s*)?(?:dossier|ticket|commande|référence|reference)"),
    notes: texte.trim().slice(0, 3000),
  };
}

const colonnes: Record<string, string> = {
  client: "client", nom: "client", "nom du client": "client", client_nom: "client", beneficiaire: "client",
  adresse: "adresse", "adresse du chantier": "adresse", cp_ville: "cpville", "cp / ville": "cpville", "cp ville": "cpville", "code postal": "cp", cp: "cp", ville: "ville",
  telephone: "telephone", tel: "telephone", client_telephone: "telephone", email: "email", client_email: "email",
  date: "date", "date debut": "date", date_debut: "date", "date rdv": "date", heure: "heure", "heure debut": "heure",
  reseau: "reseau", reseau_client: "reseau", enseigne: "reseau", "client reseau": "reseau",
  type: "type", designation: "designation", prestation: "designation", dossier: "dossier", numero_dossier: "dossier", ticket: "dossier", commande: "dossier", notes: "notes",
};

/** Deterministic extraction only: retains source and leaves unknown fields empty for review. */
export function lireRdvSansIA(texte: string, maintenant = new Date()): RdvExtrait[] {
  if (!texte.trim()) return [];
  const lignes = texte.trim().split(/\r?\n/);
  const enteteIndex = lignes.findIndex((l) => {
    const cells = l.split(/\t|;/).map((c) => colonnes[norm(c)]);
    return cells.includes("client") && cells.includes("adresse");
  });
  if (enteteIndex >= 0) {
    const entete = lignes[enteteIndex];
    if (!entete) return [];
    const sep = entete.includes("\t") ? "\t" : ";";
    const headers = entete.split(sep).map((c) => colonnes[norm(c)]);
    return lignes.slice(enteteIndex + 1).filter((l) => l.trim()).map((l) => {
      const values = l.split(sep);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => { if (h) row[h] = values[i]?.trim() ?? ""; });
      const source = Object.entries(row).map(([k, v]) => `${k}: ${v}`).join("\n");
      const r = intervention(source, maintenant);
      return { ...r, client_nom: row.client || "Client à préciser", adresse: row.adresse || "", cp_ville: row.cpville || [row.cp, row.ville].filter(Boolean).join(" ") || null,
        date_debut: dateLocaleImport(`${row.date ?? ""} ${row.heure ?? ""}`, maintenant), reseau_client: row.reseau || r.reseau_client,
        numero_dossier: row.dossier || null, designation: row.designation || null, notes: row.notes || source };
    });
  }
  const parClient = texte.trim().split(/\n(?=\s*(?:client(?:_nom)?|nom du client|bénéficiaire)\s*[:=])/i);
  const blocs = parClient.length > 1 ? parClient : texte.trim().split(/\n\s*\n+/);
  const independants = blocs.length > 1 && blocs.every((b) => /\b(?:rue|avenue|route|chemin|adresse)\b/i.test(b));
  if (independants) return blocs.map((b) => intervention(b, maintenant));
  const parLigne = lignes.filter((l) => l.trim());
  if (parLigne.length > 1 && parLigne.every((l) => /\b\d{1,4}\s+(?:rue|avenue|route|chemin|impasse)\b/i.test(l))) return parLigne.map((l) => intervention(l, maintenant));
  return [intervention(texte, maintenant)];
}

export function lireFicheSansIA(texte: string): FicheExtraite {
  const r = intervention(texte, new Date());
  const puissance = texte.match(/\b\d{1,2}(?:[.,]\d)?\s*kW\b/i)?.[0] ?? null;
  const metrage = texte.match(/(?:métrage|metrage|longueur(?: de câble)?|câble|cable)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*m\b/i)?.[1];
  return { client_nom: r.client_nom === "Client à préciser" ? null : r.client_nom, adresse: r.adresse || null, cp_ville: r.cp_ville,
    puissance_borne: puissance, phase_installation: /triphas[eé]/i.test(texte) ? "Triphasé" : /monophas[eé]/i.test(texte) ? "Monophasé" : null,
    type_pose: /pose\s*[:=]?\s*(?:sur pied|murale)/i.test(texte) ? (/sur pied/i.test(texte) ? "Sur pied" : "Murale") : null,
    metrage_m: metrage ? Number(metrage.replace(",", ".")) : null,
    repartiteur: false, resume: texte.trim().slice(0, 2000) || null };
}