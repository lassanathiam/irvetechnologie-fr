import { useEnvoiConfirme } from "@/lib/confirm-envoi";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, CheckCircle2, Home, Loader2, LogOut, MapPin, Navigation, Phone, Play } from "lucide-react";
import { BrandLogo } from "@/components/BrandLogo";
import { InterventionsMap, STATUT_COLORS, type MapMarker } from "@/components/InterventionsMap";
import { compressImage } from "@/lib/image-compress";
import { wazeLien, telLien } from "@/lib/contact-client";
import { dureeFr } from "@/lib/geo";
import {
  comptePhotosPartenaire,
  definirBaseSousTraitant,
  demarrerMissionSousTraitant,
  getEspacePartenaire,
  terminerMissionSousTraitant,
  uploadPhotoPartenaire,
} from "@/lib/partenaires.functions";

type Espace = Awaited<ReturnType<typeof getEspacePartenaire>>;
type Mission = Espace["missions"][number] & {
  trajet?: { distance_km: number; duree_trajet_min: number } | null;
};

const eur = (n: number | null | undefined) =>
  n == null ? "—" : `${Number(n).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € HT`;

export function EspaceSousTraitant({
  token,
  session,
  espace,
  onDeconnexion,
}: {
  token: string;
  session: string;
  espace: Espace;
  onDeconnexion: () => void;
}) {
  const qc = useQueryClient();
  const saveBase = useServerFn(definirBaseSousTraitant);
  const demarrer = useServerFn(demarrerMissionSousTraitant);
  const terminer = useEnvoiConfirme(terminerMissionSousTraitant, "Confirmez-vous que les travaux sont terminés ? Le retour sera envoyé.");
  const envoyerPhoto = useServerFn(uploadPhotoPartenaire);
  const chargerComptes = useServerFn(comptePhotosPartenaire);
  const photos = useQuery({
    queryKey: ["photos-partenaire", token],
    queryFn: () => chargerComptes({ data: { token, session } }),
  });

  const [baseSaisie, setBaseSaisie] = useState(espace.base_adresse ?? "");
  const [editBase, setEditBase] = useState(!espace.base_adresse);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<string | null>(null);

  const missions = espace.missions as Mission[];
  const enCours = missions.filter((m) => !m.termine_at);
  const terminees = missions.filter((m) => m.termine_at);

  const refresh = () => {
    void qc.invalidateQueries({ queryKey: ["espace-partenaire", token] });
    void qc.invalidateQueries({ queryKey: ["photos-partenaire", token] });
  };

  async function run(id: string, fn: () => Promise<unknown>) {
    setBusy(id);
    setError(null);
    try {
      await fn();
      refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action impossible.");
    } finally {
      setBusy(null);
    }
  }

  const markers: MapMarker[] = enCours
    .filter((m) => m.lat != null && m.lng != null)
    .map((m) => ({
      id: m.id,
      lat: Number(m.lat),
      lng: Number(m.lng),
      label: m.client_nom,
      sub: [m.adresse, m.cp_ville].filter(Boolean).join(", "),
      statut: m.statut,
      date: m.date_debut,
      trajet: m.trajet ? `${m.trajet.distance_km} km · ${dureeFr(m.trajet.duree_trajet_min)}` : null,
      couleur: STATUT_COLORS[m.statut] ?? null,
    }));

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-6 space-y-5">
        <header className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <BrandLogo />
            <div>
              <p className="text-xs text-muted-foreground">Espace sous-traitant</p>
              <h1 className="text-lg font-bold">{espace.nom}</h1>
            </div>
          </div>
          <button type="button" onClick={onDeconnexion} className="inline-flex items-center gap-1 text-xs text-muted-foreground">
            <LogOut className="h-4 w-4" /> Déconnexion
          </button>
        </header>

        <section className="rounded-lg border border-border bg-card p-4">
          <p className="inline-flex items-center gap-2 text-sm font-semibold">
            <Home className="h-4 w-4 text-primary" /> Ma base de départ
          </p>
          {editBase ? (
            <form
              className="mt-3 flex flex-col gap-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                void run("base", async () => {
                  await saveBase({ data: { token, session, adresse: baseSaisie } });
                  setEditBase(false);
                });
              }}
            >
              <input
                value={baseSaisie}
                onChange={(e) => setBaseSaisie(e.target.value)}
                placeholder="N°, rue, code postal, ville"
                className="flex-1 rounded-md border border-border bg-input px-3 py-2 text-sm"
              />
              <button disabled={busy === "base"} className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
                {busy === "base" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enregistrer"}
              </button>
            </form>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              {espace.base_adresse}{" "}
              <button type="button" className="text-primary underline" onClick={() => setEditBase(true)}>
                Modifier
              </button>
            </p>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            Les distances et temps de trajet sont calculés automatiquement depuis cette adresse.
          </p>
        </section>

        {error && <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}

        {markers.length > 0 && (
          <InterventionsMap
            markers={markers}
            activeId={active}
            onSelect={setActive}
            height={320}
            bases={espace.base ? [{ ...espace.base, label: "Ma base" }] : []}
          />
        )}

        <section className="space-y-3">
          <h2 className="text-sm font-semibold">Dossiers à réaliser ({enCours.length})</h2>
          {enCours.length === 0 && <p className="text-sm text-muted-foreground">Aucun dossier attribué pour le moment.</p>}
          {enCours.map((m) => {
            const nbPhotos = photos.data?.[m.id]?.total ?? 0;
            return (
              <MissionCard
                key={m.id}
                m={m}
                active={active === m.id}
                nbPhotos={nbPhotos}
                busy={busy === m.id}
                onDemarrer={() => run(m.id, () => demarrer({ data: { token, session, id: m.id } }))}
                onPhotos={(files) =>
                  run(m.id, async () => {
                    for (const f of Array.from(files)) {
                      const data_url = await compressImage(f, 1280, 0.66);
                      await envoyerPhoto({ data: { token, session, rendezvous_id: m.id, data_url, categorie: "autre" } });
                    }
                  })
                }
                onTerminer={(metrage, obs) =>
                  run(m.id, () =>
                    terminer({ data: { token, session, id: m.id, metrage_reel_m: metrage, observations: obs } }),
                  )
                }
              />
            );
          })}
        </section>

        {terminees.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-semibold">Terminés ({terminees.length})</h2>
            {terminees.map((m) => (
              <div key={m.id} className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2 text-sm">
                <span className="truncate">
                  <CheckCircle2 className="mr-1 inline h-4 w-4 text-primary" />
                  {m.client_nom} · {new Date(m.termine_at!).toLocaleDateString("fr-FR")}
                </span>
                <span className="font-semibold">{eur(m.montant_sous_traitant_ht)}</span>
              </div>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}

function MissionCard({
  m,
  active,
  nbPhotos,
  busy,
  onDemarrer,
  onPhotos,
  onTerminer,
}: {
  m: Mission;
  active: boolean;
  nbPhotos: number;
  busy: boolean;
  onDemarrer: () => void;
  onPhotos: (f: FileList) => void;
  onTerminer: (metrage: number | null, obs: string | null) => void;
}) {
  const [metrage, setMetrage] = useState("");
  const [obs, setObs] = useState("");
  return (
    <article className={`rounded-lg border bg-card p-4 space-y-2 ${active ? "border-primary" : "border-border"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-bold">{m.client_nom}</p>
          <p className="text-xs text-muted-foreground">
            {m.date_a_confirmer
              ? "Date à confirmer"
              : new Date(m.date_debut).toLocaleString("fr-FR", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
            {m.designation ? ` · ${m.designation}` : ""}
          </p>
        </div>
        <span className="shrink-0 rounded-md bg-primary/15 px-2 py-1 text-sm font-bold text-primary">{eur(m.montant_sous_traitant_ht)}</span>
      </div>
      <a
        href={wazeLien(m.adresse, m.cp_ville, m.lat == null ? null : Number(m.lat), m.lng == null ? null : Number(m.lng))}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1 text-sm text-primary underline underline-offset-2"
      >
        <MapPin className="h-4 w-4" /> {m.adresse}{m.cp_ville ? `, ${m.cp_ville}` : ""}
        <Navigation className="h-3.5 w-3.5" /> Waze
      </a>
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        {m.trajet && <span>{m.trajet.distance_km} km · {dureeFr(m.trajet.duree_trajet_min)} depuis ma base</span>}
        {m.client_telephone && (
          <a href={telLien(m.client_telephone) ?? undefined} className="inline-flex items-center gap-1 text-primary">
            <Phone className="h-3 w-3" /> {m.client_telephone}
          </a>
        )}
        {m.metrage_m ? <span>Métrage prévu : {m.metrage_m} m</span> : null}
        {m.puissance_borne && <span>{m.puissance_borne}</span>}
      </div>
      {m.notes && <p className="text-xs text-muted-foreground whitespace-pre-line">{m.notes}</p>}

      {!m.demarre_at ? (
        <button type="button" disabled={busy} onClick={onDemarrer} className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Démarrer le chantier
        </button>
      ) : (
        <div className="space-y-2 border-t border-border pt-3">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2 text-sm">
            <Camera className="h-4 w-4" /> Ajouter des photos ({nbPhotos})
            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => e.target.files && onPhotos(e.target.files)} />
          </label>
          <input value={metrage} onChange={(e) => setMetrage(e.target.value)} inputMode="decimal" placeholder="Métrage réel (m)" className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
          <textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observations" rows={2} className="w-full rounded-md border border-border bg-input px-3 py-2 text-sm" />
          <button
            type="button"
            disabled={busy || nbPhotos < 1}
            onClick={() => {
              const n = Number(metrage.replace(",", "."));
              onTerminer(metrage && Number.isFinite(n) ? n : null, obs.trim() || null);
            }}
            className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Terminer le chantier
          </button>
          {nbPhotos < 1 && <p className="text-xs text-muted-foreground">Au moins une photo est nécessaire pour terminer.</p>}
        </div>
      )}
    </article>
  );
}
