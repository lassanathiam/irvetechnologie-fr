import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Pencil, Plus, Save, Trash2, Upload, X, Zap } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ProShell } from "@/components/ProShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  borneImage,
  createBorne,
  deleteBorne,
  listBornesAdmin,
  updateBorne,
  type Borne,
} from "@/lib/bornes.functions";

export const Route = createFileRoute("/_authenticated/bornes-catalogue")({
  head: () => ({
    meta: [
      { title: "Catalogue bornes — Espace pro Borne de l'Ouest" },
      { name: "description", content: "Ajout et modification des bornes affichées sur le site Borne de l'Ouest." },
      { property: "og:title", content: "Catalogue bornes — Borne de l'Ouest" },
      { property: "og:description", content: "Gestion interne du catalogue de bornes." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BornesCataloguePage,
});

const PUISSANCES = ["3,7 kW", "7,4 kW", "11 kW", "22 kW"];
const PHASES = ["Monophasé", "Triphasé"];

type FormBorne = {
  slug: string;
  nom: string;
  puissance: string;
  phase: string;
  atout: string;
  usage: string;
  badge: string;
  vedette: boolean;
  prix_ttc: string;
  ordre: string;
  actif: boolean;
  photo_path: string | null;
};

const FORM_VIDE: FormBorne = {
  slug: "",
  nom: "",
  puissance: "7,4 kW",
  phase: "Monophasé",
  atout: "",
  usage: "",
  badge: "",
  vedette: false,
  prix_ttc: "",
  ordre: "100",
  actif: true,
  photo_path: null,
};

function versForm(b: Borne): FormBorne {
  return {
    slug: b.slug,
    nom: b.nom,
    puissance: b.puissance,
    phase: b.phase,
    atout: b.atout,
    usage: b.usage,
    badge: b.badge ?? "",
    vedette: b.vedette,
    prix_ttc: b.prix_ttc != null ? String(b.prix_ttc) : "",
    ordre: String(b.ordre),
    actif: b.actif,
    photo_path: b.photo_path,
  };
}

function slugDepuisNom(nom: string): string {
  return nom
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function BornesCataloguePage() {
  const lister = useServerFn(listBornesAdmin);
  const creer = useServerFn(createBorne);
  const maj = useServerFn(updateBorne);
  const supprimer = useServerFn(deleteBorne);
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["bornes-admin"], queryFn: () => lister() });

  const [editionId, setEditionId] = useState<string | null>(null);
  const [form, setForm] = useState<FormBorne>(FORM_VIDE);
  const [formulaireOuvert, setFormulaireOuvert] = useState(false);
  const [uploadEnCours, setUploadEnCours] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const invalider = () => {
    qc.invalidateQueries({ queryKey: ["bornes-admin"] });
    qc.invalidateQueries({ queryKey: ["bornes-publiques"] });
  };

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        slug: form.slug || slugDepuisNom(form.nom),
        nom: form.nom.trim(),
        puissance: form.puissance,
        phase: form.phase,
        atout: form.atout.trim(),
        usage: form.usage.trim(),
        badge: form.badge.trim() || null,
        vedette: form.vedette,
        photo_path: form.photo_path,
        prix_ttc: form.prix_ttc === "" ? null : Number(form.prix_ttc),
        ordre: Number(form.ordre) || 100,
        actif: form.actif,
      };
      if (editionId) return maj({ data: { id: editionId, borne: payload } });
      return creer({ data: payload });
    },
    onSuccess: () => {
      invalider();
      setFormulaireOuvert(false);
      setEditionId(null);
      setForm(FORM_VIDE);
      toast.success(editionId ? "Borne modifiée" : "Borne ajoutée au catalogue");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => supprimer({ data: { id } }),
    onSuccess: () => {
      invalider();
      toast.success("Borne retirée du catalogue");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const ouvrirAjout = () => {
    setEditionId(null);
    setForm(FORM_VIDE);
    setFormulaireOuvert(true);
  };

  const ouvrirEdition = (b: Borne) => {
    setEditionId(b.id);
    setForm(versForm(b));
    setFormulaireOuvert(true);
  };

  const envoyerPhoto = async (fichier: File) => {
    setUploadEnCours(true);
    try {
      const ext = fichier.name.split(".").pop()?.toLowerCase() || "png";
      const chemin = `catalogue/${(form.slug || slugDepuisNom(form.nom) || "borne")}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("borne-photos").upload(chemin, fichier, { upsert: true });
      if (error) throw error;
      setForm((f) => ({ ...f, photo_path: chemin }));
      toast.success("Photo enregistrée — pensez à enregistrer la borne");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Envoi de la photo impossible");
    } finally {
      setUploadEnCours(false);
    }
  };

  const apercuPhoto = form.photo_path
    ? `/api/public/borne-photo/${form.photo_path.split("/").map(encodeURIComponent).join("/")}`
    : null;

  return (
    <ProShell>
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <p className="text-mono text-[10px] text-primary">SITE PUBLIC</p>
            <h1 className="pro-heading truncate text-2xl font-bold sm:text-3xl">Catalogue bornes</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Ajoutez, modifiez ou retirez les bornes affichées sur le site, avec leur prix « À partir de ».
            </p>
          </div>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
            <Zap className="h-5 w-5" />
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-dashboard-muted">{query.data?.length ?? 0} borne(s) au catalogue</p>
          <Button onClick={ouvrirAjout}>
            <Plus className="h-4 w-4" /> Ajouter une borne
          </Button>
        </div>

        {formulaireOuvert && (
          <div className="neo-dashboard-panel space-y-4 rounded-lg border border-border p-4 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold">{editionId ? "Modifier la borne" : "Nouvelle borne"}</h2>
              <Button variant="ghost" size="icon" onClick={() => setFormulaireOuvert(false)} aria-label="Fermer">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-dashboard-muted">Nom de la borne *</span>
                <Input
                  value={form.nom}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, nom: e.target.value, slug: editionId ? f.slug : slugDepuisNom(e.target.value) }))
                  }
                  placeholder="Ex. Schneider Charge"
                />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-dashboard-muted">Identifiant (automatique)</span>
                <Input value={form.slug} onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))} />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-dashboard-muted">Puissance</span>
                <select
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={form.puissance}
                  onChange={(e) => setForm((f) => ({ ...f, puissance: e.target.value }))}
                >
                  {PUISSANCES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-dashboard-muted">Alimentation</span>
                <select
                  className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  value={form.phase}
                  onChange={(e) => setForm((f) => ({ ...f, phase: e.target.value }))}
                >
                  {PHASES.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-dashboard-muted">Atout (petite phrase)</span>
                <Input value={form.atout} onChange={(e) => setForm((f) => ({ ...f, atout: e.target.value }))} placeholder="Ex. Compacte, câble intégré" />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-dashboard-muted">Usage conseillé</span>
                <Input value={form.usage} onChange={(e) => setForm((f) => ({ ...f, usage: e.target.value }))} placeholder="Ex. Maison individuelle" />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-dashboard-muted">Badge (optionnel)</span>
                <Input value={form.badge} onChange={(e) => setForm((f) => ({ ...f, badge: e.target.value }))} placeholder="Ex. Le plus choisi" />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-dashboard-muted">Prix « À partir de » (€ TTC posée, vide = masqué)</span>
                <Input type="number" min="0" step="1" value={form.prix_ttc} onChange={(e) => setForm((f) => ({ ...f, prix_ttc: e.target.value }))} placeholder="€ TTC" />
              </label>
              <label className="grid gap-1.5">
                <span className="text-xs font-semibold text-dashboard-muted">Ordre d'affichage</span>
                <Input type="number" min="0" step="1" value={form.ordre} onChange={(e) => setForm((f) => ({ ...f, ordre: e.target.value }))} />
              </label>
              <div className="grid gap-1.5">
                <span className="text-xs font-semibold text-dashboard-muted">Photo</span>
                <div className="flex items-center gap-3">
                  {apercuPhoto && (
                    <img src={apercuPhoto} alt="" className="h-14 w-14 rounded-md border border-border bg-white object-contain p-1" />
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const fichier = e.target.files?.[0];
                      if (fichier) void envoyerPhoto(fichier);
                      e.target.value = "";
                    }}
                  />
                  <Button type="button" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploadEnCours}>
                    {uploadEnCours ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {form.photo_path ? "Changer la photo" : "Ajouter une photo"}
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.vedette} onChange={(e) => setForm((f) => ({ ...f, vedette: e.target.checked }))} />
                Mettre en avant sur l'accueil
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={form.actif} onChange={(e) => setForm((f) => ({ ...f, actif: e.target.checked }))} />
                Visible sur le site
              </label>
            </div>

            <Button onClick={() => save.mutate()} disabled={save.isPending || form.nom.trim().length < 2}>
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editionId ? "Enregistrer les modifications" : "Ajouter au catalogue"}
            </Button>
          </div>
        )}

        {query.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {(query.data ?? []).map((b) => (
              <div
                key={b.id}
                className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-dashboard-line bg-dashboard-raised/50 p-3"
              >
                {borneImage(b) ? (
                  <img src={borneImage(b)!} alt="" className="h-14 w-14 rounded-md bg-white object-contain p-1" />
                ) : (
                  <span className="grid h-14 w-14 place-items-center rounded-md bg-dashboard-line text-dashboard-muted">
                    <Zap className="h-5 w-5" />
                  </span>
                )}
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">
                    {b.nom}
                    {!b.actif && <span className="ml-2 rounded-full bg-dashboard-line px-2 py-0.5 text-[10px] text-dashboard-muted">masquée</span>}
                    {b.vedette && <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] text-primary">accueil</span>}
                  </span>
                  <span className="block text-xs text-dashboard-muted">
                    {b.puissance} · {b.phase}
                    {b.prix_ttc != null && ` · dès ${b.prix_ttc.toLocaleString("fr-FR")} € TTC`}
                  </span>
                </span>
                <span className="flex shrink-0 gap-1">
                  <Button variant="ghost" size="icon" onClick={() => ouvrirEdition(b)} aria-label={`Modifier ${b.nom}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => {
                      if (window.confirm(`Retirer « ${b.nom} » du catalogue ?`)) remove.mutate(b.id);
                    }}
                    aria-label={`Retirer ${b.nom}`}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </ProShell>
  );
}
