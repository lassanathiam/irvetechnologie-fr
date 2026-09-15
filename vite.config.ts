// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import path from "node:path";
import process from "node:process";
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { loadEnv } from "vite";

// Loads all env vars (including non-VITE server-only ones) into process.env for server code.
Object.assign(process.env, loadEnv(process.env['NODE_ENV'] ?? "development", process.cwd(), ""));

// Publishable (public) backend coordinates. Used as a last-resort fallback so the
// deployed bundle always knows how to reach the backend, even if the build
// environment only exposes the server-side (non VITE_) variable names.
const PUBLIC_SUPABASE_URL = "https://fpeaoafqboidgypsgzim.supabase.co";
const PUBLIC_SUPABASE_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZwZWFvYWZxYm9pZGd5cHNnemltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA1MTQxOTgsImV4cCI6MjA5NjA5MDE5OH0.pzUibJXsIBrp-B7QUlumdAFYsMFsEdxob_QON1omEpE";

const supabaseUrl =
  process.env['VITE_SUPABASE_URL'] || process.env['SUPABASE_URL'] || PUBLIC_SUPABASE_URL;
const supabasePublishableKey =
  process.env['VITE_SUPABASE_PUBLISHABLE_KEY'] ||
  process.env['SUPABASE_PUBLISHABLE_KEY'] ||
  process.env['VITE_SUPABASE_ANON_KEY'] ||
  PUBLIC_SUPABASE_PUBLISHABLE_KEY;

process.env['VITE_SUPABASE_URL'] = supabaseUrl;
process.env['VITE_SUPABASE_PUBLISHABLE_KEY'] = supabasePublishableKey;
process.env['SUPABASE_URL'] = process.env['SUPABASE_URL'] || supabaseUrl;
process.env['SUPABASE_PUBLISHABLE_KEY'] =
  process.env['SUPABASE_PUBLISHABLE_KEY'] || supabasePublishableKey;

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY": JSON.stringify(supabasePublishableKey),
    },
    resolve: {
      alias: {
        "entities/lib/decode.js": path.resolve(process.cwd(), "node_modules/entities/lib/decode.js"),
        "entities/lib/encode.js": path.resolve(process.cwd(), "node_modules/entities/lib/encode.js"),
        entities: path.resolve(process.cwd(), "node_modules/entities"),
      },
    },
  },
});


