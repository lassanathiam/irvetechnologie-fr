import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { AlertTriangle, BadgeCheck, ExternalLink, ImageOff, Loader2, Pencil, Plus, Tags } from "lucide-react";
import { ProShell } from "@/components/ProShell";
import { Button } from "@/components/ui/button";
import { FicheProduitEditeur } from "@/components/catalogue/FicheProduitEditeur";
import { EditeurCouts, EditeurOptions } from "@/components/catalogue/OptionsEtCouts";
import { CONNECTEUR_LIBELLE, montant, ouiNon, PHASE_LIBELLE } from "@/components/catalogue/outils";
import { getCatalogueCommercial, type ProduitCatalogue } from "@/lib/catalogue-commercial.functions";
import { MARGE_MINIMUM_HT, PALIERS_CABLE_M } from "@/lib/tarification";

export const Route = createFileRoute("/_authenticated/catalogue-commercial")({
  head: () => ({
    meta: [
      { title: "Catalogue commercial et tarifs — Espace pro IRVE Technologie" },
      { name: "description", content: "Bornes réelles, forfaits de câble, options, prix d'achat et marge minimale de la vente directe." },
      { property: "og:title", content: "Catalogue commercial — IRVE Technologie" },
      { property: "og:description", content: "Gestion interne des bornes, forfaits et marges." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CatalogueCommercialPage,
});

type Onglet = "bornes" | "options" | "couts";

function CarteProduit({ p, estAdmin, onModifier }: { p: ProduitCatalogue; estAdmin: boolean; onModifier: () => void }) {
  const [photo, setPhoto] = useState(0);
  return (
    <article className={`overflow-hidden rounded-lg border bg-card ${p.actif ? "border-border" : "border-dashed border-border opacity-70"}`}>
      <div className="grid gap-0 sm:grid-cols-[180px_minmax(0,1fr)]">
        <div className="flex flex-col items-center justify-center gap-2 bg-muted/40 p-3">
          {p.photos_urls.length ? (
            <>
              <img src={p.photos_urls[photo]} alt={`${p.marque} ${p.nom_commercial}`} className="h-36 w-full object-contain" />
              {p.photos_urls.length > 1 && (
                <div className="flex gap-1">
                  {p.photos_urls.map((_, i) => (
                    <button key={i} type="button" aria-label={`Photo ${i + 1}`} onClick={() => setPhoto(i)} className={`h-2 w-2 rounded-full ${i === photo ? "bg-primary" : "bg-border"}`} />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="flex h-36 w-full flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border text-center text-xs text-muted-foreground">
              <ImageOff className="h-6 w-6" /> Photo constructeur à renseigner
            </div>
          )}
        </div>
        <div className="min-w-0 space-y-3 p-4">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-wide text-primary">{p.marque}</p>
              <h3 className="font-semibold leading-tight">{p.nom_commercial}</h3>
              <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                {p.reference_constructeur ? <span className="text-muted-foreground">Réf. {p.reference_constructeur}</span> : null}
                {p.reference_verifiee ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 font-semibold text-primary">
                    <BadgeCheck className="h-3 w-3" /> Référence vérifiée
                  </span>
                ) : (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-semibold text-amber-700 dark:text-amber-400">Référence à vérifier</span>
                )}
                {!p.actif && <span className="rounded-full bg-muted px-2 py-0.5">Masquée</span>}
              </p>
            </div>
            {estAdmin && (
              <Button variant="outline" size="sm" onClick={onModifier}>
                <Pencil className="h-3.5 w-3.5" /> Modifier
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {String(p.puissance_kw).replace(".", ",")} kW · {PHASE_LIBELLE[p.phase]} · {CONNECTEUR_LIBELLE[p.connecteur] ?? p.connecteur}
            {p.connectivite.length ? ` · ${p.connectivite.join(", ")}` : ""} · Délestage : {ouiNon(p.gestion_dynamique)} · Linky/TIC :{" "}
            {ouiNon(p.compatible_tic)} · RFID : {ouiNon(p.rfid)} · MID : {ouiNon(p.mid)} · Garantie :{" "}
            {p.garantie_ans != null ? `${p.garantie_ans} ans` : "à vérifier"}
          </p>
          <div className="flex flex-wrap gap-3 text-xs">
            {p.fiche_technique_url && (
              <a href={p.fiche_technique_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                Fiche technique <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {p.site_officiel_url && (
              <a href={p.site_officiel_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                Site du fabricant <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {p.prix_public_ttc != null && <span className="text-muted-foreground">Prix public : {montant(p.prix_public_ttc)} TTC</span>}
          </div>

          {estAdmin && (
            <p className="text-xs">
              <span className="font-semibold">Prix d'achat : </span>
              {p.achat?.prix_achat_ht ? (
                <>
                  {montant(p.achat.prix_achat_ht)} HT
                  {p.achat.remise_pct ? ` − ${p.achat.remise_pct} %` : ""}
                  {p.achat.fournisseur ? ` · ${p.achat.fournisseur}` : ""}
                  {p.achat.actualise_le ? ` · mis à jour le ${new Date(p.achat.actualise_le).toLocaleDateString("fr-FR")}` : ""}
                </>
              ) : (
                <span className="font-semibold text-destructive">Prix d'achat à confirmer</span>
              )}
            </p>
          )}
          {!estAdmin && !p.achat_confirme && (
            <p className="text-xs font-semibold text-destructive">Prix d'achat à confirmer — pas encore proposable</p>
          )}

          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-xs">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th className="py-1 pr-2 font-semibold">Forfait</th>
                  <th className="py-1 pr-2 font-semibold">Prix client TTC</th>
                  {estAdmin && <th className="py-1 pr-2 font-semibold">Prix de revient HT</th>}
                  {estAdmin && <th className="py-1 pr-2 font-semibold">Marge HT</th>}
                  {estAdmin && <th className="py-1 font-semibold">Prix conseillé TTC</th>}
                </tr>
              </thead>
              <tbody>
                {PALIERS_CABLE_M.map((m) => {
                  const prix = p.forfaits[m];
                  const a = p.analyses?.[m];
                  const rouge = a && a.marge_ht != null && !a.suffisante;
                  const orange = a?.niveau === "tolerance";
                  return (
                    <tr key={m} className={`border-t border-border ${rouge ? "bg-destructive/10 text-destructive" : orange ? "bg-amber-500/10 text-amber-700 dark:text-amber-400" : ""}`}>
                      <td className="py-1.5 pr-2">Jusqu'à {m} m</td>
                      <td className="py-1.5 pr-2 font-semibold">{prix != null ? montant(prix) : <span className="text-muted-foreground">Non proposé</span>}</td>
                      {estAdmin && <td className="py-1.5 pr-2">{a ? montant(a.revient_ht) : "—"}</td>}
                      {estAdmin && (
                        <td className="py-1.5 pr-2 font-semibold">
                          {a?.marge_ht != null ? (
                            <span className="inline-flex items-center gap-1">
                              {(rouge || orange) && <AlertTriangle className="h-3.5 w-3.5" />}
                              {montant(a.marge_ht)}
                              {a.provisoire ? " (provisoire)" : ""}
                            </span>
                          ) : prix != null ? (
                            "Prix d'achat à confirmer"
                          ) : (
                            "—"
                          )}
                        </td>
                      )}
                      {estAdmin && <td className="py-1.5">{a ? montant(a.prix_conseille_ttc) : "—"}</td>}
                    </tr>
                  );
                })}
                <tr className="border-t border-border text-muted-foreground">
                  <td className="py-1.5 pr-2">Plus de 20 m</td>
                  <td className="py-1.5" colSpan={estAdmin ? 4 : 1}>Étude personnalisée</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </article>
  );
}

function CatalogueCommercialPage() {
  const charger = useServerFn(getCatalogueCommercial);
  const qc = useQueryClient();
  const query = useQuery({ queryKey: ["catalogue-commercial"], queryFn: () => charger() });
  const [onglet, setOnglet] = useState<Onglet>("bornes");
  const [marque, setMarque] = useState("");
  const [edition, setEdition] = useState<ProduitCatalogue | "nouveau" | null>(null);
  const rafraichir = () => {
    setEdition(null);
    void qc.invalidateQueries({ queryKey: ["catalogue-commercial"] });
  };

  const data = query.data;
  const marques = useMemo(() => Array.from(new Set((data?.produits ?? []).map((p) => p.marque))), [data]);
  const produits = (data?.produits ?? []).filter((p) => !marque || p.marque === marque);
  const sousMarge = (data?.produits ?? []).filter((p) =>
    Object.values(p.analyses ?? {}).some((a) => a && a.marge_ht != null && !a.suffisante),
  ).length;
  const sansAchat = (data?.produits ?? []).filter((p) => !p.achat_confirme).length;

  return (
    <ProShell>
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <p className="text-mono text-[10px] text-primary">VENTE DIRECTE</p>
            <h1 className="pro-heading text-2xl font-bold sm:text-3xl">Catalogue commercial et tarifs</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Bornes réelles, forfaits de câble, options et marge minimale de {MARGE_MINIMUM_HT} € HT par installation.
            </p>
          </div>
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary/15 text-primary">
            <Tags className="h-5 w-5" />
          </span>
        </div>

        {query.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : query.isError || !data ? (
          <p className="text-sm text-destructive">Chargement du catalogue impossible. Rechargez la page.</p>
        ) : (
          <>
            {data.estAdmin && (
              <div className="grid gap-2 sm:grid-cols-2">
                <p className={`rounded-md border p-3 text-sm ${sansAchat ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-border"}`}>
                  <strong>{sansAchat}</strong> borne(s) avec prix d'achat à confirmer : elles ne peuvent pas être proposées.
                </p>
                <p className={`rounded-md border p-3 text-sm ${sousMarge ? "border-destructive/40 bg-destructive/10 text-destructive" : "border-border"}`}>
                  <strong>{sousMarge}</strong> borne(s) avec au moins un forfait sous {MARGE_MINIMUM_HT} € de marge.
                </p>
              </div>
            )}

            {data.estAdmin && (
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["bornes", "Bornes et forfaits"],
                    ["options", "Options"],
                    ["couts", "Coûts de référence"],
                  ] as [Onglet, string][]
                ).map(([k, l]) => (
                  <Button key={k} variant={onglet === k ? "default" : "outline"} size="sm" onClick={() => setOnglet(k)}>
                    {l}
                  </Button>
                ))}
              </div>
            )}

            {onglet === "options" && data.estAdmin && <EditeurOptions options={data.options} onEnregistre={rafraichir} />}
            {onglet === "couts" && data.estAdmin && data.couts && <EditeurCouts couts={data.couts} onEnregistre={rafraichir} />}

            {onglet === "bornes" && (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <select
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={marque}
                    onChange={(e) => setMarque(e.target.value)}
                    aria-label="Filtrer par marque"
                  >
                    <option value="">Toutes les marques ({data.produits.length})</option>
                    {marques.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                  {data.estAdmin && (
                    <Button onClick={() => setEdition("nouveau")}>
                      <Plus className="h-4 w-4" /> Ajouter une borne
                    </Button>
                  )}
                </div>
                {edition && (
                  <FicheProduitEditeur
                    key={edition === "nouveau" ? "nouveau" : edition.id}
                    produit={edition === "nouveau" ? null : edition}
                    onFerme={() => setEdition(null)}
                    onEnregistre={rafraichir}
                  />
                )}
                <div className="grid gap-3">
                  {produits.map((p) => (
                    <CarteProduit key={p.id} p={p} estAdmin={data.estAdmin} onModifier={() => setEdition(p)} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </ProShell>
  );
}
