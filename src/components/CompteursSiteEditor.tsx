import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { COMPTEURS_BASE_DEFAUT, getCompteursBase, getCompteursPublics, updateCompteursBase, type CompteursBase } from "@/lib/compteurs-site.functions";

const CHAMPS: [keyof CompteursBase, string][] = [["b2c", "Installations particuliers (B2C)"], ["b2b", "Installations professionnels (B2B)"], ["maintenance", "Maintenances et dépannages"]];

export function CompteursSiteEditor() {
  const lire = useServerFn(getCompteursBase);
  const totaux = useServerFn(getCompteursPublics);
  const save = useServerFn(updateCompteursBase);
  const qc = useQueryClient();
  const base = useQuery({ queryKey: ["compteurs-base"], queryFn: () => lire() });
  const affiche = useQuery({ queryKey: ["compteurs-publics"], queryFn: () => totaux() });
  const [v, setV] = useState<CompteursBase>(COMPTEURS_BASE_DEFAUT);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (base.data) setV(base.data); }, [base.data]);
  return (
    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="text-lg font-bold">Chantiers réalisés affichés sur le site</h2>
      <p className="mt-1 text-sm text-muted-foreground">Les chantiers terminés du planning s'ajoutent tout seuls. Indiquez ici les chantiers faits avant la plateforme. Une installation portant l'étiquette « B2B » compte comme professionnel.</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {CHAMPS.map(([k, l]) => (
          <label key={k} className="text-xs text-muted-foreground">{l} — déjà faits avant
            <Input className="mt-1.5" type="number" min="0" value={String(v[k])} onChange={(e) => setV({ ...v, [k]: Number(e.target.value) || 0 })} />
            {affiche.data && <span className="mt-1 block font-semibold text-primary">Affiché sur le site : {affiche.data[k]}</span>}
          </label>
        ))}
      </div>
      <Button className="mt-4" disabled={busy} onClick={async () => {
        setBusy(true);
        try { await save({ data: v }); await qc.invalidateQueries({ queryKey: ["compteurs-publics"] }); toast.success("Chiffres enregistrés"); }
        catch (e) { toast.error(e instanceof Error ? e.message : "Erreur"); } finally { setBusy(false); }
      }}>Enregistrer les chiffres</Button>
    </section>
  );
}
