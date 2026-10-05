/** Types et utilitaires partagés (client + serveur) des modèles de rapport donneur d'ordre. */
export type ChampType = "texte" | "zone" | "nombre" | "date" | "case" | "ouinon";
export type ChampAuto = "client_nom" | "adresse" | "date" | "technicien" | "telephone" | "entreprise" | "projet" | "phase" | "ville" | null;
export type PlacementRapport = { page: number; x: number; y: number; w: number; h: number };
export type ModeleChamp = { id: string; label: string; type: ChampType; auto?: ChampAuto; placement?: PlacementRapport | null };
export type ModeleSection = { titre: string; champs: ModeleChamp[] };
export type ModeleOriginal = { data_url: string; type: "pdf" | "image" };
export type ModeleStructure = {
  titre: string;
  sections: ModeleSection[];
  original?: ModeleOriginal | null;
  signatures?: { technicien?: PlacementRapport | null; client?: PlacementRapport | null };
};

const TYPES: ChampType[] = ["texte", "zone", "nombre", "date", "case", "ouinon"];
const AUTOS = ["client_nom", "adresse", "date", "technicien", "telephone", "entreprise", "projet", "phase", "ville"];

/** Nettoie une structure (IA ou saisie) pour garantir un format valide. */
export function normaliserStructure(raw: unknown): ModeleStructure {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const sections = Array.isArray(o["sections"]) ? (o["sections"] as unknown[]) : [];
  const originalRaw = (o["original"] && typeof o["original"] === "object" ? o["original"] : null) as Record<string, unknown> | null;
  const signaturesRaw = (o["signatures"] && typeof o["signatures"] === "object" ? o["signatures"] : null) as Record<string, unknown> | null;
  const placement = (v: unknown): PlacementRapport | null => {
    if (!v || typeof v !== "object") return null;
    const p = v as Record<string, unknown>;
    const page = Math.max(0, Math.floor(Number(p["page"]) || 0));
    const x = Math.max(0, Math.min(0.98, Number(p["x"]) || 0));
    const y = Math.max(0, Math.min(0.98, Number(p["y"]) || 0));
    const w = Math.max(0.03, Math.min(1 - x, Number(p["w"]) || 0.2));
    const h = Math.max(0.018, Math.min(1 - y, Number(p["h"]) || 0.035));
    return { page, x, y, w, h };
  };
  let n = 0;
  return {
    titre: String(o["titre"] ?? "Rapport d'intervention").slice(0, 160),
    original:
      originalRaw && typeof originalRaw["data_url"] === "string" && /^data:(application\/pdf|image\/(jpeg|png|webp));base64,/.test(originalRaw["data_url"])
        ? { data_url: originalRaw["data_url"], type: originalRaw["type"] === "pdf" ? "pdf" : "image" }
        : null,
    signatures: signaturesRaw
      ? { technicien: placement(signaturesRaw["technicien"]), client: placement(signaturesRaw["client"]) }
      : undefined,
    sections: sections.slice(0, 30).map((s) => {
      const so = (s && typeof s === "object" ? s : {}) as Record<string, unknown>;
      const champs = Array.isArray(so["champs"]) ? (so["champs"] as unknown[]) : [];
      return {
        titre: String(so["titre"] ?? "").slice(0, 160),
        champs: champs.slice(0, 80).map((c) => {
          const co = (c && typeof c === "object" ? c : {}) as Record<string, unknown>;
          const type = TYPES.includes(co["type"] as ChampType) ? (co["type"] as ChampType) : "texte";
          const auto = AUTOS.includes(String(co["auto"])) ? (co["auto"] as ChampAuto) : null;
          n += 1;
          return {
            id: String(co["id"] ?? "").trim() || `c${n}-${Math.random().toString(36).slice(2, 7)}`,
            label: String(co["label"] ?? "Champ").slice(0, 200),
            type,
            auto,
            placement: placement(co["placement"]),
          };
        }),
      };
    }),
  };
}

export const TYPE_LABELS: Record<ChampType, string> = {
  texte: "Texte court",
  zone: "Texte long",
  nombre: "Nombre",
  date: "Date",
  case: "Case à cocher",
  ouinon: "Oui / Non",
};

/** Trouve le modèle correspondant au donneur d'ordre d'un chantier. */
export function modelePourPartenaire<T extends { donneur_ordre: string; actif: boolean }>(
  modeles: T[],
  partenaire: string | null | undefined,
): T | null {
  const p = (partenaire ?? "").toLowerCase().trim();
  if (!p) return null;
  return (
    modeles.find((m) => {
      const d = m.donneur_ordre.toLowerCase().trim();
      return m.actif && d && (p.includes(d) || d.includes(p));
    }) ?? null
  );
}
