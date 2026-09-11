type DossierFiltrable = {
  client_nom?: string | null;
  adresse?: string | null;
  cp_ville?: string | null;
  designation?: string | null;
  client_telephone?: string | null;
  client_email?: string | null;
};

export function dossierCorrespondAuFiltre(
  dossier: DossierFiltrable,
  filtreTexte: string,
): boolean {
  const texteFiltre = filtreTexte.trim().toLocaleLowerCase("fr-FR");
  if (texteFiltre.length === 0) return true;
  return [
    dossier.client_nom ?? "",
    dossier.adresse ?? "",
    dossier.cp_ville ?? "",
    dossier.designation ?? "",
    dossier.client_telephone ?? "",
    dossier.client_email ?? "",
  ]
    .join(" ")
    .toLocaleLowerCase("fr-FR")
    .includes(texteFiltre);
}
