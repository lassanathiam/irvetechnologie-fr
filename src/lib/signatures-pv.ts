/**
 * Règle de conservation des signatures d'un PV : une signature déjà enregistrée
 * n'est jamais effacée par un nouvel enregistrement (même après fermeture du dossier) ;
 * seule une nouvelle signature la remplace. La date de signature d'origine est gardée.
 */
export type SignaturesPv = {
  signature_client: string | null;
  signature_technicien: string | null;
  signed_at: string | null;
};

export function fusionnerSignatures(
  avant: Partial<SignaturesPv> | null | undefined,
  nouvelles: { signature_client?: string | null; signature_technicien?: string | null },
  maintenant: string,
): SignaturesPv {
  const signature_client = nouvelles.signature_client || avant?.signature_client || null;
  const signature_technicien = nouvelles.signature_technicien || avant?.signature_technicien || null;
  const signe = Boolean(signature_client && signature_technicien);
  return {
    signature_client,
    signature_technicien,
    signed_at: signe ? avant?.signed_at || maintenant : null,
  };
}
