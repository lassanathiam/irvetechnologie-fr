import { createFileRoute } from "@tanstack/react-router";
import { creerZip, type ZipEntry } from "@/lib/zip.server";
import { RETOUR_CATEGORIES_LABELS } from "@/lib/planning.functions";

/** Nombre de jours pendant lesquels le dossier photos reste téléchargeable. */
const VALIDITE_JOURS = 30;

const sansAccent = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();

/**
 * Dossier photos complet d'un chantier, en un seul fichier ZIP.
 * Accès par le lien privé du chantier, valable 30 jours après la fin des travaux.
 */
export const Route = createFileRoute("/api/public/retour/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const splat = String((params as { _splat?: string })._splat ?? "");
        const token = splat.split("/")[0]?.replace(/\.zip$/i, "") ?? "";
        if (!/^[0-9a-f-]{36}$/i.test(token)) return new Response("Not found", { status: 404 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const { data: rdv } = await supabaseAdmin
          .from("rendezvous")
          .select("id, client_nom, termine_at, archive_at, date_debut")
          .eq("public_token", token)
          .maybeSingle();
        if (!rdv) return new Response("Lien invalide", { status: 404 });

        const reference = rdv.termine_at ?? rdv.archive_at;
        if (!reference) return new Response("Dossier non disponible", { status: 404 });
        const limite = new Date(reference).getTime() + VALIDITE_JOURS * 24 * 60 * 60 * 1000;
        if (Date.now() > limite) {
          return new Response("Ce lien de téléchargement a expiré.", { status: 410 });
        }

        const { data: photos } = await supabaseAdmin
          .from("rendezvous_photos")
          .select("path, categorie, created_at")
          .eq("rendezvous_id", rdv.id)
          .order("created_at", { ascending: true })
          .limit(60);
        if (!photos?.length) return new Response("Aucune photo disponible", { status: 404 });

        const entries: ZipEntry[] = [];
        let index = 0;
        for (const photo of photos) {
          index += 1;
          const { data: file } = await supabaseAdmin.storage
            .from("chantier-photos")
            .download(photo.path);
          if (!file) continue;
          const ext = photo.path.split(".").pop()?.toLowerCase() || "jpg";
          const libelle = RETOUR_CATEGORIES_LABELS[photo.categorie] ?? photo.categorie;
          entries.push({
            name: `${String(index).padStart(2, "0")}-${sansAccent(libelle)}.${ext}`,
            bytes: new Uint8Array(await file.arrayBuffer()),
          });
        }
        if (!entries.length) return new Response("Aucune photo disponible", { status: 404 });

        const zip = creerZip(entries, new Date(reference));
        const nom = `photos-${sansAccent(rdv.client_nom)}-${new Date(reference)
          .toISOString()
          .slice(0, 10)}.zip`;

        await supabaseAdmin
          .from("rendezvous")
          .update({ photos_zip_downloaded_at: new Date().toISOString() })
          .eq("id", rdv.id);

        return new Response(zip as unknown as BodyInit, {
          headers: {
            "Content-Type": "application/zip",
            "Content-Disposition": `attachment; filename="${nom}"`,
            "Cache-Control": "no-store",
          },
        });
      },
    },
  },
});
