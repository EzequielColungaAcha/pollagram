import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton, Spinner } from "@/components/ui/feedback";
import { createEntry } from "@/features/admin/mutations";
import {
  fetchLastArchivedGame,
  fetchLeaderboardWithNumbers,
} from "@/features/games/api";
import {
  comparePlayerSortKeys,
  displayGameLabel,
  displayPlayerName,
  formatNumber,
  playerSortKey,
} from "@/lib/format";
import type { Game, LeaderboardEntryWithNumbers } from "@/types/database";

interface ImportFromArchivedModalProps {
  gameId: string;
  currentPlayerIds: string[];
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function ImportFromArchivedModal({
  gameId,
  currentPlayerIds,
  open,
  onClose,
  onSuccess,
}: ImportFromArchivedModalProps) {
  const [archivedGame, setArchivedGame] = useState<Game | null>(null);
  const [entries, setEntries] = useState<LeaderboardEntryWithNumbers[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState<string | null>(null);

  const currentIds = useMemo(
    () => new Set(currentPlayerIds),
    [currentPlayerIds],
  );

  const available = useMemo(
    () =>
      entries
        .filter((e) => !currentIds.has(e.player_id))
        .sort((a, b) =>
          comparePlayerSortKeys(
            playerSortKey(a.player_name, a.player_nickname),
            playerSortKey(b.player_name, b.player_nickname),
          ),
        ),
    [entries, currentIds],
  );

  const alreadyInGame = useMemo(
    () => entries.filter((e) => currentIds.has(e.player_id)),
    [entries, currentIds],
  );

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    setSelected(new Set());
    setArchivedGame(null);
    setEntries([]);
    setProgress({ done: 0, total: 0 });

    (async () => {
      try {
        const game = await fetchLastArchivedGame();
        if (cancelled) return;
        setArchivedGame(game);
        if (!game) {
          setEntries([]);
          return;
        }
        const leaderboard = await fetchLeaderboardWithNumbers(game.id);
        if (cancelled) return;
        setEntries(leaderboard);
      } catch (err) {
        if (cancelled) return;
        setError(
          err instanceof Error
            ? err.message
            : "No se pudo cargar el juego archivado",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  const close = (force = false) => {
    if (submitting && !force) return;
    setSelected(new Set());
    setError(null);
    setProgress({ done: 0, total: 0 });
    setSubmitting(false);
    onClose();
  };

  const toggle = (playerId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) next.delete(playerId);
      else next.add(playerId);
      return next;
    });
  };

  const selectAll = () => {
    setSelected(new Set(available.map((e) => e.player_id)));
  };

  const clearSelection = () => setSelected(new Set());

  const onSubmit = async () => {
    if (selected.size === 0 || submitting) return;
    const toAdd = available.filter((e) => selected.has(e.player_id));
    setSubmitting(true);
    setError(null);
    setProgress({ done: 0, total: toAdd.length });
    let added = 0;
    try {
      for (const entry of toAdd) {
        await createEntry(
          entry.player_id,
          gameId,
          entry.numbers.map((n) => n.number),
          { invalidate: false },
        );
        added += 1;
        setProgress({ done: added, total: toAdd.length });
      }
      close(true);
      onSuccess?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al agregar jugadores",
      );
      setSubmitting(false);
      if (added > 0) onSuccess?.();
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) close();
      }}
    >
      <DialogContent
        className="max-w-2xl"
        showCloseButton={!submitting}
      >
        <DialogHeader>
          <DialogTitle>Del último archivado</DialogTitle>
          <DialogDescription>
            {archivedGame
              ? `Seleccione jugadores de ${displayGameLabel(archivedGame.label)} para agregar con sus números.`
              : "Copiar jugadores y números del juego archivado más reciente."}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <Skeleton className="h-48 w-full" />
        ) : submitting ? (
          <div className="flex h-48 flex-col items-center justify-center gap-3">
            <Spinner className="size-8" />
            <p className="text-sm text-muted-foreground">
              Agregando {progress.done} de {progress.total}…
            </p>
          </div>
        ) : error && !archivedGame ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : !archivedGame ? (
          <p className="text-sm text-muted-foreground">
            No hay juegos archivados.
          </p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            El último juego archivado no tiene jugadores.
          </p>
        ) : available.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todos los jugadores del último archivado ya están en este juego.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={selectAll}
              >
                Seleccionar todos
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                disabled={selected.size === 0}
              >
                Limpiar
              </Button>
              <span className="self-center text-xs text-muted-foreground">
                {selected.size} seleccionados
              </span>
            </div>
            <ul className="max-h-72 space-y-1 overflow-y-auto rounded-md border p-2">
              {available.map((entry) => {
                const id = `import-player-${entry.player_id}`;
                const checked = selected.has(entry.player_id);
                return (
                  <li key={entry.player_id}>
                    <label
                      htmlFor={id}
                      className="flex cursor-pointer items-start gap-3 rounded-md px-2 py-2 hover:bg-muted/60"
                    >
                      <input
                        id={id}
                        type="checkbox"
                        className="mt-1 size-4 shrink-0"
                        checked={checked}
                        onChange={() => toggle(entry.player_id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">
                          {displayPlayerName(
                            entry.player_name,
                            entry.player_nickname,
                          )}
                        </span>
                        <span className="mt-0.5 block font-mono text-xs text-muted-foreground">
                          {entry.numbers
                            .map((n) => formatNumber(n.number))
                            .join(" · ")}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
            {alreadyInGame.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {alreadyInGame.length} jugador
                {alreadyInGame.length === 1 ? "" : "es"} ya en este juego
                (omitidos).
              </p>
            )}
          </div>
        )}

        {error && archivedGame && !submitting && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={close}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            disabled={submitting || loading || selected.size === 0}
            onClick={onSubmit}
          >
            {submitting
              ? "Agregando…"
              : selected.size > 0
                ? `Agregar ${selected.size}`
                : "Agregar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
