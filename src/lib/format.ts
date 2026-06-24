const currency = import.meta.env.VITE_CURRENCY ?? "COP";
const locale = import.meta.env.VITE_LOCALE ?? "es-CO";
export const appTimeZone =
  import.meta.env.VITE_TIMEZONE ?? "America/Argentina/Buenos_Aires";

export function todayInAppTz(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: appTimeZone }).format(new Date());
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(value);
}

function parseDateInput(date: string | Date): Date {
  return typeof date === "string"
    ? new Date(date.includes("T") ? date : `${date}T12:00:00`)
    : date;
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(parseDateInput(date));
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: appTimeZone,
  }).format(parseDateInput(date));
}

export function formatPercent(value: number): string {
  return `${value.toFixed(0)}%`;
}

export function formatNumber(value: number): string {
  return value.toString().padStart(2, "0");
}

export function sortPickNumbersAsc<T extends { number: number }>(items: T[]): T[] {
  return [...items].sort((a, b) => a.number - b.number);
}

export function displayPlayerName(name: string, nickname?: string | null): string {
  return nickname ? `${name} (${nickname})` : name;
}

export function displayLeaderboardPlayerName(
  name: string,
  nickname: string | null | undefined,
  rank: number,
  revealFullName: boolean,
): string {
  if (revealFullName) return displayPlayerName(name, nickname);
  const trimmed = nickname?.trim();
  return trimmed ? trimmed : `Jugador #${rank}`;
}

export function gameStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    draft: "Borrador",
    active: "Activo",
    closed: "Cerrado",
    archived: "Archivado",
  };
  return labels[status] ?? status;
}

export function displayGameLabel(label: string, fallbackIndex?: number): string {
  const trimmed = label.trim();
  if (trimmed) return trimmed;
  if (fallbackIndex != null) return `Juego #${fallbackIndex}`;
  return "Juego";
}
