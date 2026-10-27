export const NATURES_INTERVENTION = ["installation", "remplacement", "mise_en_service", "depose", "maintenance", "cablage", "depannage", "controle", "autre"] as const;
export type NatureIntervention = (typeof NATURES_INTERVENTION)[number];
export const INTERVENTIONS = [
  { value: "installation", label: "Pose de borne" },
  { value: "remplacement", label: "Remplacement de borne" },
  { value: "mise_en_service", label: "Mise en service (MES)" },
  { value: "depose", label: "Dépose de borne" },
  { value: "maintenance", label: "Maintenance" },
  { value: "cablage", label: "Tirage de câble supplémentaire" },
  { value: "depannage", label: "Dépannage / intervention sur borne" },
  { value: "controle", label: "Contrôle / mise en conformité" },
  { value: "autre", label: "Autre intervention" },
] as const;

export function interventionLibelle(rdv: { nature_dossier?: string | null; type?: string | null }): string {
  const explicite = INTERVENTIONS.find((n) => n.value === rdv.nature_dossier);
  if (explicite) return explicite.label;
  return ({ installation: "Installation · nature à préciser", maintenance: "Maintenance · nature à préciser", visite: "Visite technique", sav: "SAV / dépannage", controle: "Contrôle / conformité" } as Record<string, string>)[rdv.type ?? ""] ?? "Intervention à préciser";
}

export const MATERIEL_RECUPERE = [
  ["borne", "Borne complète (borne + support)"],
  ["badges", "Badge(s) RFID / carte"],
  ["protections", "Protections (disjoncteur, différentiel)"],
  ["parafoudre", "Coffret"],
  ["tore_mesure", "Tore de mesure"],
  ["cable", "Câble"],
  ["accessoires", "Visserie, notice, accessoires"],
] as const;

export function reponseMateriel(checklist: Record<string, boolean>, cle: string): "oui" | "non" | "inconnu" {
  return checklist[cle] === true ? "oui" : checklist[cle] === false ? "non" : "inconnu";
}

export function modifierReponseMateriel(checklist: Record<string, boolean>, cle: string, reponse: "oui" | "non" | "inconnu"): Record<string, boolean> {
  const resultat = { ...checklist };
  if (reponse === "inconnu") delete resultat[cle];
  else resultat[cle] = reponse === "oui";
  return resultat;
}