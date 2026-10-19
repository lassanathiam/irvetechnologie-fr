import { z } from "zod";

export const saisieCommandeSchema = z.object({
  lu: z.object({ numero: z.string().nullable(), attachement: z.string().nullable(), client: z.string().nullable(), montantHt: z.number().finite().nullable() }),
  attId: z.string(), choix: z.enum(["", "commande", "attachement"]), rapportSelectionne: z.boolean().optional(), factureId: z.string().uuid().optional(), erreur: z.string().optional(),
});
export type SaisieCommande = z.infer<typeof saisieCommandeSchema>;
export type CommandeMemorisee = SaisieCommande & { id: string; nom: string; original_path: string; signe_path: string | null; bytes: Uint8Array; signe?: Uint8Array };
export function saisieCommande(ligne: SaisieCommande) {
  return saisieCommandeSchema.parse(ligne);
}