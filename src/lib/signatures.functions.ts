import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type SignatureClient = {
  kind: "pv" | "devis" | "document";
  id: string;
  client: string;
  titre: string;
  signe_par: string | null;
  signe_at: string;
  transmis_at: string | null;
  lien: string;
};

/** Tous les documents signés par les clients : PV, devis et documents à signer. */
export const listSignaturesClients = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SignatureClient[]> => {
    const [pvQ, devisQ, docsQ] = await Promise.all([
      context.supabase
        .from("rapport_remplis")
        .select("id, signataire_nom, signed_at, sent_at, public_token, rendezvous_id, modele_id")
        .not("signed_at", "is", null)
        .order("signed_at", { ascending: false })
        .limit(200),
      context.supabase
        .from("devis")
        .select("id, numero, client_nom, signataire_nom, signed_at, sent_at, public_token")
        .not("signed_at", "is", null)
        .order("signed_at", { ascending: false })
        .limit(200),
      context.supabase
        .from("documents")
        .select("id, nom, dossier, signed_at, sent_at, public_token, signataires")
        .not("signed_at", "is", null)
        .order("signed_at", { ascending: false })
        .limit(200),
    ]);
    if (pvQ.error) throw new Error(pvQ.error.message);
    if (devisQ.error) throw new Error(devisQ.error.message);
    if (docsQ.error) throw new Error(docsQ.error.message);

    const rdvIds = [...new Set((pvQ.data ?? []).map((r) => r.rendezvous_id).filter(Boolean))] as string[];
    const modeleIds = [...new Set((pvQ.data ?? []).map((r) => r.modele_id))];
    const [rdvQ, modQ] = await Promise.all([
      rdvIds.length
        ? context.supabase.from("rendezvous").select("id, client_nom").in("id", rdvIds)
        : Promise.resolve({ data: [] as { id: string; client_nom: string }[] }),
      modeleIds.length
        ? context.supabase.from("rapport_modeles").select("id, nom").in("id", modeleIds)
        : Promise.resolve({ data: [] as { id: string; nom: string }[] }),
    ]);
    const rdvMap = new Map((rdvQ.data ?? []).map((r) => [r.id, r.client_nom]));
    const modMap = new Map((modQ.data ?? []).map((m) => [m.id, m.nom]));

    const out: SignatureClient[] = [];
    for (const r of pvQ.data ?? []) {
      out.push({
        kind: "pv",
        id: r.id,
        client: (r.rendezvous_id && rdvMap.get(r.rendezvous_id)) || r.signataire_nom || "Client",
        titre: modMap.get(r.modele_id) ?? "PV de réception",
        signe_par: r.signataire_nom,
        signe_at: r.signed_at!,
        transmis_at: r.sent_at,
        lien: `/rapport-donneur/${r.public_token}`,
      });
    }
    for (const d of devisQ.data ?? []) {
      out.push({
        kind: "devis",
        id: d.id,
        client: d.client_nom,
        titre: `Devis ${d.numero}`,
        signe_par: d.signataire_nom,
        signe_at: d.signed_at!,
        transmis_at: d.sent_at,
        lien: `/devis-client/${d.public_token}`,
      });
    }
    for (const d of docsQ.data ?? []) {
      const signataires = Array.isArray(d.signataires) ? (d.signataires as { nom?: string }[]) : [];
      out.push({
        kind: "document",
        id: d.id,
        client: signataires.map((s) => s?.nom).filter(Boolean).join(", ") || "Signataire",
        titre: d.nom,
        signe_par: signataires.map((s) => s?.nom).filter(Boolean).join(", ") || null,
        signe_at: d.signed_at!,
        transmis_at: d.sent_at,
        lien: `/documents`,
      });
    }
    out.sort((a, b) => b.signe_at.localeCompare(a.signe_at));
    return out;
  });
