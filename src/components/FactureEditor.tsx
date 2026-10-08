import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useMutation } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Loader2, Plus, Trash2 } from "lucide-react";
import { deplacer } from "@/lib/reorder";
import { createFactureDirecte, listChantiersAFacturer, updateFactureComplete } from "@/lib/factures.functions";
import { listClientsEnregistres } from "@/lib/clients.functions";
import { useEffect } from "react";
import { listBordereau } from "@/lib/bordereau.functions";
import { useQuery } from "@tanstack/react-query";
import { ClientPicker, mentionsClient } from "@/components/ClientPicker";
import { computeTotals } from "@/lib/billing";

type Item = { libelle: string; description: string | null; quantite: number; prix_unitaire: number; tva: number };
type Facture = {
  id: string; client_nom: string; client_email: string | null; client_telephone: string | null;
  client_adresse: string | null; client_cp_ville: string | null; objet: string | null;
  remise_pct: number; conditions_paiement: string | null; notes: string | null; autoliquidation: boolean;
};

const inp = "mt-1 w-full bg-input border border-border rounded-sm px-3 py-2 text-sm";
const eur = (n: number) => n.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });

export function FactureEditor({ facture, items, onDone, onCreated, rdvInitiaux = [] }: { facture: Facture; items: Item[]; onDone: () => void; onCreated?: (id: string) => void; rdvInitiaux?: string[] }) {
  const saveFn = useServerFn(updateFactureComplete);
  const createFn = useServerFn(createFactureDirecte);
  const bpuFn = useServerFn(listBordereau);
  const creation = !facture.id;
  const bpu = useQuery({ queryKey: ["bordereau"], queryFn: () => bpuFn() });
  const [delai, setDelai] = useState(30);
  const chantiersFn = useServerFn(listChantiersAFacturer);
  const clientsFn = useServerFn(listClientsEnregistres);
  const chantiers = useQuery({ queryKey: ["chantiers-a-facturer"], queryFn: () => chantiersFn(), enabled: creation });
  const clientsQ = useQuery({ queryKey: ["clients-enregistres"], queryFn: () => clientsFn(), enabled: creation });
  const [rdvIds, setRdvIds] = useState<string[]>([]);
  const [initFait, setInitFait] = useState(false);
  const [f, setF] = useState({
    client_nom: facture.client_nom, client_email: facture.client_email ?? "", client_telephone: facture.client_telephone ?? "",
    client_adresse: facture.client_adresse ?? "", client_cp_ville: facture.client_cp_ville ?? "", objet: facture.objet ?? "",
    remise_pct: Number(facture.remise_pct) || 0, conditions_paiement: facture.conditions_paiement ?? "",
    notes: facture.notes ?? "", autoliquidation: facture.autoliquidation,
  });
  const [lignes, setLignes] = useState<Item[]>(
    items.map((i) => ({ libelle: i.libelle, description: i.description, quantite: Number(i.quantite), prix_unitaire: Number(i.prix_unitaire), tva: Number(i.tva) })),
  );
  const totals = computeTotals(f.autoliquidation ? lignes.map((l) => ({ ...l, tva: 0 })) : lignes, f.remise_pct);
  const save = useMutation({
    mutationFn: async () => {
      if (creation) {
        const r = await createFn({ data: { ...f, delai_jours: delai, rdv_ids: rdvIds, items: lignes } });
        onCreated?.(r.id);
      } else {
        await saveFn({ data: { id: facture.id, ...f, items: lignes } });
        onDone();
      }
    },
  });
  const setL = (i: number, patch: Partial<Item>) => setLignes((ls) => ls.map((l, k) => (k === i ? { ...l, ...patch } : l)));
  type Ch = NonNullable<typeof chantiers.data>[number];
  const ligneChantier = (c: Ch): Item => {
    const inclus = Number(c.metrage_inclus_m ?? 0);
    const reel = c.metrage_reel_m == null ? null : Number(c.metrage_reel_m);
    return {
      libelle: c.designation || c.titre || "Installation borne de recharge",
      description: [c.client_nom && `Client final : ${c.client_nom}`, [c.adresse, c.cp_ville].filter(Boolean).join(", "),
        c.puissance_borne && `Borne ${c.puissance_borne}`, reel != null && `Câble ${reel} m${inclus ? ` (forfait ${inclus} m)` : ""}`,
        c.termine_at && `Terminé le ${new Date(c.termine_at).toLocaleDateString("fr-FR")}`].filter(Boolean).join(" · "),
      quantite: 1, prix_unitaire: Number(c.montant_ht ?? 0), tva: f.autoliquidation ? 0 : Number(c.tva_pct ?? 20),
    };
  };
  const remplirClient = (c: NonNullable<typeof clientsQ.data>[number]) => {
    const m = mentionsClient(c);
    setF((x) => ({ ...x, client_nom: c.nom, client_email: c.email ?? "", client_telephone: c.telephone ?? "",
      client_adresse: c.adresse ?? "", client_cp_ville: c.cp_ville ?? "", autoliquidation: c.autoliquidation || x.autoliquidation,
      notes: m && !x.notes.includes(m) ? (x.notes ? `${x.notes}\n${m}` : m) : x.notes }));
    if (c.delai_paiement_jours != null) setDelai(c.delai_paiement_jours);
  };
  const basculerChantier = (c: Ch, on: boolean) => {
    const marque = `Chantier réf. ${c.id.slice(0, 8)}`;
    if (on) {
      setRdvIds((ids) => [...ids, c.id]);
      const l = { ...ligneChantier(c), description: `${ligneChantier(c).description} · ${marque}` };
      setLignes((ls) => (ls.length === 1 && !ls[0].libelle.trim() ? [l] : [...ls, l]));
      if (!f.client_nom.trim() && clientsQ.data) {
        const norm = (x: string | null) => (x ?? "").normalize("NFD").replace(/[^a-zA-Z0-9]/g, "").toLowerCase();
        const cl = clientsQ.data.find((k) => k.cle === `p-${c.partenaire_id}`) ??
          (c.partenaire ? clientsQ.data.find((k) => norm(k.nom) === norm(c.partenaire) || (norm(k.nom).slice(0, 6) === norm(c.partenaire).slice(0, 6) && norm(k.nom).length > 5)) : undefined);
        if (cl) remplirClient(cl);
      }
    } else {
      setRdvIds((ids) => ids.filter((x) => x !== c.id));
      setLignes((ls) => { const r = ls.filter((l) => !(l.description ?? "").includes(marque)); return r.length ? r : [{ libelle: "", description: null, quantite: 1, prix_unitaire: 0, tva: 20 }]; });
    }
  };
  useEffect(() => {
    if (initFait || !creation || !chantiers.data || !clientsQ.data) return;
    setInitFait(true);
    chantiers.data.filter((c) => rdvInitiaux.includes(c.id)).forEach((c) => basculerChantier(c, true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chantiers.data, clientsQ.data]);
  const champ = (key: keyof typeof f, label: string) => (
    <label className="block text-xs text-muted-foreground">{label}
      <input className={inp} value={String(f[key])} onChange={(e) => setF({ ...f, [key]: e.target.value })} />
    </label>
  );

  return (
    <div className="border border-primary rounded-sm bg-card p-6 space-y-5">
      <h2 className="text-mono text-[11px] uppercase tracking-[0.2em] text-primary">{creation ? "Nouvelle facture" : "Modifier la facture"}</h2>
      <ClientPicker onPick={remplirClient} />
      {creation && (
        <details open={rdvInitiaux.length > 0} className="border border-border rounded-sm p-3">
          <summary className="cursor-pointer text-sm font-medium">
            Chantiers terminés à facturer ({chantiers.data?.length ?? 0}) — cochez-en un ou plusieurs (ex. la semaine)
          </summary>
          <div className="mt-3 max-h-72 overflow-y-auto divide-y divide-border">
            {(chantiers.data ?? []).map((c) => (
              <label key={c.id} className="flex items-start gap-3 py-2 text-sm cursor-pointer">
                <input type="checkbox" className="mt-1" checked={rdvIds.includes(c.id)} onChange={(e) => basculerChantier(c, e.target.checked)} />
                <span className="flex-1 min-w-0">
                  <span className="font-medium">{c.client_nom}</span>
                  <span className="text-muted-foreground"> · {c.partenaire || "direct"} · {c.termine_at ? new Date(c.termine_at).toLocaleDateString("fr-FR") : ""}</span>
                  <span className="block text-xs text-muted-foreground truncate">{[c.adresse, c.cp_ville].filter(Boolean).join(", ")}</span>
                </span>
                <span className="text-mono text-xs">{eur(Number(c.montant_ht ?? 0))}</span>
              </label>
            ))}
            {chantiers.data?.length === 0 && <p className="py-2 text-xs text-muted-foreground">Aucun chantier terminé en attente.</p>}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Les chantiers cochés passeront en « Facturé » et seront archivés à la création.</p>
        </details>
      )}
      <div className="grid sm:grid-cols-2 gap-3">
        {champ("client_nom", "Client")}{champ("client_email", "Email")}
        {champ("client_telephone", "Téléphone")}{champ("client_adresse", "Adresse")}
        {champ("client_cp_ville", "CP / Ville")}{champ("objet", "Objet")}
      </div>
      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">Lignes</div>
        {lignes.map((l, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-end border-b border-border pb-2">
            <label className="col-span-12 sm:col-span-5 text-xs text-muted-foreground">Désignation
              <input className={inp} value={l.libelle} onChange={(e) => setL(i, { libelle: e.target.value })} />
            </label>
            <label className="col-span-4 sm:col-span-2 text-xs text-muted-foreground">Qté
              <input type="number" step="any" className={inp} value={l.quantite} onChange={(e) => setL(i, { quantite: Number(e.target.value) })} />
            </label>
            <label className="col-span-4 sm:col-span-2 text-xs text-muted-foreground">PU HT
              <input type="number" step="any" className={inp} value={l.prix_unitaire} onChange={(e) => setL(i, { prix_unitaire: Number(e.target.value) })} />
            </label>
            <label className="col-span-3 sm:col-span-2 text-xs text-muted-foreground">TVA %
              <input type="number" step="any" className={inp} value={l.tva} disabled={f.autoliquidation} onChange={(e) => setL(i, { tva: Number(e.target.value) })} />
            </label>
            <div className="col-span-1 flex flex-col items-center">
              <button type="button" aria-label="Monter la ligne" disabled={i === 0} onClick={() => setLignes((ls) => deplacer(ls, i, -1))} className="p-0.5 disabled:opacity-30"><ChevronUp className="h-4 w-4" /></button>
              <button type="button" aria-label="Descendre la ligne" disabled={i === lignes.length - 1} onClick={() => setLignes((ls) => deplacer(ls, i, 1))} className="p-0.5 disabled:opacity-30"><ChevronDown className="h-4 w-4" /></button>
              <button type="button" aria-label="Supprimer la ligne" onClick={() => setLignes(lignes.filter((_, k) => k !== i))}
                className="p-0.5 text-destructive disabled:opacity-30" disabled={lignes.length <= 1}>
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
            <label className="col-span-12 text-xs text-muted-foreground">Description (facultatif)
              <input className={inp} value={l.description ?? ""} onChange={(e) => setL(i, { description: e.target.value })} />
            </label>
          </div>
        ))}
        <button type="button" onClick={() => setLignes([...lignes, { libelle: "", description: null, quantite: 1, prix_unitaire: 0, tva: 20 }])}
          className="border border-border rounded-sm px-3 py-2 text-mono text-xs inline-flex items-center gap-1.5 hover:border-primary hover:text-primary">
          <Plus className="h-3.5 w-3.5" /> Ajouter une ligne
        </button>
        {(bpu.data?.length ?? 0) > 0 && (
          <select className={inp} value="" onChange={(e) => {
            const b = bpu.data?.find((x) => x.id === e.target.value);
            if (!b) return;
            const l: Item = { libelle: [b.reference, b.libelle].filter(Boolean).join(" — "), description: null, quantite: 1, prix_unitaire: Number(b.prix_unitaire), tva: f.autoliquidation ? 0 : 20 };
            setLignes((ls) => (ls.length === 1 && !ls[0].libelle.trim() ? [l] : [...ls, l]));
          }}>
            <option value="">+ Ajouter une prestation du bordereau (BPU)…</option>
            {bpu.data?.filter((b) => b.actif).map((b) => (
              <option key={b.id} value={b.id}>{b.donneur_ordre.toUpperCase()} · {b.reference ? `${b.reference} · ` : ""}{b.libelle} · {Number(b.prix_unitaire)} € / {b.unite}</option>
            ))}
          </select>
        )}
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block text-xs text-muted-foreground">Remise %
          <input type="number" min={0} max={100} className={inp} value={f.remise_pct} onChange={(e) => setF({ ...f, remise_pct: Number(e.target.value) })} />
        </label>
        <label className="flex items-center gap-2 text-sm mt-5">
          <input type="checkbox" checked={f.autoliquidation} onChange={(e) => setF({ ...f, autoliquidation: e.target.checked })} />
          Autoliquidation (TVA à 0)
        </label>
      </div>
      {creation && (
        <label className="block text-xs text-muted-foreground">Délai de paiement (jours)
          <input type="number" min={0} className={inp} value={delai} onChange={(e) => setDelai(Number(e.target.value))} />
        </label>
      )}
      <label className="block text-xs text-muted-foreground">Conditions de paiement
        <textarea rows={2} className={inp} value={f.conditions_paiement} onChange={(e) => setF({ ...f, conditions_paiement: e.target.value })} />
      </label>
      <label className="block text-xs text-muted-foreground">Notes
        <textarea rows={2} className={inp} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} />
      </label>
      <div className="text-mono text-sm">Total HT {eur(totals.total_ht)} · TVA {eur(totals.total_tva)} · <b>TTC {eur(totals.total_ttc)}</b></div>
      {save.isError && <p className="text-xs text-destructive">{save.error instanceof Error ? save.error.message : "Erreur"}</p>}
      <div className="flex gap-3">
        <button type="button" disabled={save.isPending || !f.client_nom.trim() || lignes.some((l) => !l.libelle.trim())}
          onClick={() => save.mutate()}
          className="hero-grad text-primary-foreground text-mono text-xs px-5 py-3 rounded-sm inline-flex items-center gap-2 disabled:opacity-50">
          {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />} {creation ? "Créer la facture" : "Enregistrer les modifications"}
        </button>
        <button type="button" onClick={onDone} className="border border-border rounded-sm px-4 py-2 text-mono text-xs">Annuler</button>
      </div>
    </div>
  );
}
