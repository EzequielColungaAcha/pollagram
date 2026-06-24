import { useEffect, useState } from "react";
import { Download, FileText } from "lucide-react";
import { CycleSummaryCards } from "@/components/public/cycle-summary-cards";
import { LeaderboardTable } from "@/components/public/leaderboard-table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton, EmptyState, ErrorState } from "@/components/ui/feedback";
import { useActiveGames, useDraws, useLeaderboardWithNumbers } from "@/features/games/hooks";
import { downloadLeaderboardPdf } from "@/lib/export-leaderboard-pdf";
import { downloadLeaderboardXlsx } from "@/lib/export-leaderboard-xlsx";
import { displayGameLabel, formatDate, gameStatusLabel } from "@/lib/format";
import type { LeaderboardEntryWithNumbers } from "@/types/database";

function GameLeaderboard({
  entries,
  isLoading,
  revealFullName,
}: {
  entries: LeaderboardEntryWithNumbers[];
  isLoading: boolean;
  revealFullName: boolean;
}) {
  if (isLoading) return <Skeleton className="h-48 w-full" />;
  return <LeaderboardTable entries={entries} revealFullName={revealFullName} />;
}

export function HomePage() {
  const { data: activeGames = [], isLoading, error, refetch } = useActiveGames();
  const [selectedId, setSelectedId] = useState<string>("");

  useEffect(() => {
    if (activeGames.length > 0 && !selectedId) {
      setSelectedId(activeGames[0]!.game.id);
    }
    if (activeGames.length > 0 && !activeGames.some((g) => g.game.id === selectedId)) {
      setSelectedId(activeGames[0]!.game.id);
    }
    if (activeGames.length === 0) {
      setSelectedId("");
    }
  }, [activeGames, selectedId]);

  const selectedIndex = activeGames.findIndex((g) => g.game.id === selectedId);
  const selected = selectedIndex >= 0 ? activeGames[selectedIndex] : undefined;
  const multipleGames = activeGames.length > 1;
  const revealFullName =
    selected != null &&
    (selected.game.status === "closed" || selected.winnersCount > 0);

  const { data: leaderboard = [], isLoading: leaderboardLoading } =
    useLeaderboardWithNumbers(selected?.game.id);
  const { data: draws = [] } = useDraws();
  const lastDrawDate = draws[0]?.draw_date;

  if (error) {
    return (
      <ErrorState
        message="No se pudo cargar los juegos activos."
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <div className="space-y-10 md:space-y-12">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Clasificación en vivo
        </h1>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : activeGames.length === 0 ? (
        <EmptyState
          title="No hay juegos para mostrar"
          description="El administrador debe crear un juego para comenzar."
        />
      ) : multipleGames ? (
        <Tabs value={selectedId} onValueChange={setSelectedId}>
          <TabsList>
            {activeGames.map((summary, i) => (
              <TabsTrigger key={summary.game.id} value={summary.game.id}>
                {displayGameLabel(summary.game.label, i + 1)}
                {summary.game.status === "closed" && (
                  <Badge variant="secondary" className="ml-1.5">
                    {gameStatusLabel("closed")}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {activeGames.map((summary, i) => (
            <TabsContent key={summary.game.id} value={summary.game.id}>
              <CycleSummaryCards
                game={summary.game}
                winnersCount={summary.winnersCount}
                fallbackIndex={i + 1}
                showIdentifier
              />
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <CycleSummaryCards
          game={activeGames[0]!.game}
          winnersCount={activeGames[0]!.winnersCount}
          fallbackIndex={1}
          showIdentifier={false}
        />
      )}

      {selected && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
            <div className="space-y-1.5">
              <CardTitle className="flex flex-wrap items-center gap-2">
                Tabla de posiciones
                {multipleGames && (
                  <span className="text-sm font-normal text-muted-foreground">
                    {displayGameLabel(selected.game.label, selectedIndex + 1)}
                  </span>
                )}
                {selected.game.status === "closed" && (
                  <Badge variant="secondary">{gameStatusLabel("closed")}</Badge>
                )}
              </CardTitle>
              <CardDescription>
                Progreso de cada jugador según los sorteos registrados.
                {lastDrawDate && (
                  <> Último sorteo cargado: {formatDate(lastDrawDate)}.</>
                )}
              </CardDescription>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={leaderboardLoading || leaderboard.length === 0}
                onClick={() =>
                  downloadLeaderboardXlsx(
                    leaderboard,
                    displayGameLabel(selected.game.label, selectedIndex + 1),
                    revealFullName,
                  )
                }
              >
                <Download />
                Descargar Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={leaderboardLoading || leaderboard.length === 0}
                onClick={() =>
                  downloadLeaderboardPdf(
                    leaderboard,
                    displayGameLabel(selected.game.label, selectedIndex + 1),
                    revealFullName,
                  )
                }
              >
                <FileText />
                Descargar PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <GameLeaderboard
              entries={leaderboard}
              isLoading={leaderboardLoading}
              revealFullName={revealFullName}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
