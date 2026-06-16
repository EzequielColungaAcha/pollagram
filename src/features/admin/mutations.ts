import { supabase } from "@/lib/supabase";
import { queryClient } from "@/lib/query-client";
import type { PostgrestError } from "@supabase/supabase-js";

function throwIfError(error: PostgrestError | null): void {
  if (!error) return;
  const msg = error.details
    ? `${error.message}: ${error.details}`
    : error.message;
  throw new Error(msg);
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  queryClient.clear();
}

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session;
}

export async function createPlayer(name: string, nickname?: string) {
  const { data, error } = await supabase.rpc("rpc_create_player", {
    p_name: name,
    p_nickname: nickname ?? undefined,
  });
  throwIfError(error);
  invalidateAll();
  return data;
}

export async function createGame(
  label?: string,
  entryFee?: number,
  prizePercent?: number,
) {
  const { data, error } = await supabase.rpc("rpc_create_game", {
    p_label: label?.trim() || undefined,
    p_entry_fee: entryFee,
    p_prize_percent: prizePercent,
  });
  throwIfError(error);
  invalidateAll();
  return data;
}

export async function updateGame(
  gameId: string,
  updates: {
    label?: string;
    entryFee?: number;
    prizePercent?: number;
  },
) {
  const { error } = await supabase.rpc("rpc_update_game", {
    p_game_id: gameId,
    p_label: updates.label?.trim(),
    p_entry_fee: updates.entryFee,
    p_prize_percent: updates.prizePercent,
  });
  throwIfError(error);
  invalidateAll();
}

export async function openGame(gameId: string) {
  const { error } = await supabase.rpc("rpc_open_game", {
    p_game_id: gameId,
  });
  throwIfError(error);
  invalidateAll();
}

export async function closeGame(gameId: string) {
  const { data, error } = await supabase.rpc("rpc_close_game", {
    p_game_id: gameId,
  });
  throwIfError(error);
  invalidateAll();
  return data;
}

export async function archiveGame(gameId: string) {
  const { error } = await supabase.rpc("rpc_archive_game", {
    p_game_id: gameId,
  });
  throwIfError(error);
  invalidateAll();
}

export async function registerPlayerEntry(
  gameId: string,
  name: string,
  numbers: number[],
  nickname?: string,
) {
  const { data, error } = await supabase.rpc("rpc_register_player_entry", {
    p_game_id: gameId,
    p_name: name,
    p_numbers: numbers,
    p_nickname: nickname ?? undefined,
  });
  throwIfError(error);
  invalidateAll();
  return data;
}

export async function createEntry(
  playerId: string,
  gameId: string,
  numbers: number[],
) {
  const { data, error } = await supabase.rpc("rpc_create_entry", {
    p_player_id: playerId,
    p_game_id: gameId,
    p_numbers: numbers,
  });
  throwIfError(error);
  invalidateAll();
  return data;
}

export async function editEntryNumbers(entryId: string, numbers: number[]) {
  const { error } = await supabase.rpc("rpc_edit_entry_numbers", {
    p_entry_id: entryId,
    p_numbers: numbers,
  });
  throwIfError(error);
  invalidateAll();
}

export async function enterDraw(drawDate: string, numbers: number[]) {
  const { data, error } = await supabase.rpc("rpc_enter_draw", {
    p_draw_date: drawDate,
    p_numbers: numbers,
  });
  throwIfError(error);
  invalidateAll();
  return data;
}

export async function invalidateDraw(drawId: string) {
  const { data, error } = await supabase.rpc("rpc_invalidate_draw", {
    p_draw_id: drawId,
  });
  throwIfError(error);
  invalidateAll();
  return data;
}

export async function updateSettings(entryFee: number, prizePercent: number) {
  const { error } = await supabase.rpc("rpc_update_settings", {
    p_entry_fee: entryFee,
    p_prize_percent: prizePercent,
  });
  throwIfError(error);
  invalidateAll();
}

function invalidateAll() {
  queryClient.invalidateQueries();
}
