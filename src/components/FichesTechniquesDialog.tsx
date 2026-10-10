import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { analyserFicheTechnique, enregistrerFicheTechnique, type FicheExtraite } from "@/lib/fiches-techniques.functions";
import { SEUIL_SUR } from "@/lib/fiche-match";

type Chantier = { id: string; client_nom: string; cp_ville: string | null; date_debut: string };
type Ligne = { nom: string; data_url: string; fiche: FicheExtraite; rdv: string; suggestions: { id: string; score: number }[]; fait: boolean };

const lire = (f: File) => new Promise<string>((ok, ko) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => ko(new Error("Lecture impossible.")); r.readAsDataURL(f); });

async function imageCompressee(f: File) {
  const url = await lire(f);
  const img = new Image();
  await new Promise((ok, ko) => { img.onload = ok; img.onerror = ko; img.src = url; });
  const k = Math.min(1, 2000 / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85);
}

const jour = (iso: string) => new Date(iso).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" });

export function FichesTechniquesDialog({ chantiers, onClose, onDone }: { chantiers: Chantier[]; onClose: () => void; onDone: () => void }) {
  const analyser = useServerFn(analyserFicheTechnique);
  const enregistrer = useServerFn(enregistrerFicheTechnique);
  const [busy, setBusy] = useState<string | null>(null);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const parId = new Map(chantiers.map((c) => [c.id, c]));

  const onFile = async (f: File) => {
    setBusy(`Lecture de « ${f.name} »…`);
    try {
      const nom = f.name.toLowerCase();
      let payload: { data_url?: string; filename?: string; texte?: string };
      let fichier: string;
      if (/\.(xlsx|xls|csv|ods)$/.test(nom)) {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(await f.arrayBuffer());
        payload = { texte: wb.SheetNames.map((n) => XLSX.utils.sheet_to_csv(wb.Sheets[n]!)).join("\n\n").slice(0, 190_000) };
        fichier = await lire(f);
      } else if (f.type === "application/pdf" || nom.endsWith(".pdf")) {
        if (f.size > 10_000_000) throw new Error("PDF trop lourd (10 Mo maximum).");
        fichier = (await lire(f)).replace(/^data:[^;]*;/, "data:application/pdf;");
        payload = { data_url: fichier, filename: f.name };
      } else if (f.type.startsWith("image/")) {
        fichier = await imageCompressee(f);
        payload = { data_url: fichier };
      } else throw new Error("Format non supporté : photo, PDF ou Excel.");
      const r = await analyser({ data: payload });
      const meilleur = r.suggestions[0];
      setLignes((l) => [...l, { nom: f.name, data_url: fichier, fiche: r.fiche, suggestions: r.suggestions, rdv: meilleur && meilleur.score >= SEUIL_SUR ? meilleur.id : "", fait: false }]);
    } catch (e) {
      toast.error(`${f.name} : ${e instanceof Error ? e.message : "analyse impossible"}`);
    } finally {
      setBusy(null);
    }
  };

  const ranger = async () => {
    let ok = 0;
    for (const [i, l] of lignes.entries()) {
      if (l.fait || !l.rdv) continue;
      setBusy(`Rangement ${i + 1}/${lignes.length}…`);
      try {
        await enregistrer({ data: { rendezvous_id: l.rdv, nom: l.nom, data_url: l.data_url, resume: l.fiche.resume, completer: { puissance_borne: l.fiche.puissance_borne, phase_installation: l.fiche.phase_installation, type_pose: l.fiche.type_pose, metrage_m: l.fiche.metrage_m, repartiteur: l.fiche.repartiteur } } });
        setLignes((x) => x.map((y, j) => (j === i ? { ...y, fait: true } : y)));
        ok++;
      } catch (e) {
        toast.error(`${l.nom} : ${e instanceof Error ? e.message : "erreur"}`);
      }
    }
    setBusy(null);
    if (ok) { toast.success(`${ok} fiche(s) rangée(s) sur leur chantier.`); onDone(); }
  };

  const aRanger = lignes.filter((l) => !l.fait && l.rdv).length;
  const champ = "w-full bg-background border border-border rounded-sm px-2 py-1.5 text-sm";

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center p-3 overflow-y-auto">
      <div className="bg-card border border-border rounded-lg w-full max-w-3xl p-5 my-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold">Fiches techniques / visites techniques</h2>
            <p className="text-sm text-muted-foreground">Déposez une ou plusieurs fiches : la plateforme lit le nom du client, retrouve son chantier et complète les informations vides. Vérifiez avant de ranger.</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="p-1 hover:text-primary"><X className="h-5 w-5" /></button>
        </div>
        <label className="border-2 border-dashed border-border rounded-lg p-4 flex items-center justify-center gap-2 cursor-pointer hover:border-primary text-sm mb-4">
          <FileText className="h-5 w-5 text-primary" /> Choisir les fiches (photo, PDF, Excel — plusieurs possibles)
          <input type="file" multiple className="hidden" accept="image/*,application/pdf,.pdf,.xlsx,.xls,.csv,.ods" disabled={!!busy}
            onChange={async (e) => { const files = Array.from(e.target.files ?? []); e.target.value = ""; for (const f of files) await onFile(f); }} />
        </label>
        {busy && <p className="text-sm text-primary flex items-center gap-2 mb-3"><Loader2 className="h-4 w-4 animate-spin" /> {busy}</p>}
        <div className="space-y-3">
          {lignes.map((l, i) => {
            const proposes = l.suggestions.map((s) => parId.get(s.id)).filter(Boolean) as Chantier[];
            const autres = chantiers.filter((c) => !l.suggestions.some((s) => s.id === c.id));
            return (
              <div key={i} className={`border rounded-lg p-3 ${l.fait ? "border-emerald-500/60 opacity-70" : "border-border"}`}>
                <p className="text-sm font-semibold break-words">{l.nom}</p>
                <p className="text-xs text-muted-foreground">Lu : {l.fiche.client_nom ?? "client non trouvé"}{l.fiche.cp_ville ? ` · ${l.fiche.cp_ville}` : ""}{l.fiche.puissance_borne ? ` · ${l.fiche.puissance_borne}` : ""}{l.fiche.metrage_m ? ` · ${l.fiche.metrage_m} m` : ""}</p>
                {l.fait ? <p className="mt-2 text-sm font-semibold text-emerald-600">Rangée sur le chantier ✓</p> : (
                  <label className="mt-2 block text-xs text-muted-foreground">Chantier
                    <select className={`${champ} mt-1`} value={l.rdv} onChange={(e) => setLignes((x) => x.map((y, j) => (j === i ? { ...y, rdv: e.target.value } : y)))}>
                      <option value="">— À choisir —</option>
                      {proposes.length > 0 && <optgroup label="Proposés">{proposes.map((c) => <option key={c.id} value={c.id}>{c.client_nom} · {c.cp_ville ?? ""} · {jour(c.date_debut)}</option>)}</optgroup>}
                      <optgroup label="Tous les chantiers">{autres.map((c) => <option key={c.id} value={c.id}>{c.client_nom} · {c.cp_ville ?? ""} · {jour(c.date_debut)}</option>)}</optgroup>
                    </select>
                    {!l.rdv && <span className="mt-1 block text-amber-600">Chantier pas trouvé avec certitude : choisissez-le.</span>}
                  </label>
                )}
              </div>
            );
          })}
        </div>
        {lignes.length > 0 && (
          <div className="flex justify-end mt-4">
            <button type="button" disabled={!!busy || !aRanger} onClick={ranger} className="hero-grad text-primary-foreground text-xs font-bold rounded-sm px-5 py-2.5 disabled:opacity-50">
              Ranger {aRanger} fiche(s)
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
