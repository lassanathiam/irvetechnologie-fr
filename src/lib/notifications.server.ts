/**
 * Boîte de réception interne : les événements importants arrivent directement
 * dans l'espace pro, sans dépendre d'une messagerie externe.
 */

export type NotificationType =
  | "devis_accepte"
  | "rdv_confirme"
  | "rdv_refuse"
  | "demande"
  | "partenaire_dossier"
  | "partenaire_montant"
  | "chantier_termine"
  | "photos_telechargees"
  | "attachement_reponse"
  | "attachement_proposition";

export type NouvelleNotification = {
  type: NotificationType;
  titre: string;
  message?: string | null;
  lien?: string | null;
  montant?: number | null;
  meta?: Record<string, unknown>;
};

type InsertClient = {
  from: (table: string) => {
    insert: (values: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  };
};

/**
 * Enregistre une notification pour l'équipe. Ne fait jamais échouer l'action
 * métier qui l'a déclenchée : une alerte perdue vaut mieux qu'un devis refusé.
 */
export async function creerNotification(
  client: unknown,
  notif: NouvelleNotification,
): Promise<void> {
  try {
    const db = client as InsertClient;
    const { error } = await db.from("notifications").insert({
      type: notif.type,
      titre: notif.titre,
      message: notif.message ?? null,
      lien: notif.lien ?? null,
      montant: notif.montant ?? null,
      meta: notif.meta ?? {},
    });
    if (error) console.error("Notification non enregistrée:", error.message);
  } catch (error) {
    console.error(
      "Notification non enregistrée:",
      error instanceof Error ? error.message : "erreur inconnue",
    );
  }
}
