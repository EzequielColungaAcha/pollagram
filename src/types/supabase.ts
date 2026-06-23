export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type GameStatus = "draft" | "active" | "closed" | "archived";

export interface Database {
  public: {
    Tables: {
      app_settings: {
        Row: {
          id: number;
          entry_fee: number;
          prize_percent: number;
          default_cycle_days: number;
          updated_at: string;
        };
        Insert: {
          id?: number;
          entry_fee?: number;
          prize_percent?: number;
          default_cycle_days?: number;
          updated_at?: string;
        };
        Update: {
          id?: number;
          entry_fee?: number;
          prize_percent?: number;
          default_cycle_days?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      games: {
        Row: {
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
        };
        Insert: Partial<Database["public"]["Tables"]["games"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["games"]["Row"]>;
        Relationships: [];
      };
      players: {
        Row: {
          id: string;
          name: string;
          nickname: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["players"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["players"]["Row"]>;
        Relationships: [];
      };
      player_entries: {
        Row: {
          id: string;
          player_id: string;
          game_id: string;
          matched_count: number;
          remaining_count: number;
          completion_pct: number;
          is_winner: boolean;
          won_at: string | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["player_entries"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["player_entries"]["Row"]>;
        Relationships: [];
      };
      entry_numbers: {
        Row: {
          id: string;
          entry_id: string;
          slot: number;
          number: number;
        };
        Insert: Partial<Database["public"]["Tables"]["entry_numbers"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["entry_numbers"]["Row"]>;
        Relationships: [];
      };
      lottery_draws: {
        Row: {
          id: string;
          game_id: string;
          draw_date: string;
          entered_by: string | null;
          is_invalidated: boolean;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["lottery_draws"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["lottery_draws"]["Row"]>;
        Relationships: [];
      };
      draw_numbers: {
        Row: {
          id: string;
          draw_id: string;
          position: number;
          number: number;
        };
        Insert: Partial<Database["public"]["Tables"]["draw_numbers"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["draw_numbers"]["Row"]>;
        Relationships: [];
      };
      matches: {
        Row: {
          id: string;
          entry_id: string;
          entry_number_id: string;
          draw_id: string;
          draw_number_id: string;
          matched_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["matches"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["matches"]["Row"]>;
        Relationships: [];
      };
      winners: {
        Row: {
          id: string;
          entry_id: string;
          game_id: string;
          prize_amount: number;
          won_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["winners"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["winners"]["Row"]>;
        Relationships: [];
      };
      audit_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          entity_type: string;
          entity_id: string | null;
          old_value: Json | null;
          new_value: Json | null;
          created_at: string;
        };
        Insert: Partial<Database["public"]["Tables"]["audit_logs"]["Row"]>;
        Update: Partial<Database["public"]["Tables"]["audit_logs"]["Row"]>;
        Relationships: [];
      };
    };
    Views: {
      leaderboard_view: {
        Row: {
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
        };
        Relationships: [];
      };
    };
    Functions: {
      rpc_enter_draw: {
        Args: { p_draw_date: string; p_numbers: number[] };
        Returns: Json;
      };
      rpc_invalidate_draw: {
        Args: { p_draw_id: string };
        Returns: Json;
      };
      rpc_create_player: {
        Args: { p_name: string; p_nickname?: string };
        Returns: string;
      };
      rpc_create_game: {
        Args: {
          p_label?: string;
          p_entry_fee?: number;
          p_prize_percent?: number;
          p_start_date?: string;
        };
        Returns: string;
      };
      rpc_update_game: {
        Args: {
          p_game_id: string;
          p_label?: string;
          p_entry_fee?: number;
          p_prize_percent?: number;
          p_start_date?: string;
        };
        Returns: undefined;
      };
      rpc_register_player_entry: {
        Args: {
          p_game_id: string;
          p_name: string;
          p_numbers: number[];
          p_nickname?: string;
        };
        Returns: string;
      };
      rpc_open_game: { Args: { p_game_id: string }; Returns: undefined };
      rpc_close_game: { Args: { p_game_id: string }; Returns: Json };
      rpc_archive_game: { Args: { p_game_id: string }; Returns: undefined };
      rpc_create_entry: {
        Args: {
          p_player_id: string;
          p_game_id: string;
          p_numbers: number[];
        };
        Returns: string;
      };
      rpc_edit_entry_numbers: {
        Args: { p_entry_id: string; p_numbers: number[] };
        Returns: undefined;
      };
      rpc_update_settings: {
        Args: { p_entry_fee: number; p_prize_percent: number };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
