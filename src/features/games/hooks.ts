import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query-client";
import {
  fetchActiveGame,
  fetchActiveGames,
  fetchAllGames,
  fetchAuditLogs,
  fetchDraws,
  fetchGameDetail,
  fetchGameChartStats,
  fetchGameHistory,
  fetchGlobalStats,
  fetchLeaderboard,
  fetchLeaderboardWithNumbers,
  fetchPlayers,
  fetchSettings,
} from "@/features/games/api";
import type { GameHistoryFilters } from "@/types/database";

export function useActiveGame() {
  return useQuery({
    queryKey: queryKeys.activeGame,
    queryFn: fetchActiveGame,
  });
}

export function useActiveGames() {
  return useQuery({
    queryKey: queryKeys.activeGames,
    queryFn: fetchActiveGames,
  });
}

export function useLeaderboard(gameId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.leaderboard(gameId ?? ""),
    queryFn: () => fetchLeaderboard(gameId!),
    enabled: !!gameId,
  });
}

export function useLeaderboardWithNumbers(gameId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.leaderboardWithNumbers(gameId ?? ""),
    queryFn: () => fetchLeaderboardWithNumbers(gameId!),
    enabled: !!gameId,
  });
}

export function useGameDetail(gameId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.gameDetail(gameId ?? ""),
    queryFn: () => fetchGameDetail(gameId!),
    enabled: !!gameId,
  });
}

export function useGameHistory(filters: GameHistoryFilters) {
  return useQuery({
    queryKey: queryKeys.gameHistory(filters as Record<string, unknown>),
    queryFn: () => fetchGameHistory(filters),
  });
}

export function useGlobalStats() {
  return useQuery({
    queryKey: queryKeys.globalStats,
    queryFn: fetchGlobalStats,
    staleTime: 300_000,
  });
}

export function useGameChartStats(gameId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.gameChartStats(gameId ?? ""),
    queryFn: () => fetchGameChartStats(gameId!),
    enabled: !!gameId,
    staleTime: 300_000,
  });
}

export function useSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: fetchSettings,
  });
}

export function usePlayers() {
  return useQuery({
    queryKey: queryKeys.players,
    queryFn: fetchPlayers,
  });
}

export function useDraws() {
  return useQuery({
    queryKey: queryKeys.draws,
    queryFn: fetchDraws,
  });
}

export function useAuditLogs(page: number) {
  return useQuery({
    queryKey: queryKeys.auditLogs(page),
    queryFn: () => fetchAuditLogs(page),
  });
}

export function useAllGames() {
  return useQuery({
    queryKey: ["allGames"],
    queryFn: fetchAllGames,
  });
}
