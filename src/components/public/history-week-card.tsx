import { Link } from "react-router-dom";
import {
  displayGameLabel,
  formatCurrency,
  formatDateTime,
  gameStatusLabel,
} from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Game } from "@/types/database";

interface HistoryGameCardProps {
  game: Game & { winnerCount: number };
  fallbackIndex?: number;
}

export function HistoryGameCard({ game, fallbackIndex }: HistoryGameCardProps) {
  const displayDate = formatDateTime(game.closed_at ?? game.created_at);

  return (
    <Link to={`/game/${game.id}`}>
      <Card className="transition-colors hover:border-primary/40 hover:bg-secondary/20">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base">
              {displayGameLabel(game.label, fallbackIndex)}
            </CardTitle>
            <Badge variant="outline">{gameStatusLabel(game.status)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">{displayDate}</p>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          <p>Premio: {formatCurrency(game.prize_pool)}</p>
          <p>Jugadores: {game.player_count}</p>
          <p>
            Ganadores: {game.winnerCount > 0 ? game.winnerCount : "Ninguno (rollover)"}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
