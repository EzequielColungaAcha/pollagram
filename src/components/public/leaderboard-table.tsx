import { displayLeaderboardPlayerName } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { LeaderboardEntryWithNumbers } from "@/types/database";
import { Badge } from "@/components/ui/badge";
import { PickSlotBadges } from "./pick-slot-badges";

interface LeaderboardTableProps {
  entries: LeaderboardEntryWithNumbers[];
  revealFullName?: boolean;
}

export function LeaderboardTable({
  entries,
  revealFullName = true,
}: LeaderboardTableProps) {
  if (entries.length === 0) {
    return (
      <p className="py-12 text-center text-base text-muted-foreground">
        No hay jugadores registrados.
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {entries.map((entry) => (
        <li
          key={entry.entry_id}
          className={cn(
            "flex flex-col gap-3 py-5 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:gap-6 md:py-6",
            entry.is_winner && "rounded-xl bg-muted/50 px-4 py-1 -mx-4",
          )}
        >
          <div className="hidden shrink-0 font-mono text-base font-medium tabular-nums text-muted-foreground sm:block">
            #{entry.rank}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-3 sm:gap-4">
            <div className="flex items-center gap-3">
              <div className="shrink-0 font-mono text-base font-medium tabular-nums text-muted-foreground sm:hidden">
                #{entry.rank}
              </div>
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <span className="truncate text-base font-medium sm:truncate-none">
                  {displayLeaderboardPlayerName(
                    entry.player_name,
                    entry.player_nickname,
                    entry.rank,
                    revealFullName,
                  )}
                </span>
                {entry.is_winner && <Badge variant="secondary">Ganador</Badge>}
              </div>
            </div>

            <PickSlotBadges numbers={entry.numbers} />
          </div>
        </li>
      ))}
    </ul>
  );
}
