/** Motifs d'échec chantier avec message préparé (modifiable avant envoi). Module sans dépendance navigateur/serveur. */
export const MOTIFS_ECHEC = [
  {
    cle: "non_conforme",
    label: "Installation pas aux normes",
    message:
      "Lors de notre passage, nous avons constaté que l'installation électrique existante n'est pas conforme aux normes en vigueur (NF C 15-100). Pour des raisons de sécurité, nous n'avons pas pu réaliser la pose de la borne. Une mise en conformité est nécessaire avant toute nouvelle intervention. Vous trouverez les photos des points constatés via le lien ci-dessous.",
  },
  {
    cle: "client_absent",
    label: "Client absent",
    message:
      "Nous nous sommes présentés à l'adresse du chantier au créneau prévu, mais le client était absent et injoignable malgré nos tentatives d'appel. L'intervention n'a donc pas pu avoir lieu. Merci de nous indiquer un nouveau créneau de passage.",
  },
  {
    cle: "acces_impossible",
    label: "Accès impossible",
    message:
      "Nous n'avons pas pu accéder à la zone d'intervention (tableau électrique, emplacement de la borne ou cheminement du câble). L'intervention n'a donc pas pu être réalisée. Les photos jointes illustrent la situation. Merci de nous recontacter une fois l'accès possible.",
  },
  {
    cle: "materiel",
    label: "Matériel manquant ou non compatible",
    message:
      "Le matériel prévu pour ce chantier était manquant ou non compatible avec l'installation du client (borne, protections ou accessoires). L'intervention n'a donc pas pu être finalisée. Merci de nous confirmer l'envoi du matériel adapté afin de reprogrammer le chantier.",
  },
  { cle: "autre", label: "Autre motif", message: "" },
] as const;

export type MotifEchec = (typeof MOTIFS_ECHEC)[number]["cle"];

export function motifEchec(cle: string | null | undefined) {
  return MOTIFS_ECHEC.find((m) => m.cle === cle) ?? MOTIFS_ECHEC[MOTIFS_ECHEC.length - 1]!;
}

/** Un chantier remis à planifier n'est plus « en retard » : il attend une nouvelle date. */
export function estEnRetardNonRealise(
  r: { date_debut: string; termine_at?: string | null; statut?: string | null; date_a_confirmer?: boolean | null },
  debutJour: Date,
): boolean {
  if (r.termine_at || r.date_a_confirmer) return false;
  if (["annule", "termine", "realise", "en_pause"].includes(r.statut ?? "")) return false;
  return new Date(r.date_debut).getTime() < debutJour.getTime();
}
