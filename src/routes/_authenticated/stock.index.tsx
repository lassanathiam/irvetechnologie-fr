import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertTriangle, Camera, Image as ImageIcon, Loader2, Minus, Package, Plus, Trash2, X } from "lucide-react";
import { ProShell } from "@/components/ProShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { compressImage } from "@/lib/image-compress";
import {
  ajouterSortie,
  enregistrerBon,
  lierChantiersBon,
  lireBonCommande,
  listStock,
  supprimerBon,
  supprimerSortie,
  urlPhotoBon,
} from "@/lib/stock.functions";

export const Route = createFileRoute("/_authenticated/stock/")({
  head: () => ({
    meta: [
      { title: "Stock matériel — Espace pro IRVE Technologie" },
      { name: "description", content: "Bons de commande lus par photo, matériel réparti par chantier et sorties terrain." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: StockPage,
});

type Data = Awaited<ReturnType<typeof listStock>>;
type Bon = Data["bons"][number];
type Chantier = Data["chantiers"][number];
type LigneForm = { article: string; reference: string; unite: string; quantite: string; prix: string; rendezvous_id: string };

const n = (v: string) => {
  const x = Number(v.replace(",", "."));
  return Number.isFinite(x) ? x : 0;
};
const fmt = (v: number) => v.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);
const nomChantier = (c: Chantier | undefined) =>
  c ? `${c.client_nom}${c.cp_ville ? ` · ${c.cp_ville}` : ""} · ${new Date(c.date_debut).toLocaleDateString("fr-FR")}` : "Chantier";

function StockPage() {
  const qc = useQueryClient();
  const charger = useServerFn(listStock);
  const q = useQuery({ queryKey: ["stock"], queryFn: () => charger() });
  const [nouveau, setNouveau] = useState(false);
  const [filtre, setFiltre] = useState("tous");
  const refresh = () => qc.invalidateQueries({ queryKey: ["stock"] });

  const bons = q.data?.bons ?? [];
  const chantiers = q.data?.chantiers ?? [];
  const donneurs = useMemo(() => [...new Set(bons.map((b) => b.donneur_ordre))].sort(), [bons]);

  const resume = useMemo(() => {
    const map = new Map<string, { bons: number; articles: number; reste: number }>();
    for (const b of bons) {
      const r = map.get(b.donneur_ordre) ?? { bons: 0, articles: 0, reste: 0 };
      r.bons++;
      for (const l of b.stock_lignes) {
        const reste = Number(l.quantite) - l.stock_sorties.reduce((s, x) => s + Number(x.quantite), 0);
        if (reste > 0) r.articles++;
        r.reste += reste > 0 ? 1 : 0;
      }
      map.set(b.donneur_ordre, r);
    }
    return [...map.entries()];
  }, [bons]);

  const visibles = filtre === "tous" ? bons : bons.filter((b) => b.donneur_ordre === filtre);

  return (
    <ProShell>
      <div className="mx-auto w-full max-w-5xl space-y-5 px-3 py-5 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h1 className="flex items-center gap-2 text-xl font-bold">
              <Package className="h-5 w-5 text-primary" /> Stock matériel
            </h1>
            <p className="text-sm text-muted-foreground">Photo du bon de commande → matériel réparti sur les chantiers → sorties terrain.</p>
          </div>
          {!nouveau && (
            <Button onClick={() => setNouveau(true)}>
              <Camera className="mr-2 h-4 w-4" /> Nouveau bon
            </Button>
          )}
        </header>

        {nouveau && (
          <NouveauBon
            chantiers={chantiers}
            donneurs={donneurs}
            onClose={() => setNouveau(false)}
            onSaved={() => {
              setNouveau(false);
              void refresh();
            }}
          />
        )}

        {resume.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {resume.map(([d, r]) => (
              <button
                key={d}
                type="button"
                onClick={() => setFiltre(filtre === d ? "tous" : d)}
                className={`rounded-xl border bg-card p-4 text-left transition ${filtre === d ? "border-primary ring-1 ring-primary" : "border-border"}`}
              >
                <p className="font-semibold">{d}</p>
                <p className="text-xs text-muted-foreground">
                  {r.bons} bon{r.bons > 1 ? "s" : ""} · {r.articles} article{r.articles > 1 ? "s" : ""} encore en stock
                </p>
              </button>
            ))}
          </div>
        )}

        {q.isLoading && <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />}
        {q.error && <p className="text-sm text-destructive">{(q.error as Error).message}</p>}
        {!q.isLoading && bons.length === 0 && !nouveau && (
          <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Aucun bon de commande. Prenez en photo votre premier bon pour démarrer le stock.
          </p>
        )}

        <div className="space-y-4">
          {visibles.map((b) => (
            <BonCard key={b.id} bon={b} chantiers={chantiers} onChange={refresh} />
          ))}
        </div>
      </div>
    </ProShell>
  );
}

function ChoixChantiers({ chantiers, value, onChange }: { chantiers: Chantier[]; value: string[]; onChange: (v: string[]) => void }) {
  const [rech, setRech] = useState("");
  const liste = chantiers
    .filter((c) => !rech || `${c.client_nom} ${c.cp_ville ?? ""} ${c.partenaire ?? ""}`.toLowerCase().includes(rech.toLowerCase()))
    .slice(0, 60);
  return (
    <div className="space-y-2">
      <Input value={rech} onChange={(e) => setRech(e.target.value)} placeholder="Rechercher un chantier (client, ville, partenaire)" />
      <div className="max-h-52 space-y-1 overflow-y-auto rounded-md border border-border p-2">
        {liste.map((c) => (
          <label key={c.id} className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-sm hover:bg-muted">
            <input
              type="checkbox"
              className="mt-1"
              checked={value.includes(c.id)}
              onChange={(e) => onChange(e.target.checked ? [...value, c.id] : value.filter((x) => x !== c.id))}
            />
            <span className="min-w-0 break-words">
              {nomChantier(c)}
              {c.partenaire ? <span className="text-muted-foreground"> · {c.partenaire}</span> : null}
            </span>
          </label>
        ))}
        {liste.length === 0 && <p className="text-xs text-muted-foreground">Aucun chantier.</p>}
      </div>
      <p className="text-xs text-muted-foreground">{value.length} chantier(s) sélectionné(s)</p>
    </div>
  );
}

function NouveauBon({
  chantiers,
  donneurs,
  onClose,
  onSaved,
}: {
  chantiers: Chantier[];
  donneurs: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const lire = useServerFn(lireBonCommande);
  const save = useServerFn(enregistrerBon);
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [lecture, setLecture] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [donneur, setDonneur] = useState("");
  const [numero, setNumero] = useState("");
  const [date, setDate] = useState(today());
  const [notes, setNotes] = useState("");
  const [sel, setSel] = useState<string[]>([]);
  const [lignes, setLignes] = useState<LigneForm[]>([]);

  async function onFile(f: File) {
    setErr(null);
    setLecture(true);
    try {
      const url =
        f.type === "application/pdf"
          ? await new Promise<string>((res, rej) => {
              const r = new FileReader();
              r.onload = () => res(String(r.result));
              r.onerror = () => rej(new Error("Fichier illisible"));
              r.readAsDataURL(f);
            })
          : await compressImage(f, 2000, 0.8);
      setDataUrl(url);
      const bon = await lire({ data: { data_url: url } });
      if (bon.donneur_ordre && !donneur) setDonneur(bon.donneur_ordre);
      if (bon.numero) setNumero(bon.numero);
      if (bon.date_bon) setDate(bon.date_bon);
      setLignes(
        bon.lignes.map((l) => ({
          article: l.article,
          reference: l.reference ?? "",
          unite: l.unite,
          quantite: String(l.quantite),
          prix: l.prix_unitaire == null ? "" : String(l.prix_unitaire),
          rendezvous_id: "",
        })),
      );
      if (!bon.lignes.length) setErr("Aucun article reconnu : ajoutez-les à la main.");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Lecture impossible.");
    } finally {
      setLecture(false);
    }
  }

  const maj = (i: number, p: Partial<LigneForm>) => setLignes((ls) => ls.map((l, j) => (j === i ? { ...l, ...p } : l)));
  const chantiersSel = chantiers.filter((c) => sel.includes(c.id));

  async function enregistrer() {
    setErr(null);
    const ok = lignes.filter((l) => l.article.trim());
    if (!donneur.trim()) return setErr("Indiquez le donneur d'ordre (NCO, Charge Expert…).");
    if (!ok.length) return setErr("Ajoutez au moins un article.");
    setBusy(true);
    try {
      await save({
        data: {
          donneur_ordre: donneur.trim(),
          numero: numero.trim() || null,
          date_bon: date,
          notes: notes.trim() || null,
          data_url: dataUrl,
          chantiers: sel,
          lignes: ok.map((l) => ({
            article: l.article.trim(),
            reference: l.reference.trim() || null,
            unite: l.unite.trim() || "u",
            quantite: n(l.quantite),
            prix_unitaire: l.prix.trim() ? n(l.prix) : null,
            rendezvous_id: l.rendezvous_id || null,
          })),
        },
      });
      onSaved();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border border-primary/40 bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Nouveau bon de commande</h2>
        <button type="button" onClick={onClose} aria-label="Fermer">
          <X className="h-5 w-5" />
        </button>
      </div>

      <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border p-6 text-center text-sm">
        {lecture ? (
          <>
            <Loader2 className="h-6 w-6 animate-spin text-primary" /> Lecture du bon en cours…
          </>
        ) : (
          <>
            <Camera className="h-6 w-6 text-primary" />
            {dataUrl ? "Bon lu — reprendre une photo" : "Prendre en photo le bon de commande (ou choisir un PDF)"}
          </>
        )}
        <input
          type="file"
          accept="image/*,application/pdf"
          capture="environment"
          className="hidden"
          disabled={lecture}
          onChange={(e) => e.target.files?.[0] && void onFile(e.target.files[0])}
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="text-xs text-muted-foreground">Donneur d'ordre</label>
          <Input list="donneurs-stock" value={donneur} onChange={(e) => setDonneur(e.target.value)} placeholder="NCO, Charge Expert…" />
          <datalist id="donneurs-stock">
            {donneurs.map((d) => (
              <option key={d} value={d} />
            ))}
          </datalist>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">N° du bon</label>
          <Input value={numero} onChange={(e) => setNumero(e.target.value)} />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Date</label>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>

      <div>
        <p className="mb-1 text-sm font-medium">Chantiers concernés par ce bon</p>
        <ChoixChantiers chantiers={chantiers} value={sel} onChange={setSel} />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Articles ({lignes.length})</p>
        {lignes.map((l, i) => (
          <div key={i} className="grid grid-cols-2 gap-2 rounded-lg border border-border p-2 sm:grid-cols-12">
            <Input className="col-span-2 sm:col-span-4" value={l.article} onChange={(e) => maj(i, { article: e.target.value })} placeholder="Article" />
            <Input className="sm:col-span-2" value={l.reference} onChange={(e) => maj(i, { reference: e.target.value })} placeholder="Réf." />
            <Input className="sm:col-span-1" value={l.quantite} inputMode="decimal" onChange={(e) => maj(i, { quantite: e.target.value })} placeholder="Qté" />
            <Input className="sm:col-span-1" value={l.unite} onChange={(e) => maj(i, { unite: e.target.value })} placeholder="u/m" />
            <Input className="sm:col-span-1" value={l.prix} inputMode="decimal" onChange={(e) => maj(i, { prix: e.target.value })} placeholder="€ HT" />
            <select
              className="col-span-2 rounded-md border border-input bg-background px-2 py-2 text-sm sm:col-span-2"
              value={l.rendezvous_id}
              onChange={(e) => maj(i, { rendezvous_id: e.target.value })}
            >
              <option value="">Lot partagé</option>
              {chantiersSel.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.client_nom}
                </option>
              ))}
            </select>
            <button type="button" className="justify-self-end text-destructive" onClick={() => setLignes((ls) => ls.filter((_, j) => j !== i))} aria-label="Retirer">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setLignes((ls) => [...ls, { article: "", reference: "", unite: "u", quantite: "1", prix: "", rendezvous_id: "" }])}
        >
          <Plus className="mr-1 h-4 w-4" /> Ajouter un article
        </Button>
      </div>

      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        rows={2}
        placeholder="Notes (optionnel)"
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
      />

      {err && <p className="text-sm text-destructive">{err}</p>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="outline" onClick={onClose}>
          Annuler
        </Button>
        <Button onClick={() => void enregistrer()} disabled={busy || lecture}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Enregistrer le bon
        </Button>
      </div>
    </section>
  );
}

function BonCard({ bon, chantiers, onChange }: { bon: Bon; chantiers: Chantier[]; onChange: () => void }) {
  const sortir = useServerFn(ajouterSortie);
  const annulerSortie = useServerFn(supprimerSortie);
  const suppr = useServerFn(supprimerBon);
  const lier = useServerFn(lierChantiersBon);
  const photo = useServerFn(urlPhotoBon);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const [qte, setQte] = useState("");
  const [rdv, setRdv] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [editChantiers, setEditChantiers] = useState<string[] | null>(null);

  const byId = new Map(chantiers.map((c) => [c.id, c]));
  const ids = bon.stock_bon_chantiers.map((x) => x.rendezvous_id);
  const lies = ids.map((id) => byId.get(id)).filter(Boolean) as Chantier[];
  const lignes = [...bon.stock_lignes].sort((a, b) => a.ordre - b.ordre);
  const calc = lignes.map((l) => {
    const utilise = l.stock_sorties.reduce((s, x) => s + Number(x.quantite), 0);
    return { l, utilise, reste: Number(l.quantite) - utilise };
  });
  const tousTermines = lies.length > 0 && lies.every((c) => c.termine_at);
  const surplus = calc.filter((c) => c.reste > 0);
  const valeur = lignes.reduce((s, l) => s + (l.prix_unitaire ? Number(l.prix_unitaire) * Number(l.quantite) : 0), 0);

  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      onChange();
      return true;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Action impossible.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <article className="space-y-3 rounded-xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">
            {bon.donneur_ordre} {bon.numero ? <span className="text-muted-foreground">· Bon n° {bon.numero}</span> : null}
          </p>
          <p className="text-xs text-muted-foreground">
            {new Date(bon.date_bon).toLocaleDateString("fr-FR")} · {lignes.length} article(s)
            {valeur > 0 ? ` · ${valeur.toLocaleString("fr-FR", { style: "currency", currency: "EUR" })} HT` : ""}
          </p>
        </div>
        <div className="flex gap-2">
          {bon.photo_path && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => void act(async () => window.open((await photo({ data: { path: bon.photo_path! } })).url, "_blank"))}
            >
              <ImageIcon className="mr-1 h-4 w-4" /> Bon
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="text-destructive"
            onClick={() => confirm("Supprimer ce bon et tout son historique de sorties ?") && void act(() => suppr({ data: { id: bon.id } }))}
            aria-label="Supprimer le bon"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {lies.map((c) => (
          <span key={c.id} className={`rounded-full px-2 py-0.5 text-xs ${c.termine_at ? "bg-primary/15 text-primary" : "bg-muted"}`}>
            {c.client_nom}
            {c.termine_at ? " ✓" : ""}
          </span>
        ))}
        {lies.length === 0 && <span className="text-xs text-muted-foreground">Aucun chantier lié</span>}
        <button type="button" className="text-xs text-primary underline" onClick={() => setEditChantiers(editChantiers ? null : ids)}>
          {editChantiers ? "Fermer" : "Modifier les chantiers"}
        </button>
      </div>
      {editChantiers && (
        <div className="space-y-2">
          <ChoixChantiers chantiers={chantiers} value={editChantiers} onChange={setEditChantiers} />
          <Button
            size="sm"
            disabled={busy}
            onClick={() =>
              void act(() => lier({ data: { bon_id: bon.id, chantiers: editChantiers } })).then((ok) => ok && setEditChantiers(null))
            }
          >
            Enregistrer les chantiers
          </Button>
        </div>
      )}

      {tousTermines && surplus.length > 0 && (
        <p className="flex items-start gap-2 rounded-md bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          Tous les chantiers de ce bon sont terminés mais il reste du matériel : à rendre au donneur d'ordre ou à garder.
        </p>
      )}

      <div className="divide-y divide-border rounded-lg border border-border">
        {calc.map(({ l, utilise, reste }) => {
          const depasse = reste < 0;
          return (
            <div key={l.id} className="space-y-2 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="break-words text-sm font-medium">{l.article}</p>
                  <p className="text-xs text-muted-foreground">
                    {l.reference ? `Réf. ${l.reference} · ` : ""}
                    {l.rendezvous_id ? `Pour ${byId.get(l.rendezvous_id)?.client_nom ?? "chantier"}` : "Lot partagé"}
                  </p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span>Reçu {fmt(Number(l.quantite))} {l.unite}</span>
                  <span>Utilisé {fmt(utilise)}</span>
                  <span className={`rounded px-2 py-0.5 font-semibold ${depasse ? "bg-destructive/15 text-destructive" : reste > 0 ? "bg-primary/15 text-primary" : "bg-muted"}`}>
                    Reste {fmt(reste)}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={reste <= 0}
                    onClick={() => {
                      setOuvert(ouvert === l.id ? null : l.id);
                      setQte("");
                      setRdv(l.rendezvous_id ?? (ids.length === 1 ? ids[0]! : ""));
                    }}
                  >
                    <Minus className="mr-1 h-3 w-3" /> Sortie
                  </Button>
                </div>
              </div>

              {ouvert === l.id && (
                <div className="flex flex-col gap-2 rounded-md bg-muted/50 p-2 sm:flex-row">
                  <select className="flex-1 rounded-md border border-input bg-background px-2 py-2 text-sm" value={rdv} onChange={(e) => setRdv(e.target.value)}>
                    <option value="">Choisir le chantier…</option>
                    {(lies.length ? lies : chantiers).map((c) => (
                      <option key={c.id} value={c.id}>
                        {nomChantier(c)}
                      </option>
                    ))}
                  </select>
                  <Input className="sm:w-28" inputMode="decimal" value={qte} onChange={(e) => setQte(e.target.value)} placeholder={`Qté (${l.unite})`} />
                  <Button
                    size="sm"
                    disabled={busy || !rdv || n(qte) <= 0}
                    onClick={() =>
                      void act(() => sortir({ data: { ligne_id: l.id, rendezvous_id: rdv, quantite: n(qte) } })).then((ok) => ok && setOuvert(null))
                    }
                  >
                    Valider
                  </Button>
                </div>
              )}

              {l.stock_sorties.length > 0 && (
                <ul className="space-y-1 text-xs text-muted-foreground">
                  {l.stock_sorties.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-2">
                      <span className="min-w-0 break-words">
                        − {fmt(Number(s.quantite))} {l.unite} · {byId.get(s.rendezvous_id)?.client_nom ?? "chantier"} ·{" "}
                        {new Date(s.created_at).toLocaleDateString("fr-FR")}
                      </span>
                      <button
                        type="button"
                        className="text-destructive"
                        onClick={() => confirm("Annuler cette sortie ?") && void act(() => annulerSortie({ data: { id: s.id } }))}
                        aria-label="Annuler la sortie"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
      {err && <p className="text-sm text-destructive">{err}</p>}
    </article>
  );
}
