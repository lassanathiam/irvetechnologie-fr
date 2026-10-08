import { DonneurOrdreField } from "@/components/DonneurOrdreField";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FileUp, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { analyserDocumentRdv, type RdvExtrait } from "@/lib/import-rdv.functions";
import { createRendezVous } from "@/lib/planning.functions";

type Ligne = RdvExtrait & { garder: boolean };

function lireDataUrl(f: File) {
  return new Promise<string>((ok, ko) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result));
    r.onerror = () => ko(new Error("Lecture du fichier impossible."));
    r.readAsDataURL(f);
  });
}

async function compresserImage(f: File): Promise<string> {
  const url = await lireDataUrl(f);
  const img = new Image();
  await new Promise((ok, ko) => {
    img.onload = ok;
    img.onerror = ko;
    img.src = url;
  });
  const max = 2000;
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas");
  c.width = Math.round(img.width * k);
  c.height = Math.round(img.height * k);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.85);
}

export function ImportRdvDialog({ partenaires, onClose, onDone }: {
  partenaires: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const analyser = useServerFn(analyserDocumentRdv);
  const creer = useServerFn(createRendezVous);
  const [busy, setBusy] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [partenaire, setPartenaire] = useState("");

  const onFile = async (f: File) => {
    setErreur(null);
    setBusy(`Lecture de « ${f.name} »…`);
    try {
      const nom = f.name.toLowerCase();
      let payload: { data_url?: string; filename?: string; texte?: string };
      if (/\.(xlsx|xls|csv|ods)$/.test(nom)) {
        const XLSX = await import("xlsx");
        const wb = XLSX.read(await f.arrayBuffer());
        const texte = wb.SheetNames.map((n) => `# ${n}\n${XLSX.utils.sheet_to_csv(wb.Sheets[n]!)}`).join("\n\n");
        payload = { texte: texte.slice(0, 190_000) };
      } else if (f.type === "application/pdf" || nom.endsWith(".pdf")) {
        if (f.size > 10_000_000) throw new Error("PDF trop lourd (10 Mo maximum).");
        payload = { data_url: (await lireDataUrl(f)).replace(/^data:[^;]*;/, "data:application/pdf;"), filename: f.name };
      } else if (f.type.startsWith("image/")) {
        payload = { data_url: await compresserImage(f) };
      } else throw new Error("Format non supporté : photo, capture, PDF ou Excel.");
      const res = await analyser({ data: payload });
      setLignes((l) => [...l, ...res.map((r) => ({ ...r, garder: true }))]);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Analyse impossible.");
    } finally {
      setBusy(null);
    }
  };

  const maj = (i: number, p: Partial<Ligne>) => setLignes((l) => l.map((x, j) => (j === i ? { ...x, ...p } : x)));

  const valider = async () => {
    const choisies = lignes.filter((l) => l.garder);
    const incompletes = choisies.filter((l) => l.adresse.trim().length < 3);
    if (incompletes.length) return setErreur("Chaque intervention doit avoir une adresse.");
    setErreur(null);
    let ok = 0;
    for (const [n, l] of choisies.entries()) {
      setBusy(`Création ${n + 1}/${choisies.length}…`);
      try {
        const date = l.date_debut ? new Date(l.date_debut) : new Date(Date.now() + 86_400_000);
        if (!l.date_debut) date.setHours(9, 0, 0, 0);
        const notes = [l.numero_dossier ? `N° dossier : ${l.numero_dossier}` : null, l.notes, l.date_debut ? null : "Date à confirmer (non indiquée sur la fiche)."]
          .filter(Boolean).join("\n");
        await creer({
          data: {
            titre: `${l.designation || "Intervention"} — ${l.client_nom}`.slice(0, 160),
            type: l.type,
            statut: "planifie",
            client_nom: l.client_nom,
            reseau_client: l.reseau_client,
            client_telephone: l.client_telephone,
            client_email: l.client_email,
            adresse: l.adresse,
            cp_ville: l.cp_ville,
            date_debut: date.toISOString(),
            duree_min: 120,
            notes: notes || null,
            origine: partenaire ? "sous_traitance" : "direct",
            partenaire: partenaire || null,
            designation: l.designation,
            etiquettes: ["Importé"],
          },
        });
        ok++;
      } catch (e) {
        toast.error(`${l.client_nom} : ${e instanceof Error ? e.message : "erreur"}`);
      }
    }
    setBusy(null);
    toast.success(`${ok} rendez-vous créé(s) dans le planning.`);
    onDone();
    if (ok === choisies.length) onClose();
  };

  const champ = "w-full bg-background border border-border rounded-sm px-2 py-1.5 text-sm";

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center p-3 overflow-y-auto">
      <div className="bg-card border border-border rounded-lg w-full max-w-4xl p-5 my-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold">Importer des rendez-vous</h2>
            <p className="text-sm text-muted-foreground">
              Photo, capture d'écran, PDF ou fichier Excel envoyé par un partenaire. Les informations sont lues automatiquement ; vérifiez-les avant de créer.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" className="p-1 hover:text-primary"><X className="h-5 w-5" /></button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <label className="border-2 border-dashed border-border rounded-lg p-4 flex items-center justify-center gap-2 cursor-pointer hover:border-primary text-sm">
            <FileUp className="h-5 w-5 text-primary" /> Choisir un fichier (plusieurs possibles)
            <input
              type="file"
              multiple
              className="hidden"
              accept="image/*,application/pdf,.pdf,.xlsx,.xls,.csv,.ods"
              disabled={!!busy}
              onChange={async (e) => {
                const files = Array.from(e.target.files ?? []);
                e.target.value = "";
                for (const f of files) await onFile(f);
              }}
            />
          </label>
          <label className="text-sm">
            <span className="text-xs text-muted-foreground">Partenaire donneur d'ordre</span>
            <DonneurOrdreField value={partenaire} onChange={setPartenaire} className={champ} />
          </label>
        </div>

        {busy && <p className="text-sm text-primary flex items-center gap-2 mb-3"><Loader2 className="h-4 w-4 animate-spin" /> {busy}</p>}
        {erreur && <p className="text-sm text-destructive mb-3">{erreur}</p>}

        <div className="space-y-3">
          {lignes.map((l, i) => (
            <div key={i} className={`border rounded-lg p-3 ${l.garder ? "border-border" : "border-border opacity-50"}`}>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-semibold flex items-center gap-2">
                  <input type="checkbox" checked={l.garder} onChange={(e) => maj(i, { garder: e.target.checked })} />
                  Intervention {i + 1}{l.numero_dossier ? ` · ${l.numero_dossier}` : ""}
                </label>
                <button type="button" onClick={() => setLignes((x) => x.filter((_, j) => j !== i))} aria-label="Retirer" className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></button>
              </div>
              <div className="grid sm:grid-cols-3 gap-2">
                <label className="sm:col-span-3 text-sm font-semibold text-primary">Donneur d’ordre principal (BUMP, 50FIVE, AMARA…)
                  <input aria-label="Donneur d’ordre principal (BUMP, 50FIVE, AMARA…)" className={`${champ} mt-1`} value={l.reseau_client ?? ""} onChange={(e) => maj(i, { reseau_client: e.target.value || null })} placeholder="Nom figurant sur la planification" />
                </label>
                <input className={champ} value={l.client_nom} onChange={(e) => maj(i, { client_nom: e.target.value })} placeholder="Client" />
                <input className={champ} value={l.client_telephone ?? ""} onChange={(e) => maj(i, { client_telephone: e.target.value || null })} placeholder="Téléphone" />
                <input className={champ} value={l.client_email ?? ""} onChange={(e) => maj(i, { client_email: e.target.value || null })} placeholder="Email" />
                <input className={champ} value={l.adresse} onChange={(e) => maj(i, { adresse: e.target.value })} placeholder="Adresse" />
                <input className={champ} value={l.cp_ville ?? ""} onChange={(e) => maj(i, { cp_ville: e.target.value || null })} placeholder="CP / ville" />
                <input type="datetime-local" className={champ} value={l.date_debut ?? ""} onChange={(e) => maj(i, { date_debut: e.target.value || null })} />
                <select className={champ} value={l.type} onChange={(e) => maj(i, { type: e.target.value as Ligne["type"] })}>
                  <option value="installation">Installation</option>
                  <option value="maintenance">Maintenance</option>
                  <option value="sav">SAV / dépannage</option>
                  <option value="visite">Visite technique</option>
                  <option value="controle">Contrôle</option>
                </select>
                <input className={`${champ} sm:col-span-2`} value={l.designation ?? ""} onChange={(e) => maj(i, { designation: e.target.value || null })} placeholder="Matériel / prestation" />
                <textarea className={`${champ} sm:col-span-3`} rows={2} value={l.notes ?? ""} onChange={(e) => maj(i, { notes: e.target.value || null })} placeholder="Notes" />
              </div>
              {!l.date_debut && <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">Date absente : mise à demain 9 h, à confirmer.</p>}
            </div>
          ))}
        </div>

        {lignes.length > 0 && (
          <div className="flex justify-end mt-4">
            <button type="button" disabled={!!busy || !lignes.some((l) => l.garder)} onClick={valider}
              className="hero-grad text-primary-foreground text-mono text-xs font-bold rounded-sm px-5 py-2.5 disabled:opacity-50">
              Créer {lignes.filter((l) => l.garder).length} rendez-vous
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
