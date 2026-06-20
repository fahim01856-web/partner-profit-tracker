import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Show cached data instantly; refresh in background
        staleTime: 5 * 60_000,
        gcTime: 30 * 60_000,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: false,
        retry: 1,
        networkMode: "offlineFirst",
      },
      mutations: {
        networkMode: "offlineFirst",
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Let Query control freshness — but allow router preload cache to dedupe rapid intents
    defaultPreloadStaleTime: 0,
    defaultPreloadGcTime: 30 * 60_000,
    defaultPreload: "intent",
    // Avoid showing pending UI for fast navigations — feels instant
    defaultPendingMs: 1500,
    defaultPendingMinMs: 0,
  });

  return router;
};
