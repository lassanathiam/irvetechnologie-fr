import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Save, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import {
  enregistrerAchatCatalogue,
  enregistrerForfaitsCatalogue,
  enregistrerProduitCatalogue,
  lienJustificatifAchat,
  supprimerProduitCatalogue,
  type ProduitCatalogue,
} from "@/lib/catalogue-commercial.functions";
import { PALIERS_CABLE_M } from "@/lib/tarification";
import { lireNombre, versChamp } from "./outils";

const CHAMP = "grid gap-1.5";
const LIB = "text-xs font-semibold text-muted-foreground";
const SELECT = "h-9 rounded-md border border-input bg-background px-3 text-sm";

type TroisEtats = "" | "oui" | "non";
const versEtat = (v: boolean | null | undefined): TroisEtats => (v == null ? "" : v ? "oui" : "non");
const depuisEtat = (v: TroisEtats) => (v === "" ? null : v === "oui");

export function FicheProduitEditeur({
  produit,
  onFerme,
  onEnregistre,
}: {
  produit: ProduitCatalogue | null;
  onFerme: () => void;
  onEnregistre: () => void;
}) {
  const sauverProduit = useServerFn(enregistrerProduitCatalogue);
  const sauverAchat = useServerFn(enregistrerAchatCatalogue);
  const sauverForfaits = useServerFn(enregistrerForfaitsCatalogue);
  const supprimer = useServerFn(supprimerProduitCatalogue);
  const lienJustif = useServerFn(lienJustificatifAchat);

  const p = produit;
  const a = p?.achat ?? null;
  const [f, setF] = useState({
    marque: p?.marque ?? "",
    nom_commercial: p?.nom_commercial ?? "",
    reference_constructeur: p?.reference_constructeur ?? "",
    sku: p?.sku ?? "",
    reference_verifiee: p?.reference_verifiee ?? false,
    puissance_kw: versChamp(p?.puissance_kw ?? 7.4),
    phase: p?.phase ?? "mono",
    nb_phases: String(p?.nb_phases ?? 1),
    connecteur: p?.connecteur ?? "prise_t2",
    connectivite: (p?.connectivite ?? []).join(", "),
    gestion_dynamique: versEtat(p?.gestion_dynamique),
    compatible_tic: versEtat(p?.compatible_tic),
    rfid: versEtat(p?.rfid),
    mid: versEtat(p?.mid),
    autres_fonctions: p?.autres_fonctions ?? "",
    garantie_ans: versChamp(p?.garantie_ans),
    fiche_technique_url: p?.fiche_technique_url ?? "",
    site_officiel_url: p?.site_officiel_url ?? "",
    photos: p?.photos ?? [],
    prix_public_ttc: versChamp(p?.prix_public_ttc),
    notes: p?.notes ?? "",
    actif: p?.actif ?? true,
    ordre: String(p?.ordre ?? 100),
  });
  const [achat, setAchat] = useState({
    fournisseur: a?.fournisseur ?? "",
    reference_fournisseur: a?.reference_fournisseur ?? "",
    prix_achat_ht: versChamp(a?.prix_achat_ht),
    tva_achat_pct: versChamp(a?.tva_achat_pct ?? 20),
    remise_pct: versChamp(a?.remise_pct ?? 0),
    frais_livraison_ht: versChamp(a?.frais_livraison_ht ?? 0),
    disponibilite: a?.disponibilite ?? "",
    justificatif_path: a?.justificatif_path ?? "",
    actualise_le: a?.actualise_le ?? "",
  });
  const [forfaits, setForfaits] = useState<Record<number, string>>(
    Object.fromEntries(PALIERS_CABLE_M.map((m) => [m, versChamp(p?.forfaits[m])])),
  );
  const [occupe, setOccupe] = useState(false);
  const [envoi, setEnvoi] = useState(false);

  const set = (k: keyof typeof f, v: unknown) => setF((x) => ({ ...x, [k]: v }));
  const achatHt = lireNombre(achat.prix_achat_ht);
  const achatTtc = achatHt != null ? achatHt * (1 + (lireNombre(achat.tva_achat_pct) ?? 20) / 100) : null;

  async function envoyerPhoto(fichier: File) {
    setEnvoi(true);
    try {
      const ext = fichier.name.split(".").pop()?.toLowerCase() || "jpg";
      const chemin = `catalogue-commercial/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const { error } = await supabase.storage.from("borne-photos").upload(chemin, fichier);
      if (error) throw error;
      setF((x) => ({ ...x, photos: [...x.photos, chemin] }));
      toast.success("Photo ajoutée — enregistrez la fiche.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Envoi de la photo impossible.");
    } finally {
      setEnvoi(false);
    }
  }

  async function envoyerJustificatif(fichier: File) {
    setEnvoi(true);
    try {
      const ext = fichier.name.split(".").pop()?.toLowerCase() || "pdf";
      const chemin = `${p?.id ?? "nouveau"}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("achats-fournisseurs").upload(chemin, fichier);
      if (error) throw error;
      setAchat((x) => ({ ...x, justificatif_path: chemin }));
      toast.success("Justificatif ajouté — enregistrez la fiche.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Envoi impossible.");
    } finally {
      setEnvoi(false);
    }
  }

  async function enregistrer() {
    if (!f.marque.trim() || !f.nom_commercial.trim()) {
      toast.error("Marque et nom commercial obligatoires.");
      return;
    }
    setOccupe(true);
    try {
      const { id } = await sauverProduit({
        data: {
          id: p?.id,
          marque: f.marque,
          nom_commercial: f.nom_commercial,
          reference_constructeur: f.reference_constructeur || null,
          sku: f.sku || null,
          reference_verifiee: f.reference_verifiee,
          puissance_kw: lireNombre(f.puissance_kw) ?? 7.4,
          phase: f.phase,
          nb_phases: Number(f.nb_phases) || 1,
          connecteur: f.connecteur,
          connectivite: f.connectivite.split(",").map((s) => s.trim()).filter(Boolean),
          gestion_dynamique: depuisEtat(f.gestion_dynamique),
          compatible_tic: depuisEtat(f.compatible_tic),
          rfid: depuisEtat(f.rfid),
          mid: depuisEtat(f.mid),
          autres_fonctions: f.autres_fonctions || null,
          garantie_ans: lireNombre(f.garantie_ans),
          fiche_technique_url: f.fiche_technique_url || null,
          site_officiel_url: f.site_officiel_url || null,
          photos: f.photos,
          prix_public_ttc: lireNombre(f.prix_public_ttc),
          notes: f.notes || null,
          actif: f.actif,
          ordre: Number(f.ordre) || 100,
        },
      } as never);
      await sauverAchat({
        data: {
          produit_id: id,
          fournisseur: achat.fournisseur || null,
          reference_fournisseur: achat.reference_fournisseur || null,
          prix_achat_ht: achatHt,
          tva_achat_pct: lireNombre(achat.tva_achat_pct) ?? 20,
          remise_pct: lireNombre(achat.remise_pct) ?? 0,
          frais_livraison_ht: lireNombre(achat.frais_livraison_ht) ?? 0,
          disponibilite: achat.disponibilite || null,
          justificatif_path: achat.justificatif_path || null,
          actualise_le: achat.actualise_le || null,
        },
      } as never);
      await sauverForfaits({
        data: {
          produit_id: id,
          forfaits: { 5: lireNombre(forfaits[5]), 10: lireNombre(forfaits[10]), 15: lireNombre(forfaits[15]), 20: lireNombre(forfaits[20]) },
        },
      } as never);
      toast.success("Fiche enregistrée.");
      onEnregistre();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Enregistrement impossible.");
    } finally {
      setOccupe(false);
    }
  }

  const etat = (k: "gestion_dynamique" | "compatible_tic" | "rfid" | "mid", label: string) => (
    <label className={CHAMP}>
      <span className={LIB}>{label}</span>
      <select className={SELECT} value={f[k]} onChange={(e) => set(k, e.target.value)}>
        <option value="">À vérifier</option>
        <option value="oui">Oui</option>
        <option value="non">Non</option>
      </select>
    </label>
  );

  return (
    <div className="space-y-5 rounded-lg border border-primary/40 bg-card p-4 sm:p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">{p ? `Modifier — ${p.marque} ${p.nom_commercial}` : "Nouvelle borne"}</h2>
        <Button variant="ghost" size="icon" onClick={onFerme} aria-label="Fermer">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-bold">Fiche produit</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={CHAMP}><span className={LIB}>Fabricant *</span><Input value={f.marque} onChange={(e) => set("marque", e.target.value)} /></label>
          <label className={CHAMP}><span className={LIB}>Nom commercial exact *</span><Input value={f.nom_commercial} onChange={(e) => set("nom_commercial", e.target.value)} /></label>
          <label className={CHAMP}><span className={LIB}>Référence constructeur</span><Input value={f.reference_constructeur} onChange={(e) => set("reference_constructeur", e.target.value)} /></label>
          <label className={CHAMP}><span className={LIB}>Code produit / SKU</span><Input value={f.sku} onChange={(e) => set("sku", e.target.value)} /></label>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" className="h-4 w-4" checked={f.reference_verifiee} onChange={(e) => set("reference_verifiee", e.target.checked)} />
            Référence vérifiée sur le site officiel du fabricant
          </label>
          <label className={CHAMP}><span className={LIB}>Puissance (kW)</span><Input inputMode="decimal" value={f.puissance_kw} onChange={(e) => set("puissance_kw", e.target.value)} /></label>
          <label className={CHAMP}>
            <span className={LIB}>Alimentation</span>
            <select className={SELECT} value={f.phase} onChange={(e) => set("phase", e.target.value)}>
              <option value="mono">Monophasé</option>
              <option value="tri">Triphasé</option>
              <option value="mono_tri">Mono ou triphasé</option>
            </select>
          </label>
          <label className={CHAMP}><span className={LIB}>Nombre de phases compatibles</span><Input inputMode="numeric" value={f.nb_phases} onChange={(e) => set("nb_phases", e.target.value)} /></label>
          <label className={CHAMP}>
            <span className={LIB}>Connecteur</span>
            <select className={SELECT} value={f.connecteur} onChange={(e) => set("connecteur", e.target.value)}>
              <option value="prise_t2">Prise Type 2</option>
              <option value="cable">Câble attaché</option>
            </select>
          </label>
          <label className={`${CHAMP} sm:col-span-2`}><span className={LIB}>Connectivité (séparée par des virgules : Wi-Fi, Ethernet, Bluetooth, 4G)</span><Input value={f.connectivite} onChange={(e) => set("connectivite", e.target.value)} /></label>
          {etat("gestion_dynamique", "Gestion dynamique de puissance")}
          {etat("compatible_tic", "Compatible Linky / TIC")}
          {etat("rfid", "RFID")}
          {etat("mid", "Compteur MID")}
          <label className={CHAMP}><span className={LIB}>Garantie constructeur (années)</span><Input inputMode="decimal" value={f.garantie_ans} onChange={(e) => set("garantie_ans", e.target.value)} placeholder="À vérifier" /></label>
          <label className={CHAMP}><span className={LIB}>Prix public TTC (borne seule, indicatif)</span><Input inputMode="decimal" value={f.prix_public_ttc} onChange={(e) => set("prix_public_ttc", e.target.value)} /></label>
          <label className={`${CHAMP} sm:col-span-2`}><span className={LIB}>Autres fonctionnalités</span><Input value={f.autres_fonctions} onChange={(e) => set("autres_fonctions", e.target.value)} /></label>
          <label className={CHAMP}><span className={LIB}>Fiche technique officielle (lien)</span><Input value={f.fiche_technique_url} onChange={(e) => set("fiche_technique_url", e.target.value)} placeholder="https://" /></label>
          <label className={CHAMP}><span className={LIB}>Site officiel du fabricant</span><Input value={f.site_officiel_url} onChange={(e) => set("site_officiel_url", e.target.value)} placeholder="https://" /></label>
          <label className={`${CHAMP} sm:col-span-2`}><span className={LIB}>Notes internes</span><Input value={f.notes} onChange={(e) => set("notes", e.target.value)} /></label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" className="h-4 w-4" checked={f.actif} onChange={(e) => set("actif", e.target.checked)} />
            Proposable aux clients
          </label>
          <label className={CHAMP}><span className={LIB}>Ordre d'affichage</span><Input inputMode="numeric" value={f.ordre} onChange={(e) => set("ordre", e.target.value)} /></label>
        </div>
        <div className="space-y-2">
          <p className={LIB}>Photos officielles du constructeur (uniquement la référence exacte)</p>
          <div className="flex flex-wrap gap-2">
            {f.photos.map((chemin, i) => (
              <span key={chemin} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs">
                Photo {i + 1}
                <button type="button" aria-label="Retirer la photo" onClick={() => set("photos", f.photos.filter((c) => c !== chemin))}>
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-1.5 text-xs font-semibold hover:border-primary">
              {envoi ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Ajouter une photo
              <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && envoyerPhoto(e.target.files[0])} />
            </label>
          </div>
        </div>
      </section>

      <section className="space-y-3 rounded-md border border-border p-3">
        <h3 className="text-sm font-bold">Prix d'achat — visible par l'administrateur seulement</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={CHAMP}><span className={LIB}>Fournisseur</span><Input value={achat.fournisseur} onChange={(e) => setAchat((x) => ({ ...x, fournisseur: e.target.value }))} /></label>
          <label className={CHAMP}><span className={LIB}>Référence fournisseur</span><Input value={achat.reference_fournisseur} onChange={(e) => setAchat((x) => ({ ...x, reference_fournisseur: e.target.value }))} /></label>
          <label className={CHAMP}><span className={LIB}>Prix d'achat HT (avant remise)</span><Input inputMode="decimal" value={achat.prix_achat_ht} onChange={(e) => setAchat((x) => ({ ...x, prix_achat_ht: e.target.value }))} placeholder="Prix d'achat à confirmer" /></label>
          <label className={CHAMP}><span className={LIB}>TVA d'achat (%)</span><Input inputMode="decimal" value={achat.tva_achat_pct} onChange={(e) => setAchat((x) => ({ ...x, tva_achat_pct: e.target.value }))} /></label>
          <label className={CHAMP}><span className={LIB}>Remise professionnelle (%)</span><Input inputMode="decimal" value={achat.remise_pct} onChange={(e) => setAchat((x) => ({ ...x, remise_pct: e.target.value }))} /></label>
          <label className={CHAMP}><span className={LIB}>Frais de livraison HT</span><Input inputMode="decimal" value={achat.frais_livraison_ht} onChange={(e) => setAchat((x) => ({ ...x, frais_livraison_ht: e.target.value }))} /></label>
          <label className={CHAMP}><span className={LIB}>Disponibilité</span><Input value={achat.disponibilite} onChange={(e) => setAchat((x) => ({ ...x, disponibilite: e.target.value }))} placeholder="En stock, 48 h, sur commande…" /></label>
          <label className={CHAMP}><span className={LIB}>Date de dernière actualisation</span><Input type="date" value={achat.actualise_le} onChange={(e) => setAchat((x) => ({ ...x, actualise_le: e.target.value }))} /></label>
        </div>
        <p className="text-xs text-muted-foreground">
          Prix d'achat TTC : {achatTtc != null ? `${achatTtc.toFixed(2).replace(".", ",")} €` : "Prix d'achat à confirmer"}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {achat.justificatif_path && (
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                try {
                  const { url } = await lienJustif({ data: { path: achat.justificatif_path } } as never);
                  window.open(url, "_blank", "noopener");
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Ouverture impossible.");
                }
              }}
            >
              Voir le justificatif
            </Button>
          )}
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-border px-3 py-1.5 text-xs font-semibold hover:border-primary">
            <Upload className="h-3.5 w-3.5" /> {achat.justificatif_path ? "Remplacer" : "Ajouter"} la facture ou le devis fournisseur
            <input type="file" accept="image/*,application/pdf" className="hidden" onChange={(e) => e.target.files?.[0] && envoyerJustificatif(e.target.files[0])} />
          </label>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-bold">Prix de vente TTC par forfait de câble</h3>
        <div className="grid gap-3 sm:grid-cols-4">
          {PALIERS_CABLE_M.map((m) => (
            <label key={m} className={CHAMP}>
              <span className={LIB}>Jusqu'à {m} m (€ TTC)</span>
              <Input inputMode="decimal" value={forfaits[m]} onChange={(e) => setForfaits((x) => ({ ...x, [m]: e.target.value }))} placeholder="Non proposé" />
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">Plus de 20 m : étude personnalisée, aucun prix automatique.</p>
      </section>

      <div className="flex flex-wrap justify-between gap-2">
        {p ? (
          <Button
            variant="ghost"
            className="text-destructive"
            onClick={async () => {
              if (!window.confirm(`Supprimer ${p.marque} ${p.nom_commercial} du catalogue ?`)) return;
              try {
                await supprimer({ data: { id: p.id } } as never);
                toast.success("Borne supprimée du catalogue.");
                onEnregistre();
              } catch (e) {
                toast.error(e instanceof Error ? e.message : "Suppression impossible.");
              }
            }}
          >
            <Trash2 className="h-4 w-4" /> Supprimer
          </Button>
        ) : (
          <span />
        )}
        <Button onClick={enregistrer} disabled={occupe || envoi}>
          {occupe ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Enregistrer
        </Button>
      </div>
    </div>
  );
}
