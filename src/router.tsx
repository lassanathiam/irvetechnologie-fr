import { MutationCache, QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { toast } from "sonner";
import { routeTree } from "./routeTree.gen";

function messageErreur(erreur: unknown) {
  const brut = erreur instanceof Error ? erreur.message : String(erreur ?? "");
  if (!brut) return "Action impossible pour le moment. Réessayez.";
  if (/failed to fetch|network|load failed|timeout/i.test(brut))
    return "Connexion interrompue. Vérifiez le réseau et réessayez.";
  if (/unauthorized|401|jwt/i.test(brut))
    return "Session expirée. Reconnectez-vous pour continuer.";
  return brut;
}

export const getRouter = () => {
  // Réglages volontairement tolérants : sur mobile / 4G instable, une requête
  // échouée est réessayée une fois, et revenir sur l'application ne relance pas
  // tous les chargements (ce qui faisait « sauter » les écrans).
  const queryClient = new QueryClient({
    mutationCache: new MutationCache({
      // Filet de sécurité : aucune action ne peut plus échouer en silence.
      onError: (erreur) => {
        if (typeof window === "undefined") return;
        toast.error(messageErreur(erreur));
      },
    }),
    defaultOptions: {
      queries: {
        retry: 1,
        retryDelay: (tentative) => Math.min(1000 * 2 ** tentative, 4000),
        staleTime: 30_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
      },
      mutations: {
        retry: 0,
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 30_000,
  });

  return router;
};
