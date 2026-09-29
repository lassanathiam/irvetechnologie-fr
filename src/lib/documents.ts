// Types et constantes partagés (client + serveur) pour l'onglet Documents.

export const DOSSIERS = [
  { cle: "contrats", label: "Contrats" },
  { cle: "assurances", label: "Assurances" },
  { cle: "qualifications", label: "Qualifications (P1/P2/P3)" },
  { cle: "administratif", label: "Administratif" },
  { cle: "clients", label: "Clients" },
  { cle: "autres", label: "Autres" },
] as const;

export type DossierCle = (typeof DOSSIERS)[number]["cle"];

export const STATUT_DOC: Record<string, { label: string; cls: string }> = {
  brouillon: { label: "Brouillon", cls: "bg-muted text-muted-foreground" },
  envoye: { label: "Envoyé", cls: "bg-primary/15 text-primary" },
  consulte: { label: "Consulté", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-300" },
  signe: { label: "Signé", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300" },
  refuse: { label: "Refusé", cls: "bg-destructive/15 text-destructive" },
};

export type ZoneType = "signature" | "paraphe" | "nom" | "date" | "mention";
export type Role = "irve" | "client";

export type Zone = {
  id: string;
  page: number; // 0 = première page
  x: number; // fractions de la page (0..1), origine en haut à gauche
  y: number;
  w: number;
  h: number;
  type: ZoneType;
  role: Role;
};

export type Signataire = {
  role: Role;
  nom: string;
  email?: string | null;
  telephone?: string | null;
  signed_at?: string | null;
  ip?: string | null;
};

export const ZONE_LABEL: Record<ZoneType, string> = {
  signature: "Signature",
  paraphe: "Paraphe",
  nom: "Nom",
  date: "Date",
  mention: "Lu et approuvé",
};

export const TAILLE_ZONE: Record<ZoneType, { w: number; h: number }> = {
  signature: { w: 0.28, h: 0.08 },
  paraphe: { w: 0.1, h: 0.045 },
  nom: { w: 0.25, h: 0.03 },
  date: { w: 0.16, h: 0.03 },
  mention: { w: 0.22, h: 0.03 },
};

export function nouvelleZone(type: ZoneType, role: Role, page: number, x = 0.55, y = 0.8): Zone {
  const t = TAILLE_ZONE[type];
  return {
    id: Math.random().toString(36).slice(2, 10),
    page,
    x: Math.min(x, 1 - t.w),
    y: Math.min(y, 1 - t.h),
    w: t.w,
    h: t.h,
    type,
    role,
  };
}

export function normaliserZones(input: unknown, nbPages: number): Zone[] {
  if (!Array.isArray(input)) return [];
  const types: ZoneType[] = ["signature", "paraphe", "nom", "date", "mention"];
  const out: Zone[] = [];
  for (const z of input) {
    if (!z || typeof z !== "object") continue;
    const o = z as Record<string, unknown>;
    const type = types.includes(o["type"] as ZoneType) ? (o["type"] as ZoneType) : null;
    if (!type) continue;
    const role: Role = o["role"] === "irve" ? "irve" : "client";
    const page = Math.max(0, Math.min(nbPages - 1, Math.round(Number(o["page"]) || 0)));
    const t = TAILLE_ZONE[type];
    const w = clamp(Number(o["w"]) || t.w, 0.03, 0.9);
    const h = clamp(Number(o["h"]) || t.h, 0.015, 0.3);
    out.push({
      id: typeof o["id"] === "string" ? (o["id"] as string) : Math.random().toString(36).slice(2, 10),
      page,
      x: clamp(Number(o["x"]) || 0, 0, 1 - w),
      y: clamp(Number(o["y"]) || 0, 0, 1 - h),
      w,
      h,
      type,
      role,
    });
  }
  return out.slice(0, 200);
}

function clamp(v: number, a: number, b: number) {
  return Math.max(a, Math.min(b, v));
}
