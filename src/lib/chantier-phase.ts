/** Repère visuel uniquement : ne déduit jamais l'alimentation depuis la borne. */
export function estChantierTriphase(chantier: { phase_installation?: string | null }): boolean {
  const phase = (chantier.phase_installation ?? "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  return ["tri", "triphase", "triphasee", "triphase 400v", "triphase 400 v"].includes(phase);
}