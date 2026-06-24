import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { OverflowType } from "jspdf-autotable";
import {
  displayLeaderboardPlayerName,
  formatDateTime,
  formatNumber,
  sortPickNumbersAsc,
} from "@/lib/format";
import type { LeaderboardEntryWithNumbers } from "@/types/database";

const TABLE_WIDTH = 190;
const RANK_WIDTH = 5;
const BODY_FONT_SIZE = 8;
const CELL_PADDING = 1;
const NUMBER_COLUMN_COUNT = 10;

function sanitizeFilename(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "juego";
}

function computePdfColumnWidths(doc: jsPDF, names: string[]) {
  const available = TABLE_WIDTH - RANK_WIDTH;
  const padding = CELL_PADDING * 2;

  doc.setFontSize(BODY_FONT_SIZE);

  const nameWidthNeeded =
    names.reduce((max, name) => Math.max(max, doc.getTextWidth(name)), 0) + padding;
  const numMinEach = doc.getTextWidth("99") + padding;

  if (nameWidthNeeded + NUMBER_COLUMN_COUNT * numMinEach <= available) {
    return {
      rankWidth: RANK_WIDTH,
      nameWidth: nameWidthNeeded,
      numWidthEach: (available - nameWidthNeeded) / NUMBER_COLUMN_COUNT,
      nameOverflow: "hidden" as OverflowType,
    };
  }

  return {
    rankWidth: RANK_WIDTH,
    nameWidth: available - NUMBER_COLUMN_COUNT * numMinEach,
    numWidthEach: numMinEach,
    nameOverflow: "ellipsize" as OverflowType,
  };
}

export function downloadLeaderboardPdf(
  entries: LeaderboardEntryWithNumbers[],
  title: string,
  revealFullName = true,
): void {
  const sorted = [...entries].sort((a, b) =>
    a.player_name.localeCompare(b.player_name, "es"),
  );

  const headers = ["#", "Jugador", ...Array.from({ length: 10 }, (_, i) => `N${i + 1}`)];

  const names = sorted.map((entry) =>
    displayLeaderboardPlayerName(
      entry.player_name,
      entry.player_nickname,
      entry.rank,
      revealFullName,
    ),
  );

  const body = sorted.map((entry, index) => {
    const sortedNumbers = sortPickNumbersAsc(entry.numbers);
    const numbers = Array.from({ length: 10 }, (_, i) =>
      formatNumber(sortedNumbers[i]?.number ?? 0),
    );
    return [String(index + 1), names[index]!, ...numbers];
  });

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  doc.setFontSize(14);
  doc.text(title, 10, 15);

  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Exportado: ${formatDateTime(new Date())}`, 10, 21);
  doc.setTextColor(0);

  const { rankWidth, nameWidth, numWidthEach, nameOverflow } = computePdfColumnWidths(
    doc,
    names,
  );

  const numberColumnStyles = Object.fromEntries(
    Array.from({ length: NUMBER_COLUMN_COUNT }, (_, i) => [
      i + 2,
      {
        cellWidth: numWidthEach,
        halign: "center" as const,
        overflow: "hidden" as const,
      },
    ]),
  );

  autoTable(doc, {
    head: [headers],
    body,
    startY: 26,
    tableWidth: TABLE_WIDTH,
    margin: { top: 20, left: 10, right: 10, bottom: 10 },
    styles: {
      fontSize: BODY_FONT_SIZE,
      cellPadding: CELL_PADDING,
      overflow: "hidden",
      minCellHeight: 6,
    },
    headStyles: {
      fillColor: [64, 64, 64],
      textColor: 255,
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: rankWidth, halign: "center", overflow: "hidden" },
      1: { cellWidth: nameWidth, overflow: nameOverflow },
      ...numberColumnStyles,
    },
    didParseCell: (data) => {
      if (data.column.index === 0 || data.column.index >= 2) {
        data.cell.styles.halign = "center";
      }
    },
  });

  doc.save(`${sanitizeFilename(title)}-jugadores.pdf`);
}
