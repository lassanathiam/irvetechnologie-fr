import type { RdvExtrait } from "./import-rdv.functions";
import type { FicheExtraite } from "./fiches-techniques.functions";
import { detecterReseauClient } from "./reseau-client";
import { nettoyerTexteLu } from "./doublons-import";
import { premierTelephoneClient } from "./telephone-client";

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

// Personne qui a fait la visite technique (technicien, chargé d'affaires…) : jamais prise pour le client.
const RE_ROLE_TECH = new RegExp(
  String.raw`(?:^|[;|—–]\s*|\s)(?:nom\s+(?:du|de\s+l')\s*)?(?:technicien(?:ne)?|intervenant(?:e)?|visiteur|auteur(?:\s+de\s+la\s+visite)?|charg[ée]e?\s+d'affaires?|conducteur\s+de\s+travaux|commercial(?:e)?|contr[ôo]leur)(?:\s+(?:vt|visite|terrain|technique))?\s*(?:[:=]\s*(.*)|$)`,
  "i",
);
const RE_PAR_TECH = /(?:(?:visite(?:\s+technique)?|vt)\s+(?:r[ée]alis[ée]e?|effectu[ée]e?|faite)|r[ée]alis[ée]e?|effectu[ée]e?|r[ée]dig[ée]e?)\s+par\s*[:=]?\s*(.+)/i;

/** Keeps a short person name; sentences, numbers and emails are rejected so a paragraph never becomes a name. */
export function nomPersonne(v: string | null | undefined): string | null {
  const t = (v ?? "").split(/[,;|—–(]|\s(?:t[ée]l|tel|mail|email|portable)\b|\s(?:\+33|0[1-9])|\s(?:le|du|en date du)\s+\d/i)[0]?.replace(/[.:]+$/, "").trim() ?? "";
  if (!t || /\d|@/.test(t)) return null;
  const mots = t.split(/\s+/);
  if (mots.length > 5 || t.length > 70) return null;
  return t;
}

/** Splits the technical visitor's lines from the rest, so client fields are read only from the remaining text. */
export function separerTechnicien(texte: string): { technicien: string | null; reste: string } {
  const lignes = texte.split("\n");
  const reste: string[] = [];
  let technicien: string | null = null;
  for (let i = 0; i < lignes.length; i++) {
    const l = lignes[i] ?? "";
    const m = l.match(RE_ROLE_TECH) ?? l.match(RE_PAR_TECH);
    if (!m) { reste.push(l); continue; }
    const avant = l.slice(0, m.index ?? 0).replace(/[\s;|—–-]+$/, "");
    let nom = nomPersonne(m[1]);
    if (!m[1]?.trim()) {
      // Rubrique « Technicien » suivie de lignes Nom / Prénom / Tél.
      const parts: string[] = [];
      while (i + 1 < lignes.length && /^\s*(?:nom|pr[ée]nom|t[ée]l[ée]?phone|t[ée]l|portable|e-?mail|soci[ée]t[ée])\b/i.test(lignes[i + 1] ?? "")) {
        const v = (lignes[i + 1] ?? "").match(/^\s*(nom|pr[ée]nom)\s*[:=]\s*(.+)$/i);
        if (v) parts.push(v[2]!.trim());
        i++;
      }
      nom = nomPersonne(parts.join(" "));
    }
    technicien ??= nom;
    if (avant.trim()) reste.push(avant);
  }
  return { technicien, reste: reste.join("\n") };
}

const RE_REMARQUES = /(?:^|[\n;|])\s*(remarques?|observations?|commentaires?|acc[èe]s|contact sur place|informations? compl[ée]mentaires?|infos?|notes?|consignes?|particularit[ée]s?)\s*[:=]\s*([^\n;|]+)/gi;

/** Short useful remarks only (access, comments…), never the whole document copied into the dossier. */
export function remarquesUtiles(texte: string): string | null {
  const vus = new Set<string>();
  const out: string[] = [];
  for (const m of texte.matchAll(RE_REMARQUES)) {
    const v = m[2]!.trim().slice(0, 200);
    const cle = v.toLowerCase();
    if (v.length < 2 || vus.has(cle)) continue;
    vus.add(cle);
    out.push(`${m[1]!.charAt(0).toUpperCase()}${m[1]!.slice(1).toLowerCase()} : ${v}`);
  }
  return out.join("\n").slice(0, 600) || null;
}

function lireClient(texte: string): string | null {
  const explicite = valeur(texte, "client(?:_nom)?|nom(?: et pr[ée]nom)? du client|nom du b[ée]n[ée]ficiaire|b[ée]n[ée]ficiaire|propri[ée]taire|demandeur|occupant|particulier");
  if (explicite) return nomPersonne(explicite) ?? nomPersonne(explicite.match(/\b(?:Mme|Monsieur|Madame|Mr|M\.)\s+[^\n;,|—–.]+/i)?.[0]);
  const nom = valeur(texte, "nom");
  const prenom = valeur(texte, "pr[ée]nom");
  const generique = nomPersonne([nom, prenom].filter(Boolean).join(" "));
  if (generique) return generique;
  return nomPersonne(texte.match(/\b(?:Mme|Monsieur|Madame|Mr|M\.)\s+[^\n;,|—–.]+/i)?.[0]);
}

function analyse(texteBrut: string, maintenant: Date): RdvExtrait & { technicien: string | null; remarques: string | null } {
  const { technicien, reste: texte } = separerTechnicien(texteBrut);
  // Les fiches ENSIO impriment le numéro du sous-traitant (IRVE) : on prend le premier numéro qui n'est pas le nôtre.
  const telephone = premierTelephoneClient(texte);
  const cp = texte.match(/\b\d{5}\s+[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ '\-]*/)?.[0]?.trim() ?? null;
  const adresse = valeur(texte, "adresse(?: du chantier| d'intervention)?") ?? texte.match(/\b\d{1,4}\s*(?:bis\s+|ter\s+)?(?:rue|avenue|av\.|boulevard|bd|route|chemin|impasse|allée|allee|place|lieu-dit)\s+[^\n;,|—–]+/i)?.[0]?.replace(/\s*\d{5}\s.*$/, "").trim() ?? "";
  const n = norm(texteBrut);
  const type: RdvExtrait["type"] = /depannage|\bsav\b/.test(n) ? "sav" : /maintenance/.test(n) ? "maintenance" : /visite/.test(n) && !/visite technique (?:faite|realisee|effectuee)/.test(n) ? "visite" : /controle/.test(n) ? "controle" : "installation";
  const debut = dateLocaleImport(texte, maintenant);
  const plage = texte.match(/\b\d{1,2}[h:]\s*\d{0,2}\s*(?:et|à|a|-|–|\/|jusqu'à)\s*(\d{1,2})[h:]?\s*(\d{2})?\b/i);
  const fin = plage && Number(plage[1]) < 24 && Number(plage[2] ?? 0) < 60 ? `${pad(Number(plage[1]))}:${pad(Number(plage[2] ?? 0))}` : null;
  const remarques = remarquesUtiles(texte);
  return {
    client_nom: lireClient(texte) ?? "Client à préciser",
    reseau_client: valeur(texte, "réseau(?:_client)?|reseau(?:_client)?|enseigne|opérateur|operateur") ?? detecterReseauClient(texte),
    client_telephone: telephone,
    client_email: texte.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? null,
    adresse, cp_ville: valeur(texte, "cp.?ville|code postal(?: et ville)?") ?? cp,
    date_debut: debut, creneau_fin: fin, type,
    designation: valeur(texte, "désignation|designation|matériel|materiel|prestation"),
    numero_dossier: valeur(texte, "(?:n[°o]\\s*)?(?:dossier|ticket|commande|référence|reference)"),
    notes: [remarques, technicien ? `Visite technique faite par : ${technicien}` : null].filter(Boolean).join("\n") || null,
    technicien, remarques,
  };
}

function intervention(texte: string, maintenant: Date): RdvExtrait {
  const { technicien: _t, remarques: _r, ...rdv } = analyse(texte, maintenant);
  return rdv;
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
export function lireRdvSansIA(brut: string, maintenant = new Date()): RdvExtrait[] {
  const texte = nettoyerTexteLu(brut);
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
        numero_dossier: row.dossier || null, designation: row.designation || null, notes: row.notes?.trim() || r.notes };
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

export function lireFicheSansIA(brut: string): FicheExtraite {
  const texte = nettoyerTexteLu(brut);
  const r = analyse(texte, new Date());
  const puissance = texte.match(/\b\d{1,2}(?:[.,]\d)?\s*kW\b/i)?.[0] ?? null;
  const metrage = texte.match(/(?:métrage|metrage|longueur(?: de câble)?|câble|cable)\s*[:=]?\s*(\d+(?:[.,]\d+)?)\s*m\b/i)?.[1];
  const phase = /triphas[eé]/i.test(texte) ? "Triphasé" : /monophas[eé]/i.test(texte) ? "Monophasé" : null;
  const pose = /pose\s*[:=]?\s*(?:sur pied|murale)/i.test(texte) ? (/sur pied/i.test(texte) ? "Sur pied" : "Murale") : null;
  const metrageM = metrage ? Number(metrage.replace(",", ".")) : null;
  // Résumé court : les valeurs lues et les remarques, la fiche complète reste jointe au chantier.
  const points = [puissance, phase, pose ? `Pose ${pose.toLowerCase()}` : null, metrageM ? `Câble prévu : ${metrageM} m` : null].filter(Boolean).join(" · ");
  const resume = [r.technicien ? `Visite technique faite par : ${r.technicien}` : null, points || null, r.remarques].filter(Boolean).join("\n").slice(0, 1000) || null;
  return { client_nom: r.client_nom === "Client à préciser" ? null : r.client_nom, technicien: r.technicien, adresse: r.adresse || null, cp_ville: r.cp_ville,
    puissance_borne: puissance, phase_installation: phase, type_pose: pose, metrage_m: metrageM, repartiteur: false, resume };
}
