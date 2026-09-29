import { createFileRoute } from "@tanstack/react-router";

/**
 * URL publique et permanente d'une photo de borne du catalogue.
 * Le bucket reste privé : ce point d'entrée ne sert que les photos
 * appartenant à une borne visible, et l'URL n'expire jamais.
 */
export const Route = createFileRoute("/api/public/borne-photo/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        try {
          const path = decodeURIComponent(String((params as { _splat?: string })._splat ?? ""));
          if (!path || path.includes("..")) return new Response("Not found", { status: 404 });

          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

          const { data: rows } = await supabaseAdmin
            .from("bornes")
            .select("id")
            .eq("photo_path", path)
            .eq("actif", true)
            .limit(1);
          if (!rows || rows.length === 0) return new Response("Not found", { status: 404 });

          const { data: file, error } = await supabaseAdmin.storage.from("borne-photos").download(path);
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
