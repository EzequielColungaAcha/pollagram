import {
  formatCurrency,
  formatDate,
  formatPercent,
  gameStatusLabel,
} from "@/lib/format";
import type { AuditLog } from "@/types/database";

type AuditValueFields = {
  new_value: unknown;
  old_value: unknown;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

const ACTION_LABELS: Record<string, string> = {
  player_created: "Jugador creado",
  player_updated: "Jugador actualizado",
  entry_created: "Entrada registrada",
  entry_deleted: "Entrada eliminada",
  numbers_edited: "Números editados",
  draw_entered: "Sorteo registrado",
  draw_invalidated: "Sorteo invalidado",
  game_created: "Juego creado",
  game_opened: "Juego abierto",
  game_closed: "Juego cerrado",
  game_archived: "Juego archivado",
  settings_changed: "Configuración cambiada",
  winner_recorded: "Ganador registrado",
};

const ENTITY_LABELS: Record<string, string> = {
  players: "Jugador",
  player_entries: "Entrada de jugador",
  games: "Juego",
  lottery_draws: "Sorteo",
  app_settings: "Configuración global",
};

const FIELD_LABELS: Record<string, string> = {
  name: "Nombre",
  nickname: "Apodo",
  label: "Nombre del juego",
  draw_date: "Fecha del sorteo",
  start_date: "Fecha de inicio",
  new_matches: "Aciertos nuevos",
  retroactive_matches: "Aciertos retroactivos",
  reason: "Motivo",
  prize_amount: "Premio",
  entry_fee: "Cuota",
  prize_percent: "% premio",
  rollover_in: "Rollover",
  rollover_amount: "Monto de rollover",
  status: "Estado",
  scope: "Alcance",
  player_name: "Jugador",
  player_id: "ID de jugador",
  game_id: "ID de juego",
  has_winners: "Tiene ganadores",
  original_status: "Estado original",
  action: "Acción",
};

const REASON_LABELS: Record<string, string> = {
  winner_detected: "ganador detectado",
  no_winners: "sin ganadores",
  matches_reprocessed: "aciertos reprocesados",
};

const SCOPE_LABELS: Record<string, string> = {
  all_active_games: "todos los juegos activos",
};

export function auditActionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action;
}

export function auditEntityLabel(entityType: string): string {
  return ENTITY_LABELS[entityType] ?? entityType;
}

function formatFieldValue(key: string, value: unknown): string {
  if (value === null || value === undefined) return "—";

  if ((key === "draw_date" || key === "start_date") && typeof value === "string") {
    return formatDate(value);
  }
  if (
    (key === "prize_amount" ||
      key === "entry_fee" ||
      key === "rollover_in" ||
      key === "rollover_amount") &&
    typeof value === "number"
  ) {
    return formatCurrency(value);
  }
  if (key === "prize_percent" && typeof value === "number") {
    return formatPercent(value * 100);
  }
  if (key === "status" && typeof value === "string") {
    return gameStatusLabel(value);
  }
  if (key === "original_status" && typeof value === "string") {
    return gameStatusLabel(value);
  }
  if (key === "reason" && typeof value === "string") {
    return REASON_LABELS[value] ?? value;
  }
  if (key === "scope" && typeof value === "string") {
    return SCOPE_LABELS[value] ?? value;
  }
  if (key === "action" && typeof value === "string") {
    return REASON_LABELS[value] ?? value.replace(/_/g, " ");
  }
  if (key === "has_winners" && typeof value === "boolean") {
    return value ? "sí" : "no";
  }
  if (typeof value === "boolean") {
    return value ? "sí" : "no";
  }
  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
}

function formatValueObject(obj: Record<string, unknown>): string {
  const parts = Object.entries(obj)
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) => {
      const label = FIELD_LABELS[key] ?? key;
      return `${label}: ${formatFieldValue(key, value)}`;
    });

  return parts.length > 0 ? parts.join(" · ") : "—";
}

export function formatAuditDetails(log: AuditValueFields): string {
  const value = asRecord(log.new_value) ?? asRecord(log.old_value);
  if (!value || Object.keys(value).length === 0) return "—";
  return formatValueObject(value);
}

export function serializeAuditLogsRaw(logs: AuditLog[]): string {
  const payload = logs.map((log) => ({
    id: log.id,
    created_at: log.created_at,
    actor_id: log.actor_id,
    action: log.action,
    entity_type: log.entity_type,
    entity_id: log.entity_id,
    old_value: log.old_value,
    new_value: log.new_value,
  }));
  return JSON.stringify(payload, null, 2);
}
