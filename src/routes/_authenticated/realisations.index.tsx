import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Images, Loader2, Plus, Save, Trash2, Upload, X } from "lucide-react";
import { ProShell } from "@/components/ProShell";
import { compressImage } from "@/lib/image-compress";
import { deleteRealisation, listRealisations, saveRealisation } from "@/lib/realisations.functions";

export const Route = createFileRoute("/_authenticated/realisations/")({
  head: () => ({
    meta: [
      { title: "Photos des réalisations — Espace pro Borne de l'Ouest" },
      {
        name: "description",
        content: "Ajouter, remplacer ou supprimer les photos des chantiers affichées dans la galerie du site Borne de l'Ouest.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RealisationsAdmin,
});

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_FILE_BYTES = 12 * 1024 * 1024;

type Draft = {
  id?: string;
  titre: string;
  lieu: string;
  description: string;
  position: number;
  publie: boolean;
  data_url?: string;
  preview?: string;
};

const EMPTY: Draft = { titre: "", lieu: "", description: "", position: 0, publie: true };

function RealisationsAdmin() {
  const fetchAll = useServerFn(listRealisations);
  const save = useServerFn(saveRealisation);
  const remove = useServerFn(deleteRealisation);
  const list = useQuery({ queryKey: ["realisations-admin"], queryFn: () => fetchAll() });

  const [draft, setDraft] = useState<Draft | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const pickFile = async (file: File | undefined) => {
    if (!file || !draft) return;
    setError(null);
    if (!ACCEPTED.includes(file.type)) {
      setError("Format non accepté. Choisissez un fichier JPG, PNG ou WEBP.");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setError("Fichier trop lourd (12 Mo maximum).");
      return;
    }
    try {
      const data_url = await compressImage(file, 1600, 0.75);
      setDraft({ ...draft, data_url, preview: data_url });
    } catch {
      setError("Impossible de lire cette image. Essayez une autre photo.");
    }
  };

  const submit = async () => {
    if (!draft) return;
    setError(null);
    setNotice(null);
    if (!draft.titre.trim()) {
      setError("Indiquez un titre pour la réalisation.");
      return;
    }
    setBusy(true);
    try {
      await save({
        data: {
          id: draft.id ?? null,
          titre: draft.titre.trim(),
          lieu: draft.lieu.trim(),
          description: draft.description.trim(),
          position: Number(draft.position) || 0,
          publie: draft.publie,
          data_url: draft.data_url ?? null,
        },
      });
      setDraft(null);
      setNotice("Réalisation enregistrée.");
      await list.refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async (id: string) => {
    if (!window.confirm("Supprimer cette réalisation et sa photo ?")) return;
    setBusy(true);
    setError(null);
    try {
      await remove({ data: { id } });
      setNotice("Réalisation supprimée.");
      await list.refetch();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Suppression impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <ProShell>
      <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
        <div>
          <div className="text-mono text-primary flex items-center gap-2 mb-2">
            <Images className="h-4 w-4" /> Galerie du site
          </div>
          <h1 className="text-3xl font-medium tracking-tight">Photos des réalisations</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Les réalisations publiées apparaissent dans le diaporama « Réalisations récentes » de la page d'accueil.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setDraft({ ...EMPTY, position: (list.data?.length ?? 0) + 1 });
            setNotice(null);
            setError(null);
          }}
          className="text-mono text-xs px-4 py-2.5 rounded-sm bg-primary text-primary-foreground inline-flex items-center gap-2 hover:opacity-90"
        >
          <Plus className="h-4 w-4" /> Nouvelle réalisation
        </button>
      </div>

      {error && (
        <p className="mb-4 text-sm text-destructive border border-destructive/40 rounded-sm px-4 py-3">{error}</p>
      )}
      {notice && (
        <p className="mb-4 text-sm text-primary border border-primary/40 rounded-sm px-4 py-3">{notice}</p>
      )}

      {draft && (
        <section className="mb-10 border border-border rounded-sm bg-card p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="font-medium">{draft.id ? "Modifier la réalisation" : "Ajouter une réalisation"}</h2>
            <button type="button" onClick={() => setDraft(null)} className="text-muted-foreground hover:text-destructive">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            <label className="block">
              <span className="text-[11px] text-muted-foreground">Titre</span>
              <input
                value={draft.titre}
                onChange={(e) => setDraft({ ...draft, titre: e.target.value })}
                placeholder="Borne murale 11 kW"
                className="mt-1 w-full bg-background border border-border rounded-sm px-3 py-2 text-sm"
              />
            </label>
            <label className="block">
              <span className="text-[11px] text-muted-foreground">Lieu</span>
              <input
                value={draft.lieu}
                onChange={(e) => setDraft({ ...draft, lieu: e.target.value })}
                placeholder="Nantes (44)"
                className="mt-1 w-full bg-background border border-border rounded-sm px-3 py-2 text-sm"
              />
            </label>
          </div>

          <label className="block">
            <span className="text-[11px] text-muted-foreground">Description du chantier</span>
            <textarea
              value={draft.description}
              onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              rows={3}
              className="mt-1 w-full bg-background border border-border rounded-sm px-3 py-2 text-sm"
            />
          </label>

          <div className="grid md:grid-cols-3 gap-5 items-end">
            <label className="block">
              <span className="text-[11px] text-muted-foreground">Ordre d'affichage</span>
              <input
                type="number"
                min={0}
                value={draft.position}
                onChange={(e) => setDraft({ ...draft, position: Number(e.target.value) })}
                className="mt-1 w-full bg-background border border-border rounded-sm px-3 py-2 text-sm"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.publie}
                onChange={(e) => setDraft({ ...draft, publie: e.target.checked })}
              />
              Visible sur le site
            </label>
            <div>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0])}
              />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="text-mono text-xs px-4 py-2.5 rounded-sm border border-border inline-flex items-center gap-2 hover:border-primary hover:text-primary w-full justify-center"
              >
                <Upload className="h-4 w-4" /> {draft.id ? "Remplacer la photo" : "Choisir une photo"}
              </button>
            </div>
          </div>

          {draft.preview && (
            <div className="w-full max-w-sm aspect-[4/3] border border-border rounded-sm overflow-hidden">
              <img src={draft.preview} alt="Aperçu" className="w-full h-full object-cover" />
            </div>
          )}
          <p className="text-[11px] text-muted-foreground">
            JPG, PNG ou WEBP · 12 Mo maximum · la photo est automatiquement redimensionnée (1600 px) et compressée.
          </p>

          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="text-mono text-xs px-5 py-2.5 rounded-sm bg-primary text-primary-foreground inline-flex items-center gap-2 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer
          </button>
        </section>
      )}

      {list.isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      ) : !list.data?.length ? (
        <p className="text-sm text-muted-foreground">
          Aucune réalisation enregistrée. La galerie du site affiche les photos par défaut tant qu'aucune photo n'est ajoutée.
        </p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {list.data.map((r) => (
            <article key={r.id} className="border border-border rounded-sm bg-card overflow-hidden">
              <div className="aspect-[4/3] bg-secondary/40">
                {r.url ? <img src={r.url} alt={r.titre} className="w-full h-full object-cover" /> : null}
              </div>
              <div className="p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="font-medium text-sm">{r.titre}</div>
                    <div className="text-[11px] text-muted-foreground">{r.lieu || "—"}</div>
                  </div>
                  <span className={`text-mono text-[10px] px-2 py-1 rounded-sm ${r.publie ? "text-primary bg-primary/10" : "text-muted-foreground bg-muted"}`}>
                    {r.publie ? "en ligne" : "masquée"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-3">{r.description}</p>
                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setDraft({
                        id: r.id,
                        titre: r.titre,
                        lieu: r.lieu ?? "",
                        description: r.description ?? "",
                        position: r.position ?? 0,
                        publie: r.publie,
                        preview: r.url || undefined,
                      });
                      setError(null);
                      setNotice(null);
                    }}
                    className="text-mono text-xs text-primary hover:underline"
                  >
                    Modifier
                  </button>
                  <button
                    type="button"
                    onClick={() => doDelete(r.id)}
                    className="text-mono text-xs text-muted-foreground hover:text-destructive inline-flex items-center gap-1"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Supprimer
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </ProShell>
  );
}
