import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { nomReseauClient } from "@/lib/reseau-client";

export type RdvExtrait = {
  reseau_client: string | null;
  client_nom: string;
  client_telephone: string | null;
  client_email: string | null;
  adresse: string;
  cp_ville: string | null;
  date_debut: string | null; // YYYY-MM-DDTHH:mm
  type: "visite" | "installation" | "maintenance" | "sav" | "controle";
  designation: string | null;
  numero_dossier: string | null;
  notes: string | null;
};

const PROMPT = `Tu reçois une fiche d'intervention, une capture d'écran, un PDF ou un tableau envoyé par un partenaire donneur d'ordre (bornes de recharge / électricité / télécom).
Extrais CHAQUE intervention à planifier. Réponds UNIQUEMENT avec un JSON, sans texte autour :
{"rdv":[{"client_nom":"...","client_telephone":null,"client_email":null,"adresse":"numéro et rue","cp_ville":"code postal et ville","date_debut":"YYYY-MM-DDTHH:mm ou null","type":"installation|maintenance|sav|visite|controle","designation":"matériel / prestation courte","numero_dossier":"n° de ticket, commande ou dossier ou null","notes":"infos utiles (accès, contact sur place, remarques) ou null"}]}
Ajoute pour CHAQUE intervention le champ "reseau_client" : nom du client commercial, réseau ou opérateur pour lequel le donneur d'ordre intervient (ex. Bump, Bun, 50five, Fifty Five, Amara, KV2, KDB), tel qu'il est écrit dans le document. Cherche dans les colonnes client/enseigne/réseau/opérateur, les en-têtes et logos si leur rôle est clair. Ce n'est ni le nom du particulier (client_nom), ni le donneur d'ordre ENSIO, ni le fabricant ou modèle matériel de borne (designation). Conserve exactement les sigles et l'orthographe lus ; ne corrige pas un nom par supposition. Si plusieurs clients commerciaux sont présents, associe chacun à la bonne intervention. Mets null si absent ou ambigu.
Règles : n'invente rien, mets null si absent. Téléphone au format français. Une ligne de tableau = une intervention. Dépannage = "sav".`;

const TYPES = ["visite", "installation", "maintenance", "sav", "controle"] as const;
const s = (v: unknown, max = 300) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

export const analyserDocumentRdv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z
      .object({
        data_url: z.string().max(14_000_000).optional().nullable(),
        filename: z.string().max(200).optional().nullable(),
        texte: z.string().max(200_000).optional().nullable(),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: staff } = await context.supabase.rpc("is_staff");
    if (!staff) throw new Error("Accès réservé à l'équipe.");
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("Service d'analyse non configuré.");

    const content: unknown[] = [{ type: "input_text", text: PROMPT }];
    if (data.texte) content.push({ type: "input_text", text: `Contenu du tableau :\n${data.texte}` });
    if (data.data_url) {
      if (/^data:image\/(jpeg|png|webp);base64,/.test(data.data_url)) {
        content.push({ type: "input_image", image_url: data.data_url });
      } else if (data.data_url.startsWith("data:application/pdf;base64,")) {
        content.push({ type: "input_file", filename: data.filename || "fiche.pdf", file_data: data.data_url });
      } else throw new Error("Format non supporté (photo, capture, PDF ou Excel).");
    }
    if (content.length < 2) throw new Error("Aucun fichier reçu.");

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
      if (res.status === 403) throw new Error("Analyse refusée par le service IA.");
      throw new Error(`Analyse impossible (${res.status}) : ${(await res.text()).slice(0, 200)}`);
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
    if (!m) throw new Error("Le document n'a pas pu être lu. Essayez une image plus nette.");
    let parsed: { rdv?: unknown[] };
    try {
      parsed = JSON.parse(m[0]);
    } catch {
      throw new Error("Le document n'a pas pu être lu.");
    }
    const out: RdvExtrait[] = (parsed.rdv ?? []).flatMap((r) => {
      const o = (r ?? {}) as Record<string, unknown>;
      const t = s(o["type"], 20) as RdvExtrait["type"] | null;
      const date = s(o["date_debut"], 40);
      return [
        {
          client_nom: s(o["client_nom"], 160) ?? "Client à préciser",
          reseau_client: nomReseauClient(o["reseau_client"]),
          client_telephone: s(o["client_telephone"], 40),
          client_email: s(o["client_email"], 255),
          adresse: s(o["adresse"]) ?? "",
          cp_ville: s(o["cp_ville"], 160),
          date_debut: date && /^\d{4}-\d{2}-\d{2}/.test(date) ? date.slice(0, 16) : null,
          type: t && (TYPES as readonly string[]).includes(t) ? t : "installation",
          designation: s(o["designation"], 200),
          numero_dossier: s(o["numero_dossier"], 80),
          notes: s(o["notes"], 3000),
        },
      ];
    });
    if (!out.length) throw new Error("Aucune intervention trouvée dans ce document.");
    return out;
  });
