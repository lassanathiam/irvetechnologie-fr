import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Euro, Loader2, Save } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ProShell } from "@/components/ProShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getTarifsSite,
  TARIFS_SITE_DEFAUT,
  updateTarifsSite,
  type TarifsSite,
} from "@/lib/tarifs-site.functions";
import { BORNES_CATALOGUE } from "@/lib/bornes-catalogue";

export const Route = createFileRoute("/_authenticated/tarifs-site")({
  head: () => ({
    meta: [
      { title: "Tarifs du site — Espace pro Borne de l'Ouest" },
      { name: "description", content: "Modification des prix indicatifs affichés sur le site Borne de l'Ouest." },
      { property: "og:title", content: "Tarifs du site — Borne de l'Ouest" },
      { property: "og:description", content: "Réglages internes des tarifs publics." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TarifsSitePage,
});

const CHAMPS: { cle: keyof TarifsSite; titre: string; aide: string; suffixe: string }[] = [
  { cle: "installation_ttc", titre: "Installation d’une borne", aide: "Borne et pose standard, selon configuration.", suffixe: "€ TTC" },
  { cle: "maintenance_ttc", titre: "Entretien annuel", aide: "Contrôle préventif d’une borne.", suffixe: "€ TTC/an" },
  { cle: "depannage_ttc", titre: "Diagnostic / dépannage", aide: "Prix de départ, hors pièces et trajet exceptionnel.", suffixe: "€ TTC" },
];

function TarifsSitePage() {
  const getTarifs = useServerFn(getTarifsSite);
  const saveTarifs = useServerFn(updateTarifsSite);
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["tarifs-site"], queryFn: () => getTarifs() });
  const [tarifs, setTarifs] = useState<TarifsSite>(TARIFS_SITE_DEFAUT);

  useEffect(() => {
    if (query.data) setTarifs(query.data);
  }, [query.data]);

  const save = useMutation({
    mutationFn: () => saveTarifs({ data: tarifs }),
    onSuccess: (data) => {
      qc.setQueryData(["tarifs-site"], data);
      qc.invalidateQueries({ queryKey: ["tarifs-site-publics"] });
      toast.success("Tarifs du site enregistrés");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <ProShell>
      <div className="mx-auto max-w-4xl space-y-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <p className="text-mono text-[10px] text-primary">SITE PUBLIC</p>
            <h1 className="pro-heading truncate text-2xl font-bold sm:text-3xl">Tarifs affichés</h1>
            <p className="mt-1 text-sm text-muted-foreground">Modifiez les montants « À partir de » visibles par vos visiteurs.</p>
          </div>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
            <Euro className="h-5 w-5" />
          </span>
        </div>

        {query.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : (
          <div className="neo-dashboard-panel space-y-3 rounded-lg border border-border p-4 sm:p-6">
            {CHAMPS.map((champ) => (
              <label key={champ.cle} className="grid gap-2 rounded-lg border border-dashboard-line bg-dashboard-raised/50 p-4 sm:grid-cols-[minmax(0,1fr)_12rem] sm:items-center">
                <span className="min-w-0">
                  <span className="block font-semibold">{champ.titre}</span>
                  <span className="mt-0.5 block text-xs text-dashboard-muted">{champ.aide}</span>
                </span>
                <span className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={tarifs[champ.cle]}
                    onChange={(event) => setTarifs((actuels) => ({ ...actuels, [champ.cle]: Number(event.target.value) }))}
                  />
                  <span className="shrink-0 text-xs text-dashboard-muted">{champ.suffixe}</span>
                </span>
              </label>
            ))}
            <div className="pt-3">
              <h2 className="font-semibold">Catalogue « Nos bornes »</h2>
              <p className="mt-0.5 text-xs text-dashboard-muted">Prix « À partir de » posée, affiché sous chaque borne. Laissez vide pour ne pas afficher de prix.</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {BORNES_CATALOGUE.map((b) => (
                <label key={b.id} className="grid grid-cols-[3rem_minmax(0,1fr)_7rem] items-center gap-3 rounded-lg border border-dashboard-line bg-dashboard-raised/50 p-3">
                  <img src={b.img} alt="" className="h-12 w-12 rounded-md bg-white object-contain p-1" />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{b.nom}</span>
                    <span className="block text-xs text-dashboard-muted">{b.puissance} · {b.phase}</span>
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="€ TTC"
                    value={tarifs.bornes?.[b.id] ?? ""}
                    onChange={(event) =>
                      setTarifs((a) => {
                        const bornes = { ...(a.bornes ?? {}) };
                        if (event.target.value === "") delete bornes[b.id];
                        else bornes[b.id] = Number(event.target.value);
                        return { ...a, bornes };
                      })
                    }
                  />
                </label>
              ))}
            </div>
            <p className="text-xs text-dashboard-muted">Les montants restent indicatifs. Le devis final dépend de la borne, de la distance et des travaux nécessaires.</p>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Enregistrer les tarifs
            </Button>
          </div>
        )}
      </div>
    </ProShell>
  );
}