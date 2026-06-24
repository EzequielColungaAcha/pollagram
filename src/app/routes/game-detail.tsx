import { useParams, Link } from "react-router-dom";
import { useGameDetail, useLeaderboardWithNumbers } from "@/features/games/hooks";
import { CycleSummaryCards } from "@/components/public/cycle-summary-cards";
import { LeaderboardTable } from "@/components/public/leaderboard-table";
import { NumberGrid } from "@/components/public/pick-slot-badges";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton, ErrorState } from "@/components/ui/feedback";
import { formatCurrency, formatDate, formatDateTime, displayGameLabel, displayPlayerName } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export function GameDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, error, refetch } = useGameDetail(id);
  const { data: leaderboard, isLoading: lbLoading } = useLeaderboardWithNumbers(id);

  if (error) {
    return <ErrorState message="No se pudo cargar el juego." onRetry={() => refetch()} />;
  }

  if (isLoading || !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const winnersCount = data.entries.filter((e) => e.is_winner).length;
  const revealFullName = data.status === "closed" || winnersCount > 0;

  return (
    <div className="space-y-10 md:space-y-12">
      <div>
        <Link to="/" className="text-sm text-primary hover:underline">
          ← Volver al inicio
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight md:text-3xl">
          {displayGameLabel(data.label)}
        </h1>
        <p className="mt-1 text-base text-muted-foreground">
          {formatDateTime(data.closed_at ?? data.created_at)}
        </p>
      </div>

      <CycleSummaryCards game={data} winnersCount={winnersCount} />

      {data.winners.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Ganadores</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {data.winners.map((w) => (
              <div key={w.id} className="flex items-center justify-between text-sm">
                <span>{displayPlayerName(w.player_name, w.player_nickname)}</span>
                <Badge variant="secondary">{formatCurrency(w.prize_amount)}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Clasificación</CardTitle>
        </CardHeader>
        <CardContent>
          {lbLoading ? (
            <Skeleton className="h-48" />
          ) : (
            <LeaderboardTable entries={leaderboard ?? []} revealFullName={revealFullName} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Historial de sorteos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.draws.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin sorteos registrados.</p>
          ) : (
            data.draws.map((draw) => (
              <div key={draw.id}>
                <p className="mb-2 text-sm font-medium">{formatDate(draw.draw_date)}</p>
                <NumberGrid numbers={draw.numbers.map((n) => n.number)} columns={10} />
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
