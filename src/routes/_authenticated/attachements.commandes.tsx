import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, CheckCircle2, Download, FileUp, Loader2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { ProShell } from "@/components/ProShell";
import { Button } from "@/components/ui/button";
import { creerFacturePdf } from "@/lib/facture-pdf";
import { appliquerCommandeAttachement, trouverAttachementsCommandes } from "@/lib/attachements.functions";
import { getFacture } from "@/lib/factures.functions";
import { cleNom, lireCommande, type CommandeLue } from "@/lib/commandes-ensio";
import { choisirAttachementCommande } from "@/lib/commande-ecart";
import { RapportEcartCommande } from "@/components/RapportEcartCommande";
import { RapportEcartLot, type CommandePourRapport } from "@/components/RapportEcartLot";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { listerCommandesImportees, enregistrerCommandeImportee, modifierCommandeImportee, retirerCommandeImportee } from "@/lib/commandes-memoire.functions";
import { saisieCommande, saisieCommandeSchema, type CommandeMemorisee } from "@/lib/commandes-memoire";
import { commandesAValider, erreurValidationCommande } from "@/lib/commande-validation";
import { cleCommande, rapprocherAttachement } from "@/lib/attachement-suivi";
import { texteDuPdf } from "@/lib/pdf-texte";
import { SuiviAttachementsCommandes } from "@/components/SuiviAttachementsCommandes";

export const Route = createFileRoute("/_authenticated/attachements/commandes")({
  loader: async () => ({ commandes: await listerCommandesImportees(), atts: await trouverAttachementsCommandes({ data: { numeros: [] } }) }),
  head: () => ({
    meta: [
      { title: "Commandes et rapports d’écart — IRVE Technologie" },
      { name: "description", content: "Commandes ENSIO, AXIANS et autres donneurs d’ordre : rapports d’écart, validation unitaire ou globale sans signature et facturation." },
      { property: "og:title", content: "Commandes et rapports d’écart — IRVE Technologie" },
      { property: "og:description", content: "Vérification des commandes, rapports d’écart détaillés et factures." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

type Att = Awaited<ReturnType<typeof trouverAttachementsCommandes>>[number];
type Ligne = CommandeMemorisee;

const euro = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

function associer(lu: CommandeLue, atts: Att[]): string {
  const connu = rapprocherAttachement(lu, atts);
  if (connu) return connu.id;
  if (lu.numero && atts.some((a) => cleCommande(a.bon_commande) === cleCommande(lu.numero))) return "";
  return choisirAttachementCommande(lu, atts, cleNom);
}

function Page() {
  const initial = Route.useLoaderData();
  const enregistrer = useServerFn(enregistrerCommandeImportee);
  const modifier = useServerFn(modifierCommandeImportee);
  const retirer = useServerFn(retirerCommandeImportee);
  const trouver = useServerFn(trouverAttachementsCommandes);
  const appliquer = useServerFn(appliquerCommandeAttachement);
  const lireFacture = useServerFn(getFacture);
  const [atts, setAtts] = useState<Att[]>(initial.atts);
  const [lignes, setLignes] = useState<Ligne[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const lignesRef = useRef<Ligne[]>([]);
  const sauvegardes = useRef<Promise<void>>(Promise.resolve());
  const [sauvegardeErreur, setSauvegardeErreur] = useState(false);
  const [chargementErreur, setChargementErreur] = useState(false);
  const [reessai, setReessai] = useState(0);
  const remplacer = (valeur: Ligne[]) => { lignesRef.current = valeur; setLignes(valeur); };
  useEffect(() => {
    let actif = true;
    setBusy("Ouverture des commandes enregistrées…");
    async function charger() {
      const resultat: Ligne[] = [];
      for (const commande of initial.commandes) {
        const original = await supabase.storage.from("documents").download(commande.original_path);
        if (original.error || !original.data) throw new Error("Une commande enregistrée ne peut pas être ouverte.");
        const saisie = saisieCommandeSchema.parse(commande.saisie);
        const attId = saisie.attId || associer(saisie.lu, initial.atts);
        const att = initial.atts.find((a) => a.id === attId);
        resultat.push({ ...saisie, ...commande, attId, factureId: att?.facture_id ?? saisie.factureId, bytes: new Uint8Array(await original.data.arrayBuffer()) });
      }
      if (actif) { remplacer(resultat); setChargementErreur(false); }
    }
    void charger().catch((e) => { if (actif) { setChargementErreur(true); toast.error(e instanceof Error ? e.message : "Ouverture impossible."); } }).finally(() => { if (actif) setBusy(null); });
    return () => { actif = false; };
  }, [initial, reessai]);
  async function sauvegarder(ligne: Ligne) {
    await modifier({ data: { id: ligne.id, saisie: saisieCommande(ligne), signe_path: ligne.signe_path } });
  }
  const maj = (i: number, p: Partial<Ligne>) => {
    const ligne = lignesRef.current[i];
    if (!ligne) return;
    const suivante = { ...ligne, ...p };
    remplacer(lignesRef.current.map((x, j) => j === i ? suivante : x));
    const attente = sauvegardes.current.then(() => sauvegarder(suivante));
    sauvegardes.current = attente.catch(() => { setSauvegardeErreur(true); toast.error("Modification non enregistrée : réessayez avant de quitter."); });
  };
  async function retirerLigne(ligne: Ligne) {
    if (!window.confirm("Retirer cette commande de la liste ? La facture et l’attachement seront conservés.")) return;
    setBusy("Retrait de la commande…");
    try { await sauvegardes.current; await retirer({ data: { id: ligne.id } }); remplacer(lignesRef.current.filter((x) => x.id !== ligne.id)); }
    catch (e) { toast.error(e instanceof Error ? e.message : "Retrait impossible."); }
    finally { setBusy(null); }
  }

  async function importer(files: FileList | File[]) {
    const pdfs = Array.from(files).filter((f) => /pdf$/i.test(f.type) || /\.pdf$/i.test(f.name));
    if (!pdfs.length) return;
    if (busy || chargementErreur) return;
    setBusy("Lecture des commandes…");
    try {
      const liste = atts.length ? atts : await trouver({ data: { numeros: [] } });
      setAtts(liste);
      for (const f of pdfs) {
        if (lignesRef.current.some((l) => l.nom === f.name)) continue;
        const bytes = new Uint8Array(await f.arrayBuffer());
        let lu: CommandeLue = { numero: null, attachement: null, client: null, montantHt: null };
        try { lu = lireCommande(await texteDuPdf(bytes)); } catch { /* lecture impossible : saisie manuelle */ }
        const id = crypto.randomUUID(), original_path = `commandes/${id}/original.pdf`;
        const empreinte = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).map((n) => n.toString(16).padStart(2, "0")).join("");
        const attId = associer(lu, liste);
        const ligne: Ligne = { id, original_path, signe_path: null, nom: f.name, bytes, lu: { ...lu, numero: lu.numero ?? f.name.replace(/\.pdf$/i, "").replace(/^CST\s*/i, "CST ") }, attId, factureId: liste.find((a) => a.id === attId)?.facture_id ?? undefined, choix: "" };
        const { error } = await supabase.storage.from("documents").upload(original_path, new Blob([bytes], { type: "application/pdf" }));
        if (error) throw new Error("Le PDF n’a pas pu être enregistré.");
        try { await enregistrer({ data: { id, nom: f.name, empreinte, original_path, saisie: saisieCommande(ligne) } }); }
        catch (e) { await supabase.storage.from("documents").remove([original_path]); throw e; }
        remplacer([...lignesRef.current, ligne]);
      }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Lecture impossible."); }
    finally { setBusy(null); }
  }

  async function valider(id?: string) {
    if (busy || chargementErreur || sauvegardeErreur) return;
    setBusy("Préparation de la validation…");
    await sauvegardes.current;
    const commandes = lignesRef.current;
    const selection = commandes.filter((l) => !l.factureId && (!id || l.id === id));
    let ok = 0;
    for (const [rang, l] of selection.entries()) {
      const i = lignesRef.current.findIndex((ligne) => ligne.id === l.id);
      if (i < 0) continue;
      const numero = l.lu.numero?.trim();
      const erreur = erreurValidationCommande(l, commandes, atts);
      if (erreur) { maj(i, { erreur }); continue; }
      const att = atts.find((a) => a.id === l.attId);
      if (!att || !numero || l.lu.montantHt === null) continue;
      const ecart = Math.abs(l.lu.montantHt - att.total_ht) >= 0.01;
      setBusy(`Validation et facture ${rang + 1}/${selection.length}…`);
      try {
        const r = await appliquer({ data: { id: l.attId, bon_commande: numero, montant_ht: ecart && l.choix === "commande" ? l.lu.montantHt : null } });
        setAtts((actuels) => actuels.map((a) => a.id === l.attId ? { ...a, facture_id: r.id, statut: "facture", bon_commande: numero } : a));
        maj(i, { factureId: r.id, erreur: undefined });
        await sauvegardes.current;
        ok++;
      } catch (e) { maj(i, { erreur: e instanceof Error ? e.message : "Erreur" }); }
    }
    setBusy(null);
    if (ok) toast.success(`${ok} commande(s) validée(s) et facture(s) prête(s).`);
  }

  async function telecharger() {
    const prets = lignes.filter((l) => l.factureId);
    if (!prets.length) return;
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    try {
      for (const [i, l] of prets.entries()) {
        if (!l.factureId || !l.lu.numero) continue;
        setBusy(`Préparation du dossier ${i + 1}/${prets.length}…`);
        const f = await lireFacture({ data: { id: l.factureId } });
        const pdf = await creerFacturePdf({ ...f.facture, date_limite: f.facture.date_echeance }, f.items);
        const dossier = `${l.lu.numero.replace(/[^\p{L}\d_-]+/gu, "")}_${(l.lu.client ?? f.facture.client_nom).replace(/[^\p{L}\d]+/gu, "-")}`;
        zip.file(`${dossier}/Facture_${f.facture.numero}.pdf`, pdf);
        zip.file(`${dossier}/Commande_${l.lu.numero.replace(/[^\p{L}\d_-]+/gu, "")}.pdf`, l.bytes);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `commandes-factures-${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch (e) { toast.error(e instanceof Error ? e.message : "Téléchargement impossible."); }
    finally { setBusy(null); }
  }

  const aTraiter = commandesAValider(lignes, atts).length;
  const prets = lignes.filter((l) => l.factureId).length;
  const eligibleRapport = (l: Ligne) => !!l.attId && !!l.lu.numero?.trim() && l.lu.numero.trim().length >= 3 && l.lu.montantHt !== null;
  const commandesSelectionnees: CommandePourRapport[] = lignes.flatMap((l) => l.rapportSelectionne && eligibleRapport(l) && l.lu.numero && l.lu.montantHt !== null ? [{ id: l.attId, numero: l.lu.numero, montantHt: l.lu.montantHt }] : []);
  const eligibles = lignes.filter(eligibleRapport);
  const tousSelectionnes = eligibles.length > 0 && eligibles.every((l) => l.rapportSelectionne);

  return (
    <ProShell>
      <div className="space-y-6">
        <header>
          <Link to="/attachements" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Attachements</Link>
          <h1 className="mt-2 text-3xl font-semibold">Bons de commande</h1>
          <p className="mt-1 text-sm text-muted-foreground">ENSIO · AXIANS · Autres donneurs d’ordre</p>
        </header>

        <SuiviAttachementsCommandes atts={atts} />

        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); void importer(e.dataTransfer.files); }}
          onClick={() => input.current?.click()}
          className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-primary/50 bg-primary/5 p-8 text-center"
        >
          <FileUp className="h-8 w-8 text-primary" />
          <strong>Glissez ici toutes les commandes PDF</strong>
          <span className="text-sm text-muted-foreground">ou touchez pour les choisir (plusieurs à la fois)</span>
          <input ref={input} type="file" accept="application/pdf" multiple hidden onChange={(e) => { if (e.target.files) void importer(e.target.files); e.target.value = ""; }} />
        </div>

        {busy && <p className="flex items-center gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> {busy}</p>}
        {chargementErreur && <Button variant="outline" onClick={() => setReessai((n) => n + 1)}>Réessayer l’ouverture des commandes</Button>}
        {sauvegardeErreur && <Button variant="outline" onClick={() => { void sauvegardes.current.then(async () => { try { for (const l of lignesRef.current) await sauvegarder(l); setSauvegardeErreur(false); toast.success("Modifications enregistrées."); } catch { toast.error("Enregistrement impossible. Ne quittez pas cette page."); } }); }}>Réessayer l’enregistrement</Button>}

        {lignes.length > 0 && (
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm"><Checkbox aria-label="Sélectionner toutes les commandes pour le rapport" disabled={!!busy || !eligibles.length} checked={tousSelectionnes} onCheckedChange={(checked) => lignesRef.current.forEach((l, i) => maj(i, { rapportSelectionne: eligibleRapport(l) && checked === true }))} /> Tout sélectionner pour le rapport</label>
            <RapportEcartLot commandes={commandesSelectionnees} disabled={!!busy} />
          </div>
        )}

        {lignes.length > 0 && (
          <section className="divide-y divide-border rounded-md border border-border bg-card">
            {lignes.map((l, i) => {
              const att = atts.find((a) => a.id === l.attId);
              const ecart = att && l.lu.montantHt !== null && Math.abs(l.lu.montantHt - att.total_ht) >= 0.01;
              return (
                  <div key={l.nom + i} className="flex min-w-0 flex-wrap items-center gap-3 p-4 text-sm">
                  <Checkbox aria-label={`Inclure la commande ${i + 1} dans le rapport groupé`} disabled={!!busy || !eligibleRapport(l)} checked={!!l.rapportSelectionne && eligibleRapport(l)} onCheckedChange={(checked) => maj(i, { rapportSelectionne: checked === true })} />
                  {l.factureId ? <CheckCircle2 className="h-5 w-5 text-primary" /> : !l.attId ? <AlertTriangle className="h-5 w-5 text-destructive" /> : <CheckCircle2 className="h-5 w-5 text-muted-foreground" />}
                  <div className="min-w-40">
                    <label className="block text-xs text-muted-foreground">Numéro de commande<input aria-label={`Numéro de commande ${i + 1}`} className="mt-1 block w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground" maxLength={60} disabled={!!l.factureId} value={l.lu.numero ?? ""} onChange={(e) => maj(i, { lu: { ...l.lu, numero: e.target.value } })} /></label>
                    <div className="text-muted-foreground">{l.lu.client ?? l.nom} · {l.lu.montantHt !== null ? euro(l.lu.montantHt) : "montant ?"} HT</div>
                  </div>
                  <label className="text-xs text-muted-foreground">Montant HT<input aria-label={`Montant HT commande ${i + 1}`} className="mt-1 block w-32 rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground" type="number" min={0} max={1000000} step="0.01" disabled={!!l.factureId} value={l.lu.montantHt ?? ""} onChange={(e) => maj(i, { lu: { ...l.lu, montantHt: e.target.value === "" ? null : Number(e.target.value) }, choix: "" })} /></label>
                  <select aria-label={`Attachement commande ${i + 1}`} className="w-full min-w-0 rounded-md border border-border bg-background px-2 py-1.5 sm:w-auto sm:max-w-full" disabled={!!l.factureId} value={l.attId} onChange={(e) => maj(i, { attId: e.target.value, choix: "" })}>
                    <option value="">— Choisir l’attachement —</option>
                    {atts.map((a) => <option key={a.id} value={a.id}>{a.client_nom} · {a.numero} · {a.objet} · {euro(a.total_ht)}{a.facture_id ? " · facturé" : ""}{a.bon_commande ? ` · ${a.bon_commande}` : ""}</option>)}
                  </select>
                  {ecart && att && !l.factureId && (
                    <div className="flex flex-wrap items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 px-2 py-1">
                      <span>Écart : attachement {euro(att.total_ht)}</span>
                      <label className="flex items-center gap-1"><input type="radio" checked={l.choix === "commande"} onChange={() => maj(i, { choix: "commande" })} /> Prendre la commande</label>
                      <label className="flex items-center gap-1"><input type="radio" checked={l.choix === "attachement"} onChange={() => maj(i, { choix: "attachement" })} /> Garder l’attachement</label>
                    </div>
                  )}
                  {ecart && att && !l.factureId && l.lu.montantHt !== null && l.lu.numero?.trim() && <RapportEcartCommande id={att.id} numero={l.lu.numero} montantHt={l.lu.montantHt} />}
                  {l.factureId ? <Link to="/factures/$id" params={{ id: l.factureId }} className="text-primary underline">Validée · Voir la facture</Link> : <Button type="button" size="sm" disabled={!!busy || chargementErreur || sauvegardeErreur || !!erreurValidationCommande(l, lignes, atts)} onClick={() => void valider(l.id)}><CheckCircle2 /> Valider et facturer</Button>}
                  {l.erreur && <span className="text-destructive">{l.erreur}</span>}
                  <Button type="button" variant="ghost" size="sm" disabled={!!busy} className="ml-auto" onClick={() => void retirerLigne(l)}>Retirer</Button>
                </div>
              );
            })}
          </section>
        )}

        {lignes.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <Button disabled={!!busy || chargementErreur || sauvegardeErreur || !aTraiter} onClick={() => void valider()}><CheckCircle2 /> Valider et facturer tout ({aTraiter})</Button>
            <Button variant="outline" disabled={!!busy || !prets} onClick={() => void telecharger()}><Download /> Télécharger le dossier ({prets})</Button>
          </div>
        )}
      </div>
    </ProShell>
  );
}
