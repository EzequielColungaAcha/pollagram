import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAllGames, useSettings } from "@/features/games/hooks";
import { archiveGame, closeGame, createGame, openGame } from "@/features/admin/mutations";
import {
  displayGameLabel,
  formatCurrency,
  formatDateTime,
  formatPercent,
  gameStatusLabel,
} from "@/lib/format";

export function AdminGamesPage() {
  const { data: games = [], refetch } = useAllGames();
  const { data: settings } = useSettings();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [entryFee, setEntryFee] = useState("");
  const [prizePercent, setPrizePercent] = useState("");

  useEffect(() => {
    if (settings) {
      setEntryFee(String(Number(settings.entry_fee)));
      setPrizePercent(String(Number(settings.prize_percent)));
    }
  }, [settings]);

  const run = async (fn: () => Promise<unknown>) => {
    setLoading(true);
    setError(null);
    try {
      await fn();
      await refetch();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error en la operación");
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await run(async () => {
      const fee = entryFee.trim() ? Number(entryFee) : undefined;
      const pct = prizePercent.trim() ? Number(prizePercent) : undefined;
      await createGame(label.trim() || undefined, fee, pct);
      setLabel("");
      if (settings) {
        setEntryFee(String(Number(settings.entry_fee)));
        setPrizePercent(String(Number(settings.prize_percent)));
      }
    });
  };

  return (
    <div className="space-y-10 md:space-y-12">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Juegos</h1>
        <p className="text-base text-muted-foreground">
          Crear en borrador, activar para publicar, cerrar y archivar.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Nuevo juego</CardTitle>
          <CardDescription>
            Los campos vacíos usan los valores por defecto de configuración.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <form onSubmit={handleCreate} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2 sm:col-span-2 lg:col-span-4">
              <Label htmlFor="gameLabel">Nombre del juego (opcional)</Label>
              <Input
                id="gameLabel"
                placeholder="Semana 12 — Jun 2026"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                maxLength={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="createEntryFee">Cuota (opcional)</Label>
              <Input
                id="createEntryFee"
                type="number"
                min={0}
                step={1}
                value={entryFee}
                onChange={(e) => setEntryFee(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="createPrizePercent">% premio (opcional)</Label>
              <Input
                id="createPrizePercent"
                type="number"
                min={0.01}
                max={1}
                step={0.01}
                value={prizePercent}
                onChange={(e) => setPrizePercent(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={loading}>
                Nuevo juego
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Card>
        <CardHeader>
          <CardTitle>Todos los juegos</CardTitle>
          <CardDescription>Historial de juegos activos, cerrados y archivados.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          {games.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin juegos.</p>
          ) : (
            games.map((game, i) => (
              <div
                key={game.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border p-5 md:p-6"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">
                      {displayGameLabel(game.label, games.length - i)}
                    </p>
                    <Badge variant="outline">{gameStatusLabel(game.status)}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {game.player_count} jugadores · {formatCurrency(game.prize_pool)} · Cuota{" "}
                    {formatCurrency(game.entry_fee)} · Premio{" "}
                    {formatPercent(Number(game.prize_percent) * 100)}
                    {game.created_at && ` · ${formatDateTime(game.created_at)}`}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {game.status === "draft" && (
                    <>
                      <Link
                        to={`/admin/games/${game.id}`}
                        className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        Entrar
                      </Link>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={loading}
                        onClick={() => run(() => openGame(game.id))}
                      >
                        Activar
                      </Button>
                    </>
                  )}
                  {game.status === "active" && (
                    <>
                      <Link
                        to={`/admin/games/${game.id}`}
                        className="inline-flex h-8 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                      >
                        Entrar
                      </Link>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={loading}
                        onClick={() => run(() => closeGame(game.id))}
                      >
                        Cerrar
                      </Button>
                    </>
                  )}
                  {game.status === "closed" && (
                    <>
                      <Link
                        to={`/admin/games/${game.id}`}
                        className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted hover:text-foreground"
                      >
                        Ver
                      </Link>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={loading}
                        onClick={() => run(() => archiveGame(game.id))}
                      >
                        Archivar
                      </Button>
                    </>
                  )}
                  {game.status === "archived" && (
                    <Link
                      to={`/admin/games/${game.id}`}
                      className="inline-flex h-8 items-center justify-center rounded-md border border-border bg-background px-3 text-sm font-medium hover:bg-muted hover:text-foreground"
                    >
                      Ver
                    </Link>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
