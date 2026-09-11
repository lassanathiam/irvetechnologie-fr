import { createFileRoute } from "@tanstack/react-router";

/**
 * URL publique et permanente d'une photo de réalisation.
 * Le bucket reste privé : ce point d'entrée ne sert que les photos
 * appartenant à une réalisation publiée, et l'URL n'expire jamais.
 */
export const Route = createFileRoute("/api/public/photo/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const path = decodeURIComponent(String((params as { _splat?: string })._splat ?? ""));
          if (!path || path.includes("..")) return new Response("Not found", { status: 404 });

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const { data: row } = await supabaseAdmin
            .from("realisations")
            .select("id")
            .eq("photo_path", path)
            .eq("publie", true)
            .maybeSingle();
          if (!row) return new Response("Not found", { status: 404 });

          const { data: file, error } = await supabaseAdmin.storage.from("projet-photos").download(path);
          if (error || !file) return new Response("Not found", { status: 404 });

          const ext = path.split(".").pop()?.toLowerCase();
          const contentType =
            ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

          return new Response(await file.arrayBuffer(), {
            headers: {
              "Content-Type": contentType,
              "Cache-Control": "public, max-age=31536000, immutable",
            },
          });
        } catch {
          return new Response("Not found", { status: 404 });
        }
      },
    },
  },
});
