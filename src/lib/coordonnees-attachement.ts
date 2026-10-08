type Donneur = {
  nom: string;
  raison_sociale?: string | null;
  charge_affaires_nom?: string | null;
  charge_affaires_email?: string | null;
  charge_affaires_telephone?: string | null;
};
type Contact = { contact_nom?: string | null; email?: string | null; telephone?: string | null };

/** Adresse de facturation du donneur conservée ; contact opérationnel issu de sa fiche partenaire. */
export function coordonneesAttachement<T extends Donneur>(donneur: T, contact?: Contact | null): T & Donneur {
  if (!/\bensio\b/i.test(donneur.nom)) return donneur;
  return {
    ...donneur,
    raison_sociale: donneur.raison_sociale?.replace(/\s*\(anciennement[^)]*\)/i, "").trim() || donneur.nom,
    charge_affaires_nom: donneur.charge_affaires_nom || contact?.contact_nom || null,
    charge_affaires_email: donneur.charge_affaires_email || contact?.email || null,
    charge_affaires_telephone: donneur.charge_affaires_telephone || contact?.telephone || null,
  };
}