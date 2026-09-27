import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type ClientEnregistre = {
  cle: string;
  source: "partenaire" | "societe";
  nom: string;
  email: string | null;
  telephone: string | null;
  adresse: string | null;
  cp_ville: string | null;
  siret: string | null;
  tva_intracom: string | null;
  delai_paiement_jours: number | null;
  autoliquidation: boolean;
};

/** Clients enregistrés : partenaires + fiches sociétés (donneurs d'ordre), pour préremplir devis et factures. */
export const listClientsEnregistres = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ClientEnregistre[]> => {
    const [p, d] = await Promise.all([
      context.supabase
        .from("partenaires")
        .select("id, nom, raison_sociale, email, telephone, adresse, cp_ville, siret, tva_intracom, delai_paiement_jours, actif")
        .eq("actif", true),
      context.supabase
        .from("donneurs_ordre")
        .select("id, nom, raison_sociale, adresse, cp_ville, siret, tva_intracom, charge_affaires_email, charge_affaires_telephone, delai_paiement_jours, autoliquidation, actif")
        .eq("actif", true),
    ]);
    if (p.error) throw new Error(p.error.message);
    if (d.error) throw new Error(d.error.message);
    const out: ClientEnregistre[] = [
      ...(p.data ?? []).map((x) => ({
        cle: `p-${x.id}`, source: "partenaire" as const, nom: x.raison_sociale || x.nom,
        email: x.email, telephone: x.telephone, adresse: x.adresse, cp_ville: x.cp_ville,
        siret: x.siret, tva_intracom: x.tva_intracom, delai_paiement_jours: x.delai_paiement_jours, autoliquidation: false,
      })),
      ...(d.data ?? []).map((x) => ({
        cle: `d-${x.id}`, source: "societe" as const, nom: x.raison_sociale || x.nom,
        email: x.charge_affaires_email, telephone: x.charge_affaires_telephone, adresse: x.adresse, cp_ville: x.cp_ville,
        siret: x.siret, tva_intracom: x.tva_intracom, delai_paiement_jours: x.delai_paiement_jours, autoliquidation: x.autoliquidation,
      })),
    ];
    return out.sort((a, b) => a.nom.localeCompare(b.nom, "fr"));
  });
