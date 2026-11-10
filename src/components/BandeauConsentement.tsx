import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { estPagePubliqueMesuree } from "@/lib/analytics";
import {
  EVENEMENT_OUVRIR_REGLAGES,
  enregistrerChoixConsentement,
  lireChoixConsentement,
  navigateurRefusePublicite,
} from "@/lib/consentement";

/**
 * Bandeau d'accord des visiteurs, uniquement sur le site public.
 * « Accepter » et « Refuser » ont la même taille ; le choix reste modifiable
 * via « Gérer les cookies » en bas de page.
 */
export function BandeauConsentement({ pathname }: { pathname: string }) {
  const [visible, setVisible] = useState(false);
  const [details, setDetails] = useState(false);
  const [mesure, setMesure] = useState(false);
  const [pub, setPub] = useState(false);
  const [gpc, setGpc] = useState(false);

  useEffect(() => {
    setGpc(navigateurRefusePublicite());
    const choix = lireChoixConsentement();
    if (choix) {
      setMesure(choix.mesure);
      setPub(choix.publicite);
    }
    setVisible(!choix && estPagePubliqueMesuree(pathname));
  }, [pathname]);

  useEffect(() => {
    const ouvrir = () => {
      const choix = lireChoixConsentement();
      setMesure(choix?.mesure ?? false);
      setPub(choix?.publicite ?? false);
      setDetails(true);
      setVisible(true);
    };
    window.addEventListener(EVENEMENT_OUVRIR_REGLAGES, ouvrir);
    return () => window.removeEventListener(EVENEMENT_OUVRIR_REGLAGES, ouvrir);
  }, []);

  if (!visible) return null;

  const valider = (m: boolean, p: boolean) => {
    enregistrerChoixConsentement(m, p);
    setVisible(false);
    setDetails(false);
  };

  return (
    <div className="public-premium fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4" role="dialog" aria-label="Choix des cookies">
      <div className="mx-auto max-w-3xl rounded-xl border border-border bg-card p-4 text-card-foreground shadow-lg sm:p-5">
        <p className="text-sm font-semibold">Vos choix de cookies</p>
        <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
          Avec votre accord, nous utilisons des outils Google pour mesurer la fréquentation du site et savoir quelles
          publicités amènent des demandes de devis. Vous pouvez refuser : le site et le formulaire fonctionnent
          normalement.{" "}
          <Link to="/confidentialite" className="font-medium text-primary underline-offset-2 hover:underline">
            En savoir plus
          </Link>
        </p>

        {details && (
          <div className="mt-4 space-y-3 rounded-lg border border-border p-3">
            <label className="flex items-start justify-between gap-4">
              <span className="text-sm">
                <span className="font-medium">Mesure d&apos;audience</span>
                <span className="block text-muted-foreground">Google Analytics : pages vues et demandes envoyées.</span>
              </span>
              <Switch className="data-[state=unchecked]:bg-muted-foreground/40" checked={mesure} onCheckedChange={setMesure} aria-label="Mesure d'audience" />
            </label>
            <label className="flex items-start justify-between gap-4">
              <span className="text-sm">
                <span className="font-medium">Publicité</span>
                <span className="block text-muted-foreground">
                  Google Ads : savoir si une demande vient d&apos;une de nos annonces.
                  {gpc && " Votre navigateur demande de ne pas être suivi : ce choix reste désactivé."}
                </span>
              </span>
              <Switch className="data-[state=unchecked]:bg-muted-foreground/40" checked={pub && !gpc} disabled={gpc} onCheckedChange={setPub} aria-label="Publicité" />
            </label>
          </div>
        )}

        <div className="mt-4 grid gap-2 sm:grid-cols-3">
          <Button type="button" variant="outline" onClick={() => valider(false, false)}>
            Refuser
          </Button>
          {details ? (
            <Button type="button" variant="outline" onClick={() => valider(mesure, pub)}>
              Enregistrer mes choix
            </Button>
          ) : (
            <Button type="button" variant="outline" onClick={() => setDetails(true)}>
              Personnaliser
            </Button>
          )}
          <Button type="button" variant="outline" onClick={() => valider(true, true)}>
            Accepter
          </Button>
        </div>
      </div>
    </div>
  );
}
