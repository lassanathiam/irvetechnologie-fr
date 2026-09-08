import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // Réglages volontairement tolérants : sur mobile / 4G instable, une requête
  // échouée est réessayée une fois, et revenir sur l'application ne relance pas
  // tous les chargements (ce qui faisait « sauter » les écrans).
  const queryClient = new QueryClient({
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
