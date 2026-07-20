import { supabase } from "@/lib/supabase";
import type {
  ActiveGameSummary,
  AuditLog,
  Game,
  GameDetail,
  GameChartStats,
  GameHistoryFilters,
  GameSummary,
  GlobalStats,
  LeaderboardEntry,
  LeaderboardEntryWithNumbers,
  PaginatedResult,
} from "@/types/database";

export async function fetchActiveGames(): Promise<ActiveGameSummary[]> {
  const { data: games, error } = await supabase
    .from("games")
    .select("*")
    .in("status", ["active", "closed"])
    .order("status", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  if (!games?.length) return [];

  const summaries = await Promise.all(
    (games as Game[]).map(async (game) => {
      const { count } = await supabase
        .from("player_entries")
        .select("*", { count: "exact", head: true })
        .eq("game_id", game.id)
        .eq("is_winner", true);
      return { game, winnersCount: count ?? 0 };
    }),
  );

  return summaries;
}

export async function fetchActiveGame(): Promise<GameSummary> {
  const games = await fetchActiveGames();
  const active = games.find((g) => g.game.status === "active");
  if (!active) return { game: null, winnersCount: 0 };
  return { game: active.game, winnersCount: active.winnersCount };
}

export async function fetchLeaderboard(
  gameId: string,
): Promise<LeaderboardEntry[]> {
  const { data, error } = await supabase
    .from("leaderboard_view")
    .select("*")
    .eq("game_id", gameId)
    .order("rank", { ascending: true });

  if (error) throw error;
  return (data ?? []) as LeaderboardEntry[];
}

export async function fetchLeaderboardWithNumbers(
  gameId: string,
): Promise<LeaderboardEntryWithNumbers[]> {
  const entries = await fetchLeaderboard(gameId);
  if (entries.length === 0) return [];

  const entryIds = entries.map((e) => e.entry_id);

  const [numbersRes, matchesRes] = await Promise.all([
    supabase
      .from("entry_numbers")
      .select("*")
      .in("entry_id", entryIds)
      .order("slot"),
    supabase
      .from("matches")
      .select("entry_number_id")
      .in("entry_id", entryIds),
  ]);

  if (numbersRes.error) throw numbersRes.error;
  if (matchesRes.error) throw matchesRes.error;

  const matchedIds = new Set(
    (matchesRes.data ?? []).map((m) => m.entry_number_id),
  );

  return entries.map((entry) => ({
    ...entry,
    numbers: (numbersRes.data ?? [])
      .filter((n) => n.entry_id === entry.entry_id)
      .sort((a, b) => a.slot - b.slot)
      .map((n) => ({
        number: n.number,
        matched: matchedIds.has(n.id),
      })),
  }));
}

export async function fetchGameDetail(gameId: string): Promise<GameDetail> {
  const { data: game, error: gameError } = await supabase
    .from("games")
    .select("*")
    .eq("id", gameId)
    .single();

  if (gameError) throw gameError;

  const [leaderboard, drawsRes, winnersRes, numbersRes, matchesRes] =
    await Promise.all([
      fetchLeaderboard(gameId),
      fetchDraws(),
      supabase.from("winners").select("*").eq("game_id", gameId),
      supabase
        .from("entry_numbers")
        .select("*")
        .in(
          "entry_id",
          (
            await supabase
              .from("player_entries")
              .select("id")
              .eq("game_id", gameId)
          ).data?.map((e) => e.id) ?? [],
        ),
      supabase
        .from("matches")
        .select("entry_number_id")
        .in(
          "entry_id",
          (
            await supabase
              .from("player_entries")
              .select("id")
              .eq("game_id", gameId)
          ).data?.map((e) => e.id) ?? [],
        ),
    ]);

  const matchedIds = new Set(
    (matchesRes.data ?? []).map((m) => m.entry_number_id),
  );

  const entries = leaderboard.map((entry) => ({
    ...entry,
    numbers: (numbersRes.data ?? [])
      .filter((n) => n.entry_id === entry.entry_id)
      .sort((a, b) => a.slot - b.slot)
      .map((n) => ({ ...n, matched: matchedIds.has(n.id) })),
  }));

  const draws = drawsRes.filter((d) => !d.is_invalidated);

  const winners = await Promise.all(
    (winnersRes.data ?? []).map(async (w) => {
      const { data: entry } = await supabase
        .from("player_entries")
        .select("player_id")
        .eq("id", w.entry_id)
        .single();
      let playerName = "—";
      let playerNickname: string | null = null;
      if (entry) {
        const { data: player } = await supabase
          .from("players")
          .select("name, nickname")
          .eq("id", entry.player_id)
          .single();
        playerName = player?.name ?? "—";
        playerNickname = player?.nickname ?? null;
      }
      return {
        id: w.id,
        entry_id: w.entry_id,
        game_id: w.game_id,
        prize_amount: w.prize_amount,
        won_at: w.won_at,
        player_name: playerName,
        player_nickname: playerNickname,
      };
    }),
  );

  return {
    ...(game as Game),
    entries,
    draws,
    winners,
  };
}

export async function fetchGameHistory(
  filters: GameHistoryFilters = {},
): Promise<PaginatedResult<Game & { winnerCount: number }>> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from("games")
    .select("*", { count: "exact" })
    .in("status", ["closed", "archived"])
    .order("closed_at", { ascending: false, nullsFirst: false });

  if (filters.fromDate) query = query.gte("start_date", filters.fromDate);
  if (filters.toDate) query = query.lte("end_date", filters.toDate);
  if (filters.minPrize) query = query.gte("prize_pool", filters.minPrize);

  const { data, error, count } = await query.range(from, to);
  if (error) throw error;

  const games = (data ?? []) as Game[];
  const enriched = await Promise.all(
    games.map(async (game) => {
      const { count: winnerCount } = await supabase
        .from("winners")
        .select("*", { count: "exact", head: true })
        .eq("game_id", game.id);
      return { ...game, winnerCount: winnerCount ?? 0 };
    }),
  );

  let filtered = enriched;
  if (filters.hadWinners === true) {
    filtered = enriched.filter((g) => g.winnerCount > 0);
  } else if (filters.hadWinners === false) {
    filtered = enriched.filter((g) => g.winnerCount === 0);
  }

  const total = count ?? 0;
  return {
    data: filtered,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  };
}

export async function fetchGlobalStats(): Promise<GlobalStats> {
  const { data: games } = await supabase
    .from("games")
    .select("*")
    .in("status", ["closed", "archived"]);

  const { data: winners } = await supabase.from("winners").select("*");
  const { data: entries } = await supabase
    .from("player_entries")
    .select("completion_pct, game_id, matched_count");
  const { data: entryNumbers } = await supabase
    .from("entry_numbers")
    .select("number");
  const { data: matches } = await supabase
    .from("matches")
    .select("matched_at, draw_id");
  const { data: draws } = await supabase
    .from("lottery_draws")
    .select("id, draw_date, game_id")
    .eq("is_invalidated", false);

  const closedGames = games ?? [];
  const totalPrizesAwarded = (winners ?? []).reduce(
    (s, w) => s + Number(w.prize_amount),
    0,
  );
  const highestPrizePool = closedGames.reduce(
    (max, g) => Math.max(max, Number(g.prize_pool)),
    0,
  );

  const averageWinnersPerGame =
    closedGames.length > 0
      ? (winners ?? []).length / closedGames.length
      : 0;

  const averageCompletionRate =
    (entries ?? []).length > 0
      ? (entries ?? []).reduce((s, e) => s + Number(e.completion_pct), 0) /
        (entries ?? []).length
      : 0;

  const numberCounts = new Map<number, number>();
  for (const en of entryNumbers ?? []) {
    numberCounts.set(en.number, (numberCounts.get(en.number) ?? 0) + 1);
  }
  const topNumbers = [...numberCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([number, count]) => ({ number, count }));

  const playerWins = new Map<string, { wins: number; total: number }>();
  for (const w of winners ?? []) {
    const { data: entry } = await supabase
      .from("player_entries")
      .select("player_id")
      .eq("id", w.entry_id)
      .single();
    let name = "Desconocido";
    if (entry) {
      const { data: player } = await supabase
        .from("players")
        .select("name")
        .eq("id", entry.player_id)
        .single();
      name = player?.name ?? "Desconocido";
    }
    const cur = playerWins.get(name) ?? { wins: 0, total: 0 };
    playerWins.set(name, {
      wins: cur.wins + 1,
      total: cur.total + Number(w.prize_amount),
    });
  }
  const topPlayers = [...playerWins.entries()]
    .map(([name, v]) => ({ name, wins: v.wins, totalWinnings: v.total }))
    .sort((a, b) => b.wins - a.wins || b.totalWinnings - a.totalWinnings)
    .slice(0, 5);

  const participationTrend = closedGames
    .slice(-10)
    .map((g) => ({ label: g.label, players: g.player_count }));

  const prizeGrowth = closedGames.slice(-10).map((g) => ({
    label: g.label,
    prize: Number(g.prize_pool),
  }));

  const drawDateMap = new Map(
    (draws ?? []).map((d) => [d.id, d.draw_date]),
  );
  const dailyMatchMap = new Map<string, number>();
  for (const m of matches ?? []) {
    const date = drawDateMap.get(m.draw_id);
    if (date) dailyMatchMap.set(date, (dailyMatchMap.get(date) ?? 0) + 1);
  }
  const dailyMatches = [...dailyMatchMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([date, matches]) => ({ date, matches }));

  const { data: allEntries } = await supabase
    .from("player_entries")
    .select("matched_count");
  const progressDistributionMap = new Map<number, number>();
  for (const e of allEntries ?? []) {
    progressDistributionMap.set(
      e.matched_count,
      (progressDistributionMap.get(e.matched_count) ?? 0) + 1,
    );
  }
  const progressDistribution = [...progressDistributionMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([matched, count]) => ({ matched, count }));

  return {
    totalGames: closedGames.length,
    totalPrizesAwarded,
    highestPrizePool,
    averageWinnersPerGame,
    averageCompletionRate,
    topPlayers,
    topNumbers,
    participationTrend,
    prizeGrowth,
    dailyMatches,
    progressDistribution,
  };
}

export async function fetchGameChartStats(
  gameId: string,
): Promise<GameChartStats> {
  const { data: matches } = await supabase
    .from("matches")
    .select("draw_id, player_entries!inner(game_id)")
    .eq("player_entries.game_id", gameId);
  const { data: draws } = await supabase
    .from("lottery_draws")
    .select("id, draw_date")
    .eq("is_invalidated", false);

  const drawDateMap = new Map(
    (draws ?? []).map((d) => [d.id, d.draw_date]),
  );
  const dailyMatchMap = new Map<string, number>();
  for (const m of matches ?? []) {
    const date = drawDateMap.get(m.draw_id);
    if (date) dailyMatchMap.set(date, (dailyMatchMap.get(date) ?? 0) + 1);
  }
  const dailyMatches = [...dailyMatchMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-14)
    .map(([date, matches]) => ({ date, matches }));

  const { data: entries } = await supabase
    .from("player_entries")
    .select("matched_count")
    .eq("game_id", gameId);
  const progressDistributionMap = new Map<number, number>();
  for (const e of entries ?? []) {
    progressDistributionMap.set(
      e.matched_count,
      (progressDistributionMap.get(e.matched_count) ?? 0) + 1,
    );
  }
  const progressDistribution = [...progressDistributionMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([matched, count]) => ({ matched, count }));

  return { dailyMatches, progressDistribution };
}

export async function fetchSettings() {
  const { data, error } = await supabase
    .from("app_settings")
    .select("*")
    .eq("id", 1)
    .single();
  if (error) throw error;
  return data;
}

export async function fetchPlayers() {
  const { data, error } = await supabase
    .from("players")
    .select("*")
    .order("name");
  if (error) throw error;
  return data ?? [];
}

export async function fetchDraws() {
  const { data, error } = await supabase
    .from("lottery_draws")
    .select("*")
    .order("draw_date", { ascending: false });
  if (error) throw error;

  const drawIds = (data ?? []).map((d) => d.id);
  const { data: numbers } = drawIds.length
    ? await supabase
        .from("draw_numbers")
        .select("*")
        .in("draw_id", drawIds)
        .order("position")
    : { data: [] };

  return (data ?? []).map((draw) => ({
    ...draw,
    numbers: (numbers ?? []).filter((n) => n.draw_id === draw.id),
  }));
}

export async function fetchAuditLogs(page = 1, pageSize = 30) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  const { data, error, count } = await supabase
    .from("audit_logs")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);
  if (error) throw error;
  return { data: data ?? [], total: count ?? 0, page, pageSize };
}

export async function fetchAllAuditLogs(): Promise<AuditLog[]> {
  const pageSize = 500;
  const all: AuditLog[] = [];
  let page = 1;
  let total = Infinity;

  while (all.length < total) {
    const result = await fetchAuditLogs(page, pageSize);
    total = result.total;
    all.push(...(result.data as AuditLog[]));
    if (result.data.length === 0) break;
    page += 1;
  }

  return all;
}

export async function fetchAllGames() {
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function fetchLastArchivedGame(): Promise<Game | null> {
  const { data, error } = await supabase
    .from("games")
    .select("*")
    .eq("status", "archived")
    .order("closed_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return (data as Game | null) ?? null;
}
