import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Check, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { compressImage } from "@/lib/image-compress";
import {
  RETOUR_CATEGORIES_LABELS,
  RETOUR_CATEGORIES_OBLIGATOIRES,
  RETOUR_CATEGORIES_OPTIONNELLES,
  enregistrerRetourTravaux,
  listPhotosChantier,
  supprimerPhotoChantier,
  uploadPhotoChantier,
} from "@/lib/planning.functions";

export type RetourTravauxRdv = {
  id: string;
  client_nom: string;
  adresse?: string | null;
  cp_ville?: string | null;
  metrage_inclus_m?: number | string | null;
  metrage_reel_m?: number | string | null;
  retour_observations?: string | null;
  retour_delestage?: boolean | null;
  type_pose?: string | null;
};

/** Compte les photos obligatoires déjà présentes. */
export function nbRetourFait(categories: string[]): number {
  return RETOUR_CATEGORIES_OBLIGATOIRES.filter((c) => categories.includes(c)).length;
}

export default function RetourTravauxSheet({
  rdv,
  onClose,
}: {
  rdv: RetourTravauxRdv;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listPhotosChantier);
  const uploadFn = useServerFn(uploadPhotoChantier);
  const deleteFn = useServerFn(supprimerPhotoChantier);
  const saveFn = useServerFn(enregistrerRetourTravaux);

  const [inclus, setInclus] = useState(String(rdv.metrage_inclus_m ?? 5));
  const [reel, setReel] = useState(
    rdv.metrage_reel_m == null ? "" : String(rdv.metrage_reel_m),
  );
  const [observations, setObservations] = useState(rdv.retour_observations ?? "");
  const [delestage, setDelestage] = useState(Boolean(rdv.retour_delestage));
  const [photoReelle, setPhotoReelle] = useState(false);
  const [enCours, setEnCours] = useState<string | null>(null);

  const photos = useQuery({
    queryKey: ["photos-chantier", rdv.id],
    queryFn: () => listFn({ data: { rendezvous_id: rdv.id } }),
  });

  const liste = photos.data ?? [];
  const parCategorie = (cat: string) => liste.filter((p) => p.categorie === cat);
  const faites = nbRetourFait(liste.map((p) => p.categorie));

  const supplement = Math.max(
    0,
    (Number(reel.replace(",", ".")) || 0) - (Number(inclus.replace(",", ".")) || 0),
  );

  async function envoyer(cat: string, files: FileList | null) {
    if (!files?.length) return;
    if (!photoReelle) {
      toast.error("Confirmez d'abord que les photos sont réelles (pas générées par IA).");
      return;
    }
    setEnCours(cat);
    let ok = 0;
    for (const file of Array.from(files).slice(0, 6)) {
      try {
        const data_url = await compressImage(file);
        await uploadFn({
          data: { rendezvous_id: rdv.id, categorie: cat, data_url, photo_reelle: true },
        });
        ok++;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Envoi de la photo impossible.");
      }
    }
    setEnCours(null);
    if (ok) {
      toast.success(`${ok} photo${ok > 1 ? "s" : ""} enregistrée${ok > 1 ? "s" : ""}.`);
      await qc.invalidateQueries({ queryKey: ["photos-chantier", rdv.id] });
    }
  }

  const supprimer = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["photos-chantier", rdv.id] }),
    onError: () => toast.error("Suppression impossible."),
  });

  const enregistrer = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          id: rdv.id,
          metrage_inclus_m: inclus,
          metrage_reel_m: reel,
          retour_observations: observations,
          retour_delestage: delestage,
        },
      }),
    onSuccess: async () => {
      toast.success("Retour de travaux enregistré.");
      await qc.invalidateQueries({ queryKey: ["rendezvous"] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Enregistrement impossible."),
  });

  function ligne(cat: string, obligatoire: boolean) {
    const items = parCategorie(cat);
    return (
      <div key={cat} className="rounded-lg border border-border p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold">
            {RETOUR_CATEGORIES_LABELS[cat] ?? cat}
            {obligatoire && (
              <span className="ml-2 text-xs font-bold text-amber-600 dark:text-amber-400">
                obligatoire
              </span>
            )}
          </p>
          {items.length > 0 && (
            <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <Check className="h-3.5 w-3.5" /> {items.length}
            </span>
          )}
        </div>

        {items.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {items.map((p) => (
              <div key={p.id} className="relative">
                {p.url ? (
                  <img
                    src={p.url}
                    alt={RETOUR_CATEGORIES_LABELS[cat] ?? "Photo de chantier"}
                    className="h-20 w-20 rounded-md object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-20 w-20 rounded-md bg-secondary" />
                )}
                <button
                  type="button"
                  onClick={() => supprimer.mutate(p.id)}
                  className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-destructive text-destructive-foreground"
                  aria-label="Supprimer la photo"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <label className="mt-2 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-border text-sm font-semibold">
          {enCours === cat ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Camera className="h-4 w-4" />
          )}
          {enCours === cat ? "Envoi…" : "Prendre / choisir des photos"}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            disabled={enCours !== null}
            onChange={(e) => {
              void envoyer(cat, e.target.files);
              e.target.value = "";
            }}
          />
        </label>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center">
      <div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl bg-card p-4 md:max-w-2xl md:rounded-2xl">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold">Retour de travaux</h2>
            <p className="text-xs text-muted-foreground">
              {rdv.client_nom}
              {rdv.adresse ? ` · ${rdv.adresse}` : ""}
            </p>
            <p className="mt-1 text-xs font-bold text-primary">
              Photos essentielles : {faites}/{RETOUR_CATEGORIES_OBLIGATOIRES.length}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-lg border border-border"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <label className="mb-3 flex items-start gap-2 rounded-lg border border-border p-3 text-sm">
          <input
            type="checkbox"
            checked={photoReelle}
            onChange={(e) => setPhotoReelle(e.target.checked)}
            className="mt-0.5 h-5 w-5"
          />
          <span>
            Je confirme que les photos ajoutées sont des photos réelles du chantier (aucune image
            générée par intelligence artificielle).
          </span>
        </label>

        <div className="grid gap-2">
          {RETOUR_CATEGORIES_OBLIGATOIRES.map((c) => ligne(c, true))}
        </div>

        <p className="mt-4 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Photos complémentaires
        </p>
        <div className="mt-2 grid gap-2">
          {RETOUR_CATEGORIES_OPTIONNELLES.map((c) => ligne(c, false))}
        </div>

        <div className="mt-4 rounded-lg border border-border p-3">
          <p className="text-sm font-bold">Métrage de câble</p>
          <div className="mt-2 grid grid-cols-2 gap-3">
            <label className="text-xs text-muted-foreground">
              Inclus (m)
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={inclus}
                onChange={(e) => setInclus(e.target.value)}
                className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3 text-base"
              />
            </label>
            <label className="text-xs text-muted-foreground">
              Réellement posé (m)
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={reel}
                onChange={(e) => setReel(e.target.value)}
                className="mt-1 min-h-11 w-full rounded-lg border border-border bg-background px-3 text-base"
              />
            </label>
          </div>
          <p className="mt-2 text-sm font-semibold">
            {reel
              ? supplement > 0
                ? `${reel} m posés, soit ${supplement} m en plus à facturer.`
                : `${reel} m posés, aucun dépassement.`
              : "Saisissez le métrage posé sur place."}
          </p>

          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={delestage}
              onChange={(e) => setDelestage(e.target.checked)}
              className="h-5 w-5"
            />
            Délestage mis en place
          </label>

          <label className="mt-3 block text-xs text-muted-foreground">
            Observations de fin d&apos;intervention
            <textarea
              rows={3}
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm"
              placeholder="Essais conformes, protections posées, réserves…"
            />
          </label>
        </div>

        <div className="sticky bottom-0 mt-4 grid gap-2 bg-card pt-2">
          <button
            type="button"
            onClick={() => enregistrer.mutate()}
            disabled={enregistrer.isPending}
            className="min-h-12 rounded-lg bg-primary px-4 text-sm font-bold text-primary-foreground disabled:opacity-50"
          >
            {enregistrer.isPending ? "Enregistrement…" : "Enregistrer le retour de travaux"}
          </button>
          {faites < RETOUR_CATEGORIES_OBLIGATOIRES.length && (
            <p className="text-center text-xs text-amber-600 dark:text-amber-400">
              Il manque {RETOUR_CATEGORIES_OBLIGATOIRES.length - faites} photo(s) obligatoire(s)
              avant de pouvoir terminer le chantier.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
