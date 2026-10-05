import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Camera, FileUp, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ProShell } from "@/components/ProShell";
import { RapportOriginalDoc } from "@/components/RapportOriginalDoc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { compressImage } from "@/lib/image-compress";
import {
  analyserFeuilleRapport,
  enregistrerModeleRapport,
  listChantiersTerminesDonneur,
  listModelesRapport,
  supprimerModeleRapport,
} from "@/lib/rapport-modeles.functions";
import { normaliserStructure, TYPE_LABELS, type ChampType, type ModeleStructure } from "@/lib/rapport-modeles";

export const Route = createFileRoute("/_authenticated/rapports/modeles")({
  head: () => ({
    meta: [
      { title: "Modèles de rapport donneurs d'ordre — IRVE Technologie" },
      { name: "description", content: "Créez une fois le rapport d'un donneur d'ordre à partir d'une photo, puis réutilisez-le sur chaque chantier." },
      { property: "og:title", content: "Modèles de rapport — IRVE Technologie" },
      { property: "og:description", content: "Rapports aux couleurs des donneurs d'ordre." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ModelesPage,
});

type Edit = {
  id?: string | null;
  nom: string;
  donneur_ordre: string;
  email_destinataire: string;
  logo_data: string | null;
  structure: ModeleStructure;
  actif: boolean;
};

const vide = (): Edit => ({
  nom: "",
  donneur_ordre: "",
  email_destinataire: "",
  logo_data: null,
  structure: { titre: "Rapport d'intervention", sections: [] },
  actif: true,
});

function ModelesPage() {
  return (
    <ProShell>
      <ModelesPageInner />
    </ProShell>
  );
}

function ModelesPageInner() {
  const qc = useQueryClient();
  const listFn = useServerFn(listModelesRapport);
  const analyseFn = useServerFn(analyserFeuilleRapport);
  const saveFn = useServerFn(enregistrerModeleRapport);
  const delFn = useServerFn(supprimerModeleRapport);
  const { data: modeles = [], isLoading } = useQuery({ queryKey: ["rapport-modeles"], queryFn: () => listFn() });
  const [edit, setEdit] = useState<Edit | null>(null);
  const [analyse, setAnalyse] = useState(false);

  const save = useMutation({
    mutationFn: (e: Edit) => saveFn({ data: { ...e, email_destinataire: e.email_destinataire || null } }),
    onSuccess: () => {
      toast.success("Modèle enregistré");
      setEdit(null);
      qc.invalidateQueries({ queryKey: ["rapport-modeles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const del = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["rapport-modeles"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  async function photoFeuille(file: File) {
    if (!edit) return;
    setAnalyse(true);
    try {
      const dataUrl =
        file.type === "application/pdf"
          ? await new Promise<string>((ok, ko) => {
              if (file.size > 8_000_000) return ko(new Error("PDF trop lourd (8 Mo maximum)."));
              const r = new FileReader();
              r.onload = () => ok(String(r.result));
              r.onerror = () => ko(new Error("Lecture du PDF impossible."));
              r.readAsDataURL(file);
            })
          : await compressImage(file, 2000, 0.8);
      const structure = await analyseFn({ data: { data_url: dataUrl } });
      const avecOriginal: ModeleStructure = {
        ...structure,
        original: { data_url: dataUrl, type: file.type === "application/pdf" ? "pdf" : "image" },
      };
      setEdit((e) => (e ? { ...e, structure: avecOriginal, nom: e.nom || structure.titre } : e));
      toast.success("Document original conservé : vérifiez les zones puis enregistrez");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setAnalyse(false);
    }
  }
  async function photoLogo(file: File) {
    const dataUrl = await compressImage(file, 500, 0.85);
    setEdit((e) => (e ? { ...e, logo_data: dataUrl } : e));
  }

  const setStruct = (fn: (s: ModeleStructure) => ModeleStructure) =>
    setEdit((e) => (e ? { ...e, structure: fn(structuredClone(e.structure)) } : e));

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Link to="/rapports" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="h-4 w-4" /> Rapports
      </Link>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="pro-title text-2xl sm:text-3xl">Modèles de rapport donneurs d'ordre</h1>
          <p className="text-sm text-muted-foreground">
            Une photo de la feuille papier, une seule fois. Ensuite le modèle s'ouvre automatiquement sur les chantiers de ce donneur d'ordre.
          </p>
        </div>
        {!edit && (
          <Button onClick={() => setEdit(vide())}>
            <Plus className="h-4 w-4" /> Nouveau modèle
          </Button>
        )}
      </div>

      {edit && (
        <div className="neo-dashboard-panel space-y-4 rounded-lg border border-border p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">Donneur d'ordre (tel qu'écrit dans le planning)
              <Input value={edit.donneur_ordre} onChange={(e) => setEdit({ ...edit, donneur_ordre: e.target.value })} placeholder="Ex. TotalEnergies, Ensio" />
            </label>
            <label className="text-sm">Nom du modèle
              <Input value={edit.nom} onChange={(e) => setEdit({ ...edit, nom: e.target.value })} placeholder="Rapport d'intervention TotalEnergies" />
            </label>
            <label className="text-sm">Email d'envoi du rapport signé
              <Input type="email" value={edit.email_destinataire} onChange={(e) => setEdit({ ...edit, email_destinataire: e.target.value })} placeholder="charge.affaires@..." />
            </label>
            <div className="text-sm">Logo du donneur d'ordre
              <div className="mt-1 flex items-center gap-3">
                {edit.logo_data && <img src={edit.logo_data} alt="Logo" className="h-10 max-w-[120px] rounded bg-white object-contain p-1" />}
                <label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-border px-3">
                  <Camera className="h-4 w-4" /> {edit.logo_data ? "Changer" : "Ajouter le logo"}
                  <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && photoLogo(e.target.files[0])} />
                </label>
              </div>
            </div>
          </div>

          <div className="grid gap-2 sm:grid-cols-2">
            <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary/60 px-3 text-sm font-semibold text-primary">
              {analyse ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
              {analyse ? "Lecture de la feuille…" : "Prendre une photo de la feuille"}
              <input type="file" accept="image/*" capture="environment" className="hidden" disabled={analyse} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) photoFeuille(f); }} />
            </label>
            <label className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary/60 px-3 text-sm font-semibold text-primary">
              {analyse ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileUp className="h-5 w-5" />}
              {analyse ? "Lecture de la feuille…" : "Importer le PV (PDF ou image)"}
              <input type="file" accept="application/pdf,image/*" className="hidden" disabled={analyse} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) photoFeuille(f); }} />
            </label>
          </div>

          <label className="block text-sm">Titre du rapport
            <Input value={edit.structure.titre} onChange={(e) => setStruct((s) => ({ ...s, titre: e.target.value }))} />
          </label>

          {edit.structure.original && (
            <div className="space-y-2">
              <div>
                <h2 className="text-sm font-bold">Document original conservé</h2>
                <p className="text-xs text-muted-foreground">Les cadres bleus indiquent où les informations seront ajoutées. Faites-les glisser si nécessaire.</p>
              </div>
              <RapportOriginalDoc
                structure={edit.structure}
                valeurs={{}}
                edit
                onChange={(structure) => setEdit((current) => current ? { ...current, structure } : current)}
              />
            </div>
          )}

          {edit.structure.sections.map((sec, si) => (
            <div key={si} className="space-y-2 rounded-lg border border-border p-3">
              <div className="flex gap-2">
                <Input value={sec.titre} placeholder="Rubrique" onChange={(e) => setStruct((s) => { s.sections[si]!.titre = e.target.value; return s; })} />
                <Button variant="ghost" size="icon" onClick={() => setStruct((s) => { s.sections.splice(si, 1); return s; })}><Trash2 className="h-4 w-4" /></Button>
              </div>
              {sec.champs.map((c, ci) => (
                <div key={c.id} className="flex gap-2">
                  <Input value={c.label} onChange={(e) => setStruct((s) => { s.sections[si]!.champs[ci]!.label = e.target.value; return s; })} />
                  <select
                    value={c.type}
                    onChange={(e) => setStruct((s) => { s.sections[si]!.champs[ci]!.type = e.target.value as ChampType; return s; })}
                    className="rounded-md border border-border bg-background px-2 text-sm"
                  >
                    {Object.entries(TYPE_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                  </select>
                  <Button variant="ghost" size="icon" onClick={() => setStruct((s) => { s.sections[si]!.champs.splice(ci, 1); return s; })}><Trash2 className="h-4 w-4" /></Button>
                </div>
              ))}
              <Button variant="outline" size="sm" onClick={() => setStruct((s) => { s.sections[si]!.champs.push({ id: `c${Date.now()}`, label: "Nouveau champ", type: "case", auto: null }); return s; })}>
                <Plus className="h-3 w-3" /> Champ
              </Button>
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={() => setStruct((s) => { s.sections.push({ titre: "Nouvelle rubrique", champs: [] }); return s; })}>
            <Plus className="h-3 w-3" /> Rubrique
          </Button>

          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" onClick={() => setEdit(null)}>Annuler</Button>
            <Button
              disabled={save.isPending || !edit.donneur_ordre.trim() || !edit.nom.trim() || !edit.structure.sections.length}
              onClick={() => save.mutate(edit)}
            >
              {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer le modèle
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <Loader2 className="h-5 w-5 animate-spin" />
      ) : modeles.length === 0 && !edit ? (
        <p className="text-sm text-muted-foreground">Aucun modèle pour l'instant.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {modeles.map((m) => {
            const s = normaliserStructure(m.structure);
            return (
              <div key={m.id} className="neo-dashboard-panel space-y-2 rounded-lg border border-border p-3 sm:col-span-2">
              <div className="flex items-center gap-3">
                {m.logo_data ? <img src={m.logo_data} alt="" className="h-10 w-16 rounded bg-white object-contain p-1" /> : <div className="h-10 w-16 rounded bg-muted" />}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{m.nom}</div>
                  <div className="text-xs text-muted-foreground">{m.donneur_ordre} · {s.sections.reduce((n, x) => n + x.champs.length, 0)} champs</div>
                </div>
                <Button size="sm" variant="outline" onClick={() => setEdit({ id: m.id, nom: m.nom, donneur_ordre: m.donneur_ordre, email_destinataire: m.email_destinataire ?? "", logo_data: m.logo_data, structure: s, actif: m.actif })}>Modifier</Button>
                <Button size="icon" variant="ghost" onClick={() => window.confirm("Supprimer ce modèle ?") && del.mutate(m.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
              <ChantiersSuggeres donneur={m.donneur_ordre} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ChantiersSuggeres({ donneur }: { donneur: string }) {
  const fn = useServerFn(listChantiersTerminesDonneur);
  const [ouvert, setOuvert] = useState(false);
  const { data = [], isLoading } = useQuery({
    queryKey: ["chantiers-termines-donneur", donneur],
    queryFn: () => fn({ data: { donneur } }),
    enabled: ouvert && donneur.trim().length >= 2,
  });
  if (!ouvert)
    return (
      <Button size="sm" className="w-full" onClick={() => setOuvert(true)}>
        Remplir pour un chantier terminé
      </Button>
    );
  return (
    <div className="space-y-1 rounded-md border border-border p-2">
      <div className="flex items-center justify-between text-xs font-semibold">
        <span>Chantiers {donneur} terminés — choisissez-en un, les informations se remplissent seules</span>
        <button type="button" className="text-muted-foreground" onClick={() => setOuvert(false)}>Fermer</button>
      </div>
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : data.length === 0 ? (
        <p className="text-xs text-muted-foreground">Aucun chantier terminé pour ce donneur d'ordre.</p>
      ) : (
        data.map((r) => (
          <Link
            key={r.id}
            to="/chantier-rapport/$rdvId"
            params={{ rdvId: r.id }}
            className="flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm hover:bg-muted"
          >
            <span className="min-w-0">
              <span className="block truncate font-semibold">{r.client_nom}</span>
              <span className="block truncate text-xs text-muted-foreground">
                {[r.adresse, r.cp_ville].filter(Boolean).join(", ")} · terminé le {new Date(r.termine_at!).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" })}
              </span>
            </span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${r.pv_signe ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
              {r.pv_signe ? "PV signé" : "À remplir"}
            </span>
          </Link>
        ))
      )}
    </div>
  );
}
