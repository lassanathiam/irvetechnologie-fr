/** Types et utilitaires partagés (client + serveur) des modèles de rapport donneur d'ordre. */
export type ChampType = "texte" | "zone" | "nombre" | "date" | "case" | "ouinon";
export type ChampAuto = "client_nom" | "adresse" | "date" | "technicien" | "telephone" | null;
export type ModeleChamp = { id: string; label: string; type: ChampType; auto?: ChampAuto };
export type ModeleSection = { titre: string; champs: ModeleChamp[] };
export type ModeleStructure = { titre: string; sections: ModeleSection[] };

const TYPES: ChampType[] = ["texte", "zone", "nombre", "date", "case", "ouinon"];
const AUTOS = ["client_nom", "adresse", "date", "technicien", "telephone"];

/** Nettoie une structure (IA ou saisie) pour garantir un format valide. */
export function normaliserStructure(raw: unknown): ModeleStructure {
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const sections = Array.isArray(o["sections"]) ? (o["sections"] as unknown[]) : [];
  let n = 0;
  return {
    titre: String(o["titre"] ?? "Rapport d'intervention").slice(0, 160),
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
