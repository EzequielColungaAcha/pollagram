import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { PlayerEntryForm } from "@/components/admin/forms";
import { useActiveGame, usePlayers } from "@/features/games/hooks";
import { createEntry, createPlayer } from "@/features/admin/mutations";

export function AdminPlayersPage() {
  const { data: summary } = useActiveGame();
  const { data: players = [], refetch } = usePlayers();
  const [loading, setLoading] = useState(false);
  const gameId = summary?.game?.id;

  if (!gameId) {
    return (
      <EmptyState
        title="No hay juego activo"
        description="Abra un juego en la sección Juegos antes de registrar jugadores."
      />
    );
  }

  return (
    <div className="space-y-10 md:space-y-12">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Jugadores</h1>
        <p className="text-base text-muted-foreground">
          Registrar jugadores y entradas con 10 números.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nueva entrada</CardTitle>
        </CardHeader>
        <CardContent>
          <PlayerEntryForm
            players={players}
            gameId={gameId}
            loading={loading}
            onCreatePlayer={async (name, nickname) => {
              setLoading(true);
              try {
                await createPlayer(name, nickname);
                await refetch();
              } finally {
                setLoading(false);
              }
            }}
            onCreateEntry={async (playerId, numbers) => {
              setLoading(true);
              try {
                await createEntry(playerId, gameId, numbers);
              } finally {
                setLoading(false);
              }
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
}
