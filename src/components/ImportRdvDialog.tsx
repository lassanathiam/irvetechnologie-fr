import { DonneurOrdreField } from "@/components/DonneurOrdreField";
import { useState } from "react";
import { DateAvecJour } from "@/components/DateAvecJour";
import { useServerFn } from "@tanstack/react-start";
import { FileUp, Loader2, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { type RdvExtrait } from "@/lib/import-rdv.functions";
import { createRendezVous } from "@/lib/planning.functions";
import { Button } from "@/components/ui/button";
import { lireRdvSansIA } from "@/lib/import-chantier-local";
import { texteFichierSansIA } from "@/lib/fichier-chantier-local";
import { reperesDoublons, type ChantierComparable } from "@/lib/doublons-import";

type Ligne = RdvExtrait & { garder: boolean; doublon?: string | null };

export function ImportRdvDialog({ partenaires, existants = [], onClose, onDone }: {
  partenaires: string[];
  existants?: (ChantierComparable & { statut?: string | null })[];
  onClose: () => void;
  onDone: () => void;
}) {
  const creer = useServerFn(createRendezVous);
  const [busy, setBusy] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [partenaire, setPartenaire] = useState("");
  const [texte, setTexte] = useState("");

  const onTexte = async () => {
    const t = texte.trim();
    if (t.length < 10) return setErreur("Collez d'abord le texte de la planification.");
    setErreur(null);
    setBusy("Lecture du texte…");
    try {
      const res = lireRdvSansIA(t.slice(0, 190_000));
      ajouter(res);
      setTexte("");
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Analyse impossible.");
    } finally {
      setBusy(null);
    }
  };

  const onFile = async (f: File) => {
    setErreur(null);
    setBusy(`Lecture de « ${f.name} »…`);
    try {
      const texteLu = await texteFichierSansIA(f);
      if (!texteLu.trim()) throw new Error("Aucun texte lisible : collez le texte ou ajoutez une intervention à compléter.");
      const res = lireRdvSansIA(texteLu.slice(0, 190_000));
      ajouter(res);
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Analyse impossible.");
    } finally {
      setBusy(null);
    }
  };

  // Les doublons (planning existant ou même import) sont retirés d'office ; on peut les recocher.
  const ajouter = (res: RdvExtrait[]) => setLignes((l) => {
    const toutes = [...l, ...res.map((r) => ({ ...r, garder: true }) as Ligne)];
    const raisons = reperesDoublons(toutes, existants);
    const n = raisons.slice(l.length).filter(Boolean).length;
    if (n) toast.info(`${n} doublon(s) retiré(s) de l'import.`);
    return toutes.map((x, i) => (i < l.length ? x : { ...x, doublon: raisons[i], garder: !raisons[i] }));
  });

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
            creneau_fin: l.creneau_fin ?? null,
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
    <div role="dialog" aria-modal="true" aria-label="Importer des rendez-vous" className="fixed inset-0 z-[2000] bg-background/80 backdrop-blur-sm flex items-start justify-center p-3 overflow-y-auto">
      <div className="bg-card border border-border rounded-lg w-full max-w-4xl p-5 my-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold">Importer des rendez-vous</h2>
            <p className="text-sm text-muted-foreground">
              Import sans IA · 0 crédit d’analyse
            </p>
          </div>
          <Button type="button" onClick={onClose} aria-label="Fermer" className="p-1 hover:text-primary"><X className="h-5 w-5" /></Button>
        </div>

        <div className="grid sm:grid-cols-2 gap-3 mb-4">
          <label className="border-2 border-dashed border-border rounded-lg p-4 flex items-center justify-center gap-2 cursor-pointer hover:border-primary text-sm">
            <FileUp className="h-5 w-5 text-primary" /> Choisir un fichier (plusieurs possibles)
            <input
              type="file"
              multiple
              className="hidden"
              accept="image/*,application/pdf,.pdf,.xlsx,.xls,.csv,.ods,.txt,.md"
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

        <div className="mb-4">
          <label className="text-xs text-muted-foreground" htmlFor="import-texte">Ou collez directement le texte de la planification (mail, message, tableau copié…)</label>
          <textarea
            id="import-texte"
            className={`${champ} mt-1`}
            rows={4}
            value={texte}
            disabled={!!busy}
            onChange={(e) => setTexte(e.target.value)}
            placeholder={"Ex. : Lundi 27 octobre 9h — Mme Dupont, 12 rue des Lilas, 44100 Nantes — installation borne BUMP…"}
          />
          <div className="flex flex-wrap justify-end gap-2 mt-2">
            <Button type="button" variant="outline" disabled={!!busy} onClick={() => setLignes((l) => [...l, { ...lireRdvSansIA("Client : Client à préciser")[0], client_nom: "Client à préciser", adresse: "", reseau_client: null, client_telephone: null, client_email: null, cp_ville: null, date_debut: null, creneau_fin: null, type: "installation", designation: null, numero_dossier: null, notes: null, garder: true }])}>Ajouter à compléter</Button>
            <Button type="button" onClick={onTexte} disabled={!!busy || texte.trim().length < 10}
              className="hero-grad text-primary-foreground text-mono text-xs font-bold rounded-sm px-4 py-2 disabled:opacity-50">
              Lire sans IA
            </Button>
          </div>
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
                  {l.doublon && <span className="rounded-sm bg-destructive/15 text-destructive px-1.5 py-0.5 text-[11px] font-bold">Doublon, retiré · {l.doublon}</span>}
                </label>
                <Button type="button" onClick={() => setLignes((x) => x.filter((_, j) => j !== i))} aria-label="Retirer" className="text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
              </div>
              <div className="grid sm:grid-cols-3 gap-2">
                <label className="sm:col-span-3 text-sm font-semibold text-primary">Client (BUMP, 50FIVE, AMARA, DKV…)
                  <input aria-label="Client (BUMP, 50FIVE, AMARA, DKV…)" className={`${champ} mt-1`} value={l.reseau_client ?? ""} onChange={(e) => maj(i, { reseau_client: e.target.value || null })} placeholder="Nom figurant sur la planification" />
                </label>
                <input aria-label="Nom du client" className={champ} value={l.client_nom} onChange={(e) => maj(i, { client_nom: e.target.value })} placeholder="Client" />
                <input aria-label="Téléphone" className={champ} value={l.client_telephone ?? ""} onChange={(e) => maj(i, { client_telephone: e.target.value || null })} placeholder="Téléphone" />
                <input aria-label="Email" className={champ} value={l.client_email ?? ""} onChange={(e) => maj(i, { client_email: e.target.value || null })} placeholder="Email" />
                <input aria-label="Adresse" className={champ} value={l.adresse} onChange={(e) => maj(i, { adresse: e.target.value })} placeholder="Adresse" />
                <input aria-label="CP / ville" className={champ} value={l.cp_ville ?? ""} onChange={(e) => maj(i, { cp_ville: e.target.value || null })} placeholder="CP / ville" />
                <DateAvecJour type="datetime-local" className={champ} value={l.date_debut ?? ""} onChange={(e) => maj(i, { date_debut: e.target.value || null })} />
                <label className="mt-1 flex items-center gap-2 text-xs">Jusqu'à <input type="time" className={champ} value={l.creneau_fin ?? ""} onChange={(e) => maj(i, { creneau_fin: e.target.value || null })} /></label>
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
            <Button type="button" disabled={!!busy || !lignes.some((l) => l.garder)} onClick={valider}
              className="hero-grad text-primary-foreground text-mono text-xs font-bold rounded-sm px-5 py-2.5 disabled:opacity-50">
              Créer {lignes.filter((l) => l.garder).length} rendez-vous
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
