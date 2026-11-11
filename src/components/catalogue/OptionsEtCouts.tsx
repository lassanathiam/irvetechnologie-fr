import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  enregistrerCoutsReference,
  enregistrerOptionCatalogue,
  type OptionCatalogue,
} from "@/lib/catalogue-commercial.functions";
import { COUTS_DEFAUT, LIBELLES_COUTS, type CoutsReference } from "@/lib/tarification";
import { lireNombre, versChamp } from "./outils";

export function EditeurCouts({ couts, onEnregistre }: { couts: CoutsReference; onEnregistre: () => void }) {
  const sauver = useServerFn(enregistrerCoutsReference);
  const [v, setV] = useState<Record<string, string>>(
    Object.fromEntries(Object.keys(COUTS_DEFAUT).map((k) => [k, versChamp(couts[k as keyof CoutsReference])])),
  );
  const [occupe, setOccupe] = useState(false);
  return (
    <div className="space-y-4 rounded-lg border border-border bg-card p-4 sm:p-6">
      <div>
        <h2 className="font-semibold">Coûts de référence d'une installation</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Servent à calculer le prix de revient réel de chaque forfait. Un champ vide rend la marge « provisoire ».
        </p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {(Object.keys(COUTS_DEFAUT) as (keyof CoutsReference)[]).map((k) => (
          <label key={k} className="grid gap-1.5">
            <span className="text-xs font-semibold text-muted-foreground">{LIBELLES_COUTS[k]}</span>
            <Input inputMode="decimal" value={v[k]} onChange={(e) => setV((x) => ({ ...x, [k]: e.target.value }))} placeholder="À renseigner" />
          </label>
        ))}
      </div>
      <div className="flex justify-end">
        <Button
          disabled={occupe}
          onClick={async () => {
            setOccupe(true);
            try {
              await sauver({
                data: Object.fromEntries(Object.keys(COUTS_DEFAUT).map((k) => [k, lireNombre(v[k] ?? "")])),
              } as never);
              toast.success("Coûts de référence enregistrés.");
              onEnregistre();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
            } finally {
              setOccupe(false);
            }
          }}
        >
          {occupe ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer les coûts
        </Button>
      </div>
    </div>
  );
}

function LigneOption({ option, onEnregistre }: { option: OptionCatalogue | null; onEnregistre: () => void }) {
  const sauver = useServerFn(enregistrerOptionCatalogue);
  const [libelle, setLibelle] = useState(option?.libelle ?? "");
  const [description, setDescription] = useState(option?.description ?? "");
  const [prix, setPrix] = useState(versChamp(option?.prix_ttc));
  const [cout, setCout] = useState(versChamp(option?.cout_ht));
  const [actif, setActif] = useState(option?.actif ?? true);
  const [occupe, setOccupe] = useState(false);
  return (
    <div className="grid gap-2 rounded-md border border-border p-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
      <div className="grid gap-1.5">
        <Input value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="Nom de l'option" />
        <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description pour le devis" />
      </div>
      <label className="grid gap-1.5">
        <span className="text-xs font-semibold text-muted-foreground">Prix de vente TTC</span>
        <Input inputMode="decimal" value={prix} onChange={(e) => setPrix(e.target.value)} placeholder="À renseigner" />
      </label>
      <label className="grid gap-1.5">
        <span className="text-xs font-semibold text-muted-foreground">Prix de revient HT</span>
        <Input inputMode="decimal" value={cout} onChange={(e) => setCout(e.target.value)} placeholder="À renseigner" />
      </label>
      <div className="flex items-center gap-2">
        <label className="flex items-center gap-1.5 text-xs">
          <input type="checkbox" checked={actif} onChange={(e) => setActif(e.target.checked)} /> Active
        </label>
        <Button
          size="sm"
          disabled={occupe || !libelle.trim()}
          onClick={async () => {
            setOccupe(true);
            try {
              const code =
                option?.code ??
                (libelle
                  .normalize("NFD")
                  .replace(/[\u0300-\u036f]/g, "")
                  .toLowerCase()
                  .replace(/[^a-z0-9]+/g, "_")
                  .replace(/^_|_$/g, "")
                  .slice(0, 30) || "option") + `_${Date.now().toString(36).slice(-4)}`;
              await sauver({
                data: {
                  id: option?.id,
                  code,
                  libelle,
                  description: description || null,
                  prix_ttc: lireNombre(prix),
                  cout_ht: lireNombre(cout),
                  actif,
                  ordre: option?.ordre ?? 200,
                },
              } as never);
              toast.success("Option enregistrée.");
              if (!option) {
                setLibelle("");
                setDescription("");
                setPrix("");
                setCout("");
              }
              onEnregistre();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
            } finally {
              setOccupe(false);
            }
          }}
        >
          {occupe ? <Loader2 className="h-4 w-4 animate-spin" /> : option ? <Save className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {option ? "Enregistrer" : "Ajouter"}
        </Button>
      </div>
    </div>
  );
}

export function EditeurOptions({ options, onEnregistre }: { options: OptionCatalogue[]; onEnregistre: () => void }) {
  return (
    <div className="space-y-3 rounded-lg border border-border bg-card p-4 sm:p-6">
      <div>
        <h2 className="font-semibold">Options et suppléments</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Une option sans prix de vente n'est pas proposée au client. Le prix de revient reste interne.
        </p>
      </div>
      {options.map((o) => (
        <LigneOption key={o.id} option={o} onEnregistre={onEnregistre} />
      ))}
      <p className="pt-2 text-xs font-semibold text-muted-foreground">Nouvelle option</p>
      <LigneOption option={null} onEnregistre={onEnregistre} />
    </div>
  );
}
