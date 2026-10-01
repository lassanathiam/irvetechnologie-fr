import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Check, Circle, Cable, Loader2, Trash2, Wrench, X } from "lucide-react";
import { toast } from "sonner";
import { compressImage } from "@/lib/image-compress";
import {
  RETOUR_CATEGORIES_LABELS,
  categoriesRetourOptionnelles,
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
  type?: string | null;
  partenaire?: string | null;
};


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
  const [enCours, setEnCours] = useState<string | null>(null);
  const maintenance = rdv.type === "maintenance";
  const [cablePose, setCablePose] = useState(maintenance && Number(rdv.metrage_reel_m ?? 0) > 0);
  const optionnelles = categoriesRetourOptionnelles(rdv.type, rdv.partenaire);

  const photos = useQuery({
    queryKey: ["photos-chantier", rdv.id],
    queryFn: () => listFn({ data: { rendezvous_id: rdv.id } }),
    // Évite le clignotement au retour de l'appareil photo : pas de rechargement
    // automatique, et l'ancienne liste reste affichée pendant la mise à jour.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    refetchOnMount: false,
    placeholderData: (prev) => prev,
  });

  // Garde la même adresse d'image par photo pour ne pas la recharger à chaque mise à jour.
  const urlsStables = useRef(new Map<string, string>());
  const liste = (photos.data ?? []).map((p) => {
    const connue = urlsStables.current.get(p.id);
    if (connue) return { ...p, url: connue };
    if (p.url) urlsStables.current.set(p.id, p.url);
    return p;
  });
  const parCategorie = (cat: string) => liste.filter((p) => p.categorie === cat);
  const faites = nbRetourFait(liste.map((p) => p.categorie), obligatoires);

  const supplement = Math.max(
    0,
    (Number(reel.replace(",", ".")) || 0) - (Number(inclus.replace(",", ".")) || 0),
  );

  async function envoyer(cat: string, files: FileList | null) {
    if (!files?.length) return;
    setEnCours(cat);
    let ok = 0;
    for (const file of Array.from(files).slice(0, 6)) {
      try {
        const data_url = await compressImage(file);
        await uploadFn({
          data: { rendezvous_id: rdv.id, categorie: cat, data_url },
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
    mutationFn: () => {
      if (maintenance && cablePose && !(Number(reel.replace(",", ".")) > 0)) {
        throw new Error("Indiquez le métrage de câble tiré ou remplacé.");
      }
      if (maintenance && cablePose && !observations.trim()) {
        throw new Error("Ajoutez un commentaire sur les travaux de câble réalisés.");
      }
      return saveFn({
        data: {
          id: rdv.id,
          metrage_inclus_m: maintenance ? 0 : inclus,
          metrage_reel_m: maintenance && !cablePose ? 0 : reel,
          retour_observations: observations,
          retour_delestage: delestage,
        },
      });
    },
    onSuccess: async () => {
      toast.success("Retour de travaux enregistré.");
      await qc.invalidateQueries({ queryKey: ["rendezvous"] });
      onClose();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Enregistrement impossible."),
  });

  function ligne(cat: string) {
    const items = parCategorie(cat);
    return (
      <div key={cat} className="rounded-lg border border-border p-3">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold">
            {RETOUR_CATEGORIES_LABELS[cat] ?? cat}
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
                    decoding="async"
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
              Photos enregistrées : {liste.length}
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

        <div className="mb-3 rounded-lg border border-primary/30 bg-primary/10 p-3">
          <p className="flex items-center gap-2 text-sm font-bold">
            {maintenance ? <Wrench className="h-4 w-4" /> : <Check className="h-4 w-4" />}
            {maintenance ? "Ordre d’intervention · Maintenance" : "Ordre d’intervention · Installation"}
          </p>
          <ol className="mt-2 grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
            {(maintenance
              ? ["Contrôle de la borne", "Diagnostic / maintenance", "Essai", "Remise en service"]
              : ["Pose de la borne", "Raccordement de la borne", "Raccordement au tableau électrique", "Tableau de protection", "Compteur Linky", "Délestage", "Mise en service"]
            ).map((etape) => (
              <li key={etape} className="flex items-center gap-2"><Circle className="h-2.5 w-2.5 shrink-0 fill-primary text-primary" /> {etape}</li>
            ))}
          </ol>
        </div>

        <div className="grid gap-2">
          {obligatoires.map((c) => ligne(c))}
        </div>

        <p className="mt-4 text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Photos complémentaires
        </p>
        <div className="mt-2 grid gap-2">
          {optionnelles.map((c) => ligne(c))}
        </div>

        <div className="mt-4 rounded-lg border border-border p-3">
          {maintenance && (
            <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
              <input
                type="checkbox"
                checked={cablePose}
                onChange={(e) => {
                  setCablePose(e.target.checked);
                  if (!e.target.checked) setReel("");
                }}
                className="h-5 w-5"
              />
              <Cable className="h-4 w-4 shrink-0" />
              Câble tiré ou remplacé pendant la maintenance
            </label>
          )}
          {(!maintenance || cablePose) && <>
          <p className={`${maintenance ? "mt-3" : ""} text-sm font-bold`}>Métrage de câble</p>
          <div className={`mt-2 grid gap-3 ${maintenance ? "grid-cols-1" : "grid-cols-2"}`}>
            {!maintenance && (
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
            )}
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
          </>}

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
            {maintenance && cablePose ? "Commentaire sur le câble (obligatoire)" : "Observations de fin d’intervention"}
            <textarea
              rows={3}
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-background p-2 text-sm"
              placeholder={maintenance ? (cablePose ? "Précisez le câble tiré ou remplacé, le cheminement et la raison…" : "Diagnostic, intervention réalisée, pièces remplacées…") : "Essais conformes, protections posées, réserves…"}
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
        </div>
      </div>
    </div>
  );
}
