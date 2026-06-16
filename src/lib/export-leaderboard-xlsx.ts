import * as XLSX from "xlsx";
import { displayPlayerName, formatNumber, sortPickNumbersAsc } from "@/lib/format";
import type { LeaderboardEntryWithNumbers } from "@/types/database";

function sanitizeFilename(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "juego";
}

export function downloadLeaderboardXlsx(
  entries: LeaderboardEntryWithNumbers[],
  filenameBase: string,
): void {
  const sorted = [...entries].sort((a, b) =>
    a.player_name.localeCompare(b.player_name, "es"),
  );

  const rows = sorted.map((entry, index) => {
    const row: Record<string, string | number> = {
      "#": index + 1,
      Jugador: displayPlayerName(entry.player_name, entry.player_nickname),
    };

    const sortedNumbers = sortPickNumbersAsc(entry.numbers);

    for (let i = 0; i < 10; i++) {
      row[`N${i + 1}`] = formatNumber(sortedNumbers[i]?.number ?? 0);
    }

    return row;
  });

  const worksheet = XLSX.utils.json_to_sheet(rows);
  worksheet["!cols"] = [
    { wch: 4 },
    { wch: 28 },
    ...Array.from({ length: 10 }, () => ({ wch: 5 })),
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Jugadores");
  XLSX.writeFile(workbook, `${sanitizeFilename(filenameBase)}-jugadores.xlsx`);
}
