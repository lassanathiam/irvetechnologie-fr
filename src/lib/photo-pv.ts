import { pvPourReseau } from "@/lib/rapport-modeles";

/** Seuls les dossiers ENSIO/NCO dont le réseau demande un PV sont concernés. */
export function photoPvObligatoire(partenaire?: string | null, reseauClient?: string | null): boolean {
  return /ensio|nco/i.test(partenaire ?? "") && pvPourReseau(reseauClient)?.kind === "pv";
}

export function verifierPhotoPv(
  partenaire: string | null | undefined,
  reseauClient: string | null | undefined,
  photos: readonly { categorie: string }[],
  pvSigneDansApp = false,
): void {
  // Un PV rempli et signé dans l'application vaut preuve : pas besoin de le prendre en photo.
  if (pvSigneDansApp) return;
  if (photoPvObligatoire(partenaire, reseauClient) && !photos.some((p) => p.categorie === "pv_signe")) {
    throw new Error("Photo du PV manquante : ouvrez Photos puis « PV à prendre en photo » avant de terminer le chantier.");
  }
}