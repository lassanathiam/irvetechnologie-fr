import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Alias de compatibilité: certaines anciennes URLs pointent vers /espace/dashboard.
 * On redirige vers /espace pour éviter les pages introuvables.
 */
export const Route = createFileRoute("/_authenticated/espace/dashboard")({
  beforeLoad: () => {
    throw redirect({ to: "/espace" });
  },
  component: () => null,
});
