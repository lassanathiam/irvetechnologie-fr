import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const BUCKET = "documents";

export type LigneLue = {
  article: string;
  reference: string | null;
  unite: string;
  quantite: number;
  prix_unitaire: number | null;
  chantier_indice: string | null;
};

export type BonLu = {
  donneur_ordre: string | null;
  numero: string | null;
  date_bon: string | null;
  lignes: LigneLue[];
};

const PROMPT = `Tu reçois la photo d'un bon de commande / bon de livraison de matériel électrique (bornes de recharge, câbles, disjoncteurs, gaines, coffrets...).
Réponds UNIQUEMENT avec un JSON, sans texte autour :
{"donneur_ordre":"fournisseur ou donneur d'ordre ou null","numero":"n° du bon ou null","date_bon":"YYYY-MM-DD ou null","lignes":[{"article":"désignation courte","reference":"référence ou null","unite":"u|m|lot|rouleau","quantite":1,"prix_unitaire":null,"chantier_indice":"nom client / adresse / n° chantier indiqué sur la ligne ou null"}]}
Règles : n'invente rien. Une ligne d'article = une entrée. Les câbles en mètres (unite "m"). Prix HT unitaire seulement s'il est écrit.`;

const str = (v: unknown, max = 200) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const num = (v: unknown) => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

async function exigerStaff(supabase: { rpc: (f: "is_staff") => PromiseLike<{ data: unknown }> }) {
  const { data } = await supabase.rpc("is_staff");
  if (!data) throw new Error("Accès réservé à l'équipe.");
}

export const lireBonCommande = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ data_url: z.string().max(14_000_000) }).parse(i))
  .handler(async ({ data, context }): Promise<BonLu> => {
    await exigerStaff(context.supabase);
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Service de lecture non configuré.");
    const content: unknown[] = [{ type: "input_text", text: PROMPT }];
    if (/^data:image\/(jpeg|png|webp);base64,/.test(data.data_url)) {
      content.push({ type: "input_image", image_url: data.data_url });
    } else if (data.data_url.startsWith("data:application/pdf;base64,")) {
      content.push({ type: "input_file", filename: "bon.pdf", file_data: data.data_url });
    } else throw new Error("Format non supporté (photo ou PDF).");

    const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "fetch" },
      body: JSON.stringify({
        model: "openai/gpt-6-astra",
        stream: true,
        store: false,
        reasoning: { effort: "low", summary: "auto" },
        include: ["reasoning.encrypted_content"],
        input: [{ role: "user", content }],
      }),
    });
    if (!res.ok || !res.body) {
      if (res.status === 402) throw new Error("Crédits IA épuisés : rechargez-les dans les paramètres de l'espace de travail.");
      if (res.status === 429) throw new Error("Trop de demandes, réessayez dans une minute.");
      if (res.status === 403) throw new Error("Lecture refusée par le service IA.");
      throw new Error(`Lecture impossible (${res.status}).`);
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    let text = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let idx: number;
      while ((idx = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line.startsWith("data:")) continue;
        try {
          const ev = JSON.parse(line.slice(5).trim()) as { type?: string; delta?: string };
          if (ev.type === "response.output_text.delta" && ev.delta) text += ev.delta;
        } catch {
          /* trame partielle */
        }
      }
    }
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("Le bon n'a pas pu être lu. Reprenez une photo plus nette.");
    let p: Record<string, unknown>;
    try {
      p = JSON.parse(m[0]);
    } catch {
      throw new Error("Le bon n'a pas pu être lu.");
    }
    const lignes: LigneLue[] = (Array.isArray(p["lignes"]) ? p["lignes"] : []).flatMap((l) => {
      const o = (l ?? {}) as Record<string, unknown>;
      const article = str(o["article"]);
      if (!article) return [];
      return [
        {
          article,
          reference: str(o["reference"], 80),
          unite: str(o["unite"], 20) ?? "u",
          quantite: num(o["quantite"]) ?? 1,
          prix_unitaire: num(o["prix_unitaire"]),
          chantier_indice: str(o["chantier_indice"], 200),
        },
      ];
    });
    const date = str(p["date_bon"], 20);
    return {
      donneur_ordre: str(p["donneur_ordre"], 120),
      numero: str(p["numero"], 80),
      date_bon: date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null,
      lignes,
    };
  });

export const listStock = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await exigerStaff(context.supabase);
    const sb = context.supabase;
    const [bons, chantiers] = await Promise.all([
      sb
        .from("stock_bons")
        .select(
          "id, donneur_ordre, numero, date_bon, notes, photo_path, created_at, stock_bon_chantiers(rendezvous_id), stock_lignes(id, article, reference, unite, quantite, prix_unitaire, rendezvous_id, ordre, stock_sorties(id, rendezvous_id, quantite, par, created_at))",
        )
        .order("date_bon", { ascending: false })
        .limit(300),
      sb
        .from("rendezvous")
        .select("id, client_nom, cp_ville, date_debut, statut, partenaire, termine_at")
        .eq("archive", false)
        .neq("statut", "annule")
        .order("date_debut", { ascending: false })
        .limit(400),
    ]);
    if (bons.error) throw new Error(bons.error.message);
    if (chantiers.error) throw new Error(chantiers.error.message);
    return { bons: bons.data ?? [], chantiers: chantiers.data ?? [] };
  });

const ligneSchema = z.object({
  article: z.string().trim().min(1).max(200),
  reference: z.string().trim().max(80).nullable().optional(),
  unite: z.string().trim().max(20).default("u"),
  quantite: z.number().min(0).max(1_000_000),
  prix_unitaire: z.number().min(0).max(1_000_000).nullable().optional(),
  rendezvous_id: z.string().uuid().nullable().optional(),
});

export const enregistrerBon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        donneur_ordre: z.string().trim().min(1).max(120),
        numero: z.string().trim().max(80).nullable().optional(),
        date_bon: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        notes: z.string().trim().max(2000).nullable().optional(),
        data_url: z.string().max(14_000_000).nullable().optional(),
        chantiers: z.array(z.string().uuid()).max(100),
        lignes: z.array(ligneSchema).min(1).max(300),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await exigerStaff(context.supabase);
    const sb = context.supabase;
    const { data: bon, error } = await sb
      .from("stock_bons")
      .insert({
        donneur_ordre: data.donneur_ordre,
        numero: data.numero || null,
        date_bon: data.date_bon,
        notes: data.notes || null,
        created_by: context.userId,
      })
      .select("id")
      .single();
    if (error || !bon) throw new Error(error?.message ?? "Enregistrement impossible.");

    if (data.data_url) {
      const mm = /^data:(image\/(?:jpeg|png|webp)|application\/pdf);base64,(.+)$/.exec(data.data_url);
      if (mm) {
        const ext = mm[1] === "application/pdf" ? "pdf" : mm[1]!.split("/")[1];
        const path = `stock/${bon.id}.${ext}`;
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const up = await supabaseAdmin.storage
          .from(BUCKET)
          .upload(path, Buffer.from(mm[2]!, "base64"), { contentType: mm[1], upsert: true });
        if (!up.error) await sb.from("stock_bons").update({ photo_path: path }).eq("id", bon.id);
      }
    }
    const ids = new Set(data.chantiers);
    data.lignes.forEach((l) => l.rendezvous_id && ids.add(l.rendezvous_id));
    if (ids.size) {
      const r = await sb.from("stock_bon_chantiers").insert([...ids].map((rendezvous_id) => ({ bon_id: bon.id, rendezvous_id })));
      if (r.error) throw new Error(r.error.message);
    }
    const r2 = await sb.from("stock_lignes").insert(
      data.lignes.map((l, i) => ({
        bon_id: bon.id,
        article: l.article,
        reference: l.reference || null,
        unite: l.unite || "u",
        quantite: l.quantite,
        prix_unitaire: l.prix_unitaire ?? null,
        rendezvous_id: l.rendezvous_id || null,
        ordre: i,
      })),
    );
    if (r2.error) throw new Error(r2.error.message);
    return { id: bon.id };
  });

export const lierChantiersBon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ bon_id: z.string().uuid(), chantiers: z.array(z.string().uuid()).max(100) }).parse(i))
  .handler(async ({ data, context }) => {
    await exigerStaff(context.supabase);
    const sb = context.supabase;
    await sb.from("stock_bon_chantiers").delete().eq("bon_id", data.bon_id);
    if (data.chantiers.length) {
      const r = await sb
        .from("stock_bon_chantiers")
        .insert(data.chantiers.map((rendezvous_id) => ({ bon_id: data.bon_id, rendezvous_id })));
      if (r.error) throw new Error(r.error.message);
    }
    return { ok: true };
  });

export const ajouterSortie = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        ligne_id: z.string().uuid(),
        rendezvous_id: z.string().uuid(),
        quantite: z.number().positive().max(1_000_000),
        par: z.string().trim().max(80).nullable().optional(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    await exigerStaff(context.supabase);
    const sb = context.supabase;
    const { data: l, error } = await sb.from("stock_lignes").select("quantite, stock_sorties(quantite)").eq("id", data.ligne_id).single();
    if (error || !l) throw new Error("Article introuvable.");
    const utilise = (l.stock_sorties ?? []).reduce((s, x) => s + Number(x.quantite), 0);
    const reste = Number(l.quantite) - utilise;
    if (data.quantite > reste + 1e-9) throw new Error(`Stock insuffisant : il reste ${reste}.`);
    const r = await sb.from("stock_sorties").insert({ ...data, par: data.par || null });
    if (r.error) throw new Error(r.error.message);
    return { ok: true };
  });

export const supprimerSortie = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await exigerStaff(context.supabase);
    const r = await context.supabase.from("stock_sorties").delete().eq("id", data.id);
    if (r.error) throw new Error(r.error.message);
    return { ok: true };
  });

export const supprimerBon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    await exigerStaff(context.supabase);
    const r = await context.supabase.from("stock_bons").delete().eq("id", data.id);
    if (r.error) throw new Error(r.error.message);
    return { ok: true };
  });

export const urlPhotoBon = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ path: z.string().regex(/^stock\/[\w-]+\.(jpg|jpeg|png|webp|pdf)$/) }).parse(i))
  .handler(async ({ data, context }) => {
    await exigerStaff(context.supabase);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(data.path, 600);
    if (error || !s) throw new Error("Photo indisponible.");
    return { url: s.signedUrl };
  });
