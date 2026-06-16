import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
});

export const queryKeys = {
  activeGame: ["activeGame"] as const,
  activeGames: ["activeGames"] as const,
  game: (id: string) => ["game", id] as const,
  gameDetail: (id: string) => ["gameDetail", id] as const,
  leaderboard: (gameId: string) => ["leaderboard", gameId] as const,
  leaderboardWithNumbers: (gameId: string) =>
    ["leaderboardWithNumbers", gameId] as const,
  gameHistory: (filters: Record<string, unknown>) =>
    ["gameHistory", filters] as const,
  globalStats: ["globalStats"] as const,
  settings: ["settings"] as const,
  players: ["players"] as const,
  draws: ["draws"] as const,
  auditLogs: (page: number) => ["auditLogs", page] as const,
  session: ["session"] as const,
};
