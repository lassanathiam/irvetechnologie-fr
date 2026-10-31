import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowLeft, Camera, Download, Loader2, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ProShell } from "@/components/ProShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SignaturePad } from "@/components/SignaturePad";
import { getCriTotal, enregistrerCriTotal, attribuerPhotoCri } from "@/lib/cri-total.functions";
import { uploadPhotoChantier, supprimerPhotoChantier } from "@/lib/planning.functions";
import { QUESTIONS_CRI, PHOTOS_CRI, valeursParDefaut, photosManquantes } from "@/lib/cri-total";
import { compressImage } from "@/lib/image-compress";

export const Route = createFileRoute("/_authenticated/chantier-cri-total/$rdvId")({
  head: () => ({
    meta: [
      { title: "PV TotalEnergies — Compte-rendu d'intervention" },
      { name: "description", content: "Compte-rendu d'intervention TotalEnergies avec photos, réponses et signatures." },
      { property: "og:title", content: "PV TotalEnergies — Compte-rendu d'intervention" },
      { property: "og:description", content: "Remplir le PV TotalEnergies depuis le chantier." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CriTotalPage,
});

function CriTotalPage() {
  const { rdvId } = Route.useParams();
  const qc = useQueryClient();
  const getFn = useServerFn(getCriTotal);
  const saveFn = useServerFn(enregistrerCriTotal);
  const uploadFn = useServerFn(uploadPhotoChantier);
  const delFn = useServerFn(supprimerPhotoChantier);
  const attribuerFn = useServerFn(attribuerPhotoCri);
  const [choix, setChoix] = useState<string | null>(null);
  const placer = async (categorie: string, photoId: string) => {
    try {
      await attribuerFn({ data: { rdvId, photoId, categorie } });
      await qc.invalidateQueries({ queryKey: ["cri-total", rdvId] });
      toast.success("Photo appliquée au PV");
    } catch (e) { toast.error((e as Error).message); }
  };
  const { data, isLoading, error } = useQuery({ queryKey: ["cri-total", rdvId], queryFn: () => getFn({ data: { rdvId } }) });
  const [v, setV] = useState<Record<string, string>>({});
  const [sigT, setSigT] = useState<string | null>(null);
  const [sigC, setSigC] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState<string | null>(null);
  const [pdf, setPdf] = useState(false);
  const [pret, setPret] = useState(false);

  useEffect(() => {
    if (!data || pret) return;
    const base = valeursParDefaut();
    if (data.rdv.phase_installation && /tri/i.test(data.rdv.phase_installation)) base.type_installation = "TRI";
    if (data.rdv.puissance_borne) { base.puissance_installee = data.rdv.puissance_borne; base.puissance_borne = data.rdv.puissance_borne; }
    base.nom_client = data.rdv.client_nom;
    setV({ ...base, ...((data.cri?.valeurs as Record<string, string>) ?? {}) });
    setSigT(data.cri?.signature_technicien ?? null);
    setSigC(data.cri?.signature_client ?? null);
    setPret(true);
  }, [data, pret]);

  const save = useMutation({
    mutationFn: () => saveFn({ data: { rdvId, valeurs: v, signature_technicien: sigT, signature_client: sigC } }),
    onSuccess: () => toast.success("PV TotalEnergies enregistré"),
    onError: (e: Error) => toast.error(e.message),
  });

  const ajouter = async (categorie: string, files: FileList | null) => {
    if (!files?.length) return;
    setEnvoi(categorie);
    try {
      for (const f of Array.from(files)) await uploadFn({ data: { rendezvous_id: rdvId, categorie, data_url: await compressImage(f, 1600, 0.75) } });
      await qc.invalidateQueries({ queryKey: ["cri-total", rdvId] });
      toast.success("Photo ajoutée");
    } catch (e) { toast.error((e as Error).message); } finally { setEnvoi(null); }
  };

  const telecharger = async () => {
    if (!data) return;
    setPdf(true);
    try {
      await saveFn({ data: { rdvId, valeurs: v, signature_technicien: sigT, signature_client: sigC } });
      const { genererCriTotalPdf } = await import("@/lib/cri-total-pdf");
      const d = new Date(data.rdv.termine_at ?? data.rdv.date_debut);
      const blob = await genererCriTotalPdf({ rdv: data.rdv, valeurs: v, photos: data.photos, signatureTechnicien: sigT, signatureClient: sigC, dateCloture: d.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
      a.download = `PV-TOTAL-${data.rdv.client_nom.replace(/[^\w-]+/g, "-")}.pdf`; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch (e) { toast.error((e as Error).message || "Création du PDF impossible"); } finally { setPdf(false); }
  };

  if (isLoading) return <ProShell><div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div></ProShell>;
  if (error || !data) return <ProShell><p className="p-6">{(error as Error)?.message ?? "Chantier introuvable."}</p></ProShell>;

  const manquantes = photosManquantes(data.photos.map((p) => p.categorie));
  const set = (id: string, val: string) => setV((o) => ({ ...o, [id]: val }));

  return (
    <ProShell>
      <div className="mx-auto w-full max-w-3xl space-y-5 px-3 py-4">
        <Button asChild variant="ghost" size="sm"><Link to="/planning"><ArrowLeft /> Planning</Link></Button>
        <header>
          <h1 className="text-2xl font-bold">PV TotalEnergies — Compte-rendu d'intervention</h1>
          <p className="text-muted-foreground">{data.rdv.client_nom} · {data.rdv.adresse} {data.rdv.cp_ville}</p>
        </header>

        <div className={`rounded-lg border p-3 text-sm font-semibold ${manquantes.length ? "border-destructive bg-destructive/10" : "border-primary bg-primary/10"}`}>
          {manquantes.length ? `${manquantes.length} photo(s) obligatoire(s) manquante(s) — sans elles, Total refuse le PV.` : "Toutes les photos obligatoires sont présentes."}
        </div>

        <section className="space-y-3 rounded-lg border p-4">
          <h2 className="font-bold">Résumé de l'intervention</h2>
          <Champ label="Référence client"><Input value={v.reference_client ?? ""} onChange={(e) => set("reference_client", e.target.value)} /></Champ>
          <Champ label="Raison sociale"><Input value={v.raison_sociale ?? ""} onChange={(e) => set("raison_sociale", e.target.value)} /></Champ>
          <Champ label="Résultat de l'intervention"><Choix options={["OK", "NOK"]} value={v.resultat} onChange={(x) => set("resultat", x)} /></Champ>
          <Champ label="Commentaire du technicien"><Textarea value={v.commentaire_technicien ?? ""} onChange={(e) => set("commentaire_technicien", e.target.value)} /></Champ>
          <Champ label="Commentaires techniques"><Textarea value={v.commentaires_techniques ?? ""} onChange={(e) => set("commentaires_techniques", e.target.value)} /></Champ>
        </section>

        <section className="space-y-3 rounded-lg border p-4">
          <h2 className="font-bold">Débrief</h2>
          {QUESTIONS_CRI.map((q) => q.titre
            ? <h3 key={q.id} className="pt-2 text-sm font-bold text-primary">{q.label}</h3>
            : <Champ key={q.id} label={q.label}>{q.options
              ? <Choix options={q.options} value={v[q.id]} onChange={(x) => set(q.id, x)} />
              : <Input value={v[q.id] ?? ""} onChange={(e) => set(q.id, e.target.value)} />}</Champ>)}
        </section>

        <section className="space-y-3 rounded-lg border p-4">
          <h2 className="font-bold">Photos du PV</h2>
          {PHOTOS_CRI.map((slot, i) => {
            const photos = data.photos.filter((p) => p.categorie === slot.categorie);
            const manque = slot.obligatoire && !photos.length;
            return (
              <div key={slot.categorie} className={`rounded-md border p-3 ${manque ? "border-destructive" : "border-border"}`}>
                <p className="font-semibold">{i + 1}. {slot.label} {slot.obligatoire ? <span className="text-destructive">*</span> : <span className="text-xs text-muted-foreground">(facultatif)</span>}</p>
                {slot.aide && <p className="text-xs font-semibold text-destructive">{slot.aide}</p>}
                <div className="mt-2 flex flex-wrap gap-2">
                  {photos.map((p) => (
                    <div key={p.id} className="relative">
                      <img src={p.url} alt={slot.label} className="h-24 w-24 rounded object-cover" />
                      <button type="button" aria-label="Supprimer la photo" className="absolute right-1 top-1 rounded bg-background/90 p-1"
                        onClick={async () => { if (!confirm("Supprimer cette photo ?")) return; await delFn({ data: { id: p.id } }); qc.invalidateQueries({ queryKey: ["cri-total", rdvId] }); }}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded border border-dashed text-xs">
                    {envoi === slot.categorie ? <Loader2 className="animate-spin" /> : <><Camera /> Ajouter</>}
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => { ajouter(slot.categorie, e.target.files); e.target.value = ""; }} />
                  </label>
                  <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center rounded border border-dashed text-center text-xs">
                    <ImagePlus /> Galerie
                    <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => { ajouter(slot.categorie, e.target.files); e.target.value = ""; }} />
                  </label>
                  {data.dossier.length > 0 && (
                    <button type="button" onClick={() => setChoix(choix === slot.categorie ? null : slot.categorie)}
                      className="flex h-24 w-24 flex-col items-center justify-center rounded border border-dashed border-primary text-center text-xs font-semibold text-primary">
                      <FolderOpen /> Photos du chantier ({data.dossier.length})
                    </button>
                  )}
                </div>
                {choix === slot.categorie && (
                  <div className="mt-3 rounded-md border bg-muted/40 p-2">
                    <p className="mb-2 text-xs font-semibold">Touchez une photo déjà prise sur ce chantier pour l'appliquer à « {slot.label} » :</p>
                    <div className="flex flex-wrap gap-2">
                      {data.dossier.map((p) => {
                        const deja = photos.some((x) => x.url && x.id === p.id);
                        return (
                          <button key={p.id} type="button" disabled={deja} onClick={() => placer(slot.categorie, p.id)}
                            className="relative rounded ring-primary hover:ring-2 disabled:opacity-40">
                            <img src={p.url} alt="Photo du chantier" className="h-20 w-20 rounded object-cover" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </section>

        <section className="space-y-3 rounded-lg border p-4">
          <h2 className="font-bold">Signatures</h2>
          <Champ label="Nom – prénom du technicien"><Input value={v.nom_technicien ?? ""} onChange={(e) => set("nom_technicien", e.target.value)} /></Champ>
          <SignaturePad label="Signature technicien" value={sigT} onChange={setSigT} />
          <Champ label="Nom – prénom du client"><Input value={v.nom_client ?? ""} onChange={(e) => set("nom_client", e.target.value)} /></Champ>
          <SignaturePad label="Signature client" value={sigC} onChange={setSigC} />
        </section>

        <div className="sticky bottom-2 flex gap-2">
          <Button className="h-12 flex-1" variant="outline" onClick={() => save.mutate()} disabled={save.isPending}><Save /> Enregistrer</Button>
          <Button className="h-12 flex-1" onClick={telecharger} disabled={pdf}>{pdf ? <Loader2 className="animate-spin" /> : <Download />} Télécharger le PV</Button>
        </div>
      </div>
    </ProShell>
  );
}

function Champ({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1"><span className="text-sm font-medium">{label}</span>{children}</label>;
}

function Choix({ options, value, onChange }: { options: string[]; value?: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => <Button key={o} type="button" size="sm" variant={value === o ? "default" : "outline"} onClick={() => onChange(o)}>{o}</Button>)}
    </div>
  );
}
