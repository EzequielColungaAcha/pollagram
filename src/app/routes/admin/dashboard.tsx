import { useEffect, useState } from "react";
import { CycleSummaryCards, MetricCard } from "@/components/public/cycle-summary-cards";
import { LeaderboardTable } from "@/components/public/leaderboard-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/feedback";
import {
  ChartDailyMatches,
  ChartParticipation,
  ChartPlayerProgress,
  ChartPrizeGrowth,
} from "@/components/charts";
import {
  useActiveGames,
  useGameChartStats,
  useGlobalStats,
  useLeaderboardWithNumbers,
} from "@/features/games/hooks";
import { formatCurrency, displayGameLabel } from "@/lib/format";
import { Wallet } from "lucide-react";

function GameLeaderboard({ gameId }: { gameId: string }) {
  const { data: leaderboard, isLoading } = useLeaderboardWithNumbers(gameId);
  if (isLoading) return <Skeleton className="h-48" />;
  return <LeaderboardTable entries={leaderboard ?? []} />;
}

export function AdminDashboardPage() {
  const { data: activeGames = [], isLoading } = useActiveGames();
  const [selectedId, setSelectedId] = useState("");
  const { data: stats } = useGlobalStats();
  const { data: gameStats } = useGameChartStats(selectedId);

  useEffect(() => {
    if (activeGames.length > 0 && !selectedId) {
      setSelectedId(activeGames[0]!.game.id);
    }
    if (activeGames.length > 0 && !activeGames.some((g) => g.game.id === selectedId)) {
      setSelectedId(activeGames[0]!.game.id);
    }
  }, [activeGames, selectedId]);

  const selected = activeGames.find((g) => g.game.id === selectedId);

  return (
    <div className="space-y-10 md:space-y-12">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Panel de administración
        </h1>
        <p className="text-base text-muted-foreground">
          Resumen de juegos activos y métricas.
        </p>
      </div>

      {isLoading ? (
        <Skeleton className="h-24 w-full" />
      ) : activeGames.length === 0 ? (
        <p className="text-sm text-muted-foreground">No hay juegos para mostrar.</p>
      ) : (
        <Tabs value={selectedId} onValueChange={setSelectedId}>
          {activeGames.length > 1 && (
            <TabsList>
              {activeGames.map((summary, i) => (
                <TabsTrigger key={summary.game.id} value={summary.game.id}>
                  {displayGameLabel(summary.game.label, i + 1)}
                </TabsTrigger>
              ))}
            </TabsList>
          )}
          {activeGames.map((summary, i) => (
            <TabsContent key={summary.game.id} value={summary.game.id}>
              <div className="space-y-6">
                <CycleSummaryCards
                  game={summary.game}
                  winnersCount={summary.winnersCount}
                  fallbackIndex={i + 1}
                />
                <MetricCard
                  label="Total recaudado"
                  value={formatCurrency(summary.game.total_collected)}
                  icon={<Wallet className="h-5 w-5" />}
                />
              </div>
            </TabsContent>
          ))}
        </Tabs>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Progresión diaria</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartDailyMatches data={gameStats?.dailyMatches ?? []} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribución de progreso</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartPlayerProgress data={gameStats?.progressDistribution ?? []} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Participación</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartParticipation data={stats?.participationTrend ?? []} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Crecimiento del premio</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartPrizeGrowth data={stats?.prizeGrowth ?? []} />
          </CardContent>
        </Card>
      </div>

      {selected && (
        <Card>
          <CardHeader>
            <CardTitle>Clasificación en vivo</CardTitle>
            <CardDescription>
              Posiciones actuales del juego seleccionado.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-2">
            <GameLeaderboard gameId={selected.game.id} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
