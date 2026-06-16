export type GameStatus = "draft" | "active" | "closed" | "archived";

export type AuditAction =
  | "player_created"
  | "player_updated"
  | "entry_created"
  | "numbers_edited"
  | "draw_entered"
  | "draw_invalidated"
  | "game_created"
  | "game_opened"
  | "game_closed"
  | "game_archived"
  | "settings_changed"
  | "winner_recorded";

export interface AppSettings {
  id: number;
  entry_fee: number;
  prize_percent: number;
  default_cycle_days: number;
  updated_at: string;
}

export interface Player {
  id: string;
  name: string;
  nickname: string | null;
  created_at: string;
}

export interface Game {
  id: string;
  label: string;
  start_date: string;
  end_date: string;
  entry_fee: number;
  prize_percent: number;
  total_collected: number;
  rollover_in: number;
  prize_pool: number;
  final_awarded: number | null;
  player_count: number;
  status: GameStatus;
  created_at: string;
  closed_at: string | null;
}

export interface PlayerEntry {
  id: string;
  player_id: string;
  game_id: string;
  matched_count: number;
  remaining_count: number;
  completion_pct: number;
  is_winner: boolean;
  won_at: string | null;
  created_at: string;
}

export interface EntryNumber {
  id: string;
  entry_id: string;
  slot: number;
  number: number;
}

export interface LotteryDraw {
  id: string;
  game_id: string | null;
  draw_date: string;
  entered_by: string | null;
  is_invalidated: boolean;
  created_at: string;
}

export interface DrawNumber {
  id: string;
  draw_id: string;
  position: number;
  number: number;
}

export interface Match {
  id: string;
  entry_id: string;
  entry_number_id: string;
  draw_id: string;
  draw_number_id: string;
  matched_at: string;
}

export interface Winner {
  id: string;
  entry_id: string;
  game_id: string;
  prize_amount: number;
  won_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: AuditAction;
  entity_type: string;
  entity_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  created_at: string;
}

export interface LeaderboardEntry {
  entry_id: string;
  game_id: string;
  matched_count: number;
  remaining_count: number;
  completion_pct: number;
  is_winner: boolean;
  won_at: string | null;
  player_id: string;
  player_name: string;
  player_nickname: string | null;
  rank: number;
}

export interface LeaderboardEntryWithNumbers extends LeaderboardEntry {
  numbers: Array<{ number: number; matched: boolean }>;
}

export interface ActiveGameSummary {
  game: Game;
  winnersCount: number;
}

export interface EntryWithDetails extends LeaderboardEntry {
  numbers: Array<EntryNumber & { matched: boolean }>;
}

export interface GameDetail extends Game {
  entries: EntryWithDetails[];
  draws: Array<LotteryDraw & { numbers: DrawNumber[] }>;
  winners: Array<Winner & { player_name: string }>;
}

export interface GlobalStats {
  totalGames: number;
  totalPrizesAwarded: number;
  highestPrizePool: number;
  averageWinnersPerGame: number;
  averageCompletionRate: number;
  topPlayers: Array<{ name: string; wins: number; totalWinnings: number }>;
  topNumbers: Array<{ number: number; count: number }>;
  participationTrend: Array<{ label: string; players: number }>;
  prizeGrowth: Array<{ label: string; prize: number }>;
  dailyMatches: Array<{ date: string; matches: number }>;
  progressDistribution: Array<{ matched: number; count: number }>;
}

export interface GameHistoryFilters {
  page?: number;
  pageSize?: number;
  hadWinners?: boolean | null;
  minPrize?: number | null;
  fromDate?: string | null;
  toDate?: string | null;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface GameSummary {
  game: Game | null;
  winnersCount: number;
}
