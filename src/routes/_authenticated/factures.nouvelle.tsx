import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { ProShell } from "@/components/ProShell";
import { FactureEditor } from "@/components/FactureEditor";
import { CONDITIONS_DEFAUT } from "@/lib/billing";

export const Route = createFileRoute("/_authenticated/factures/nouvelle")({
  head: () => ({ meta: [{ title: "Nouvelle facture — IRVE Technologie" }, { name: "robots", content: "noindex" }] }),
  component: NouvelleFacture,
});

function NouvelleFacture() {
  const navigate = useNavigate();
  return (
    <ProShell>
      <div className="pro-workspace space-y-4">
        <h1 className="text-3xl font-medium tracking-tight">Facture directe (sans devis)</h1>
        <FactureEditor
          facture={{ id: "", client_nom: "", client_email: null, client_telephone: null, client_adresse: null, client_cp_ville: null,
            objet: null, remise_pct: 0, conditions_paiement: CONDITIONS_DEFAUT, notes: null, autoliquidation: false }}
          items={[{ libelle: "", description: null, quantite: 1, prix_unitaire: 0, tva: 20 }]}
          onDone={() => navigate({ to: "/factures" })}
          onCreated={(id) => navigate({ to: "/factures/$id", params: { id } })}
        />
      </div>
    </ProShell>
  );
}
