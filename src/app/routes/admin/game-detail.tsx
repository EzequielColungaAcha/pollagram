import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { CycleSummaryCards } from "@/components/public/cycle-summary-cards";
import { LeaderboardTable } from "@/components/public/leaderboard-table";
import { AddPlayerModal } from "@/components/admin/add-player-modal";
import { EditPlayerModal } from "@/components/admin/edit-player-modal";
import { ImportFromArchivedModal } from "@/components/admin/import-from-archived-modal";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton, ErrorState } from "@/components/ui/feedback";
import {
  useGameDetail,
  useLeaderboardWithNumbers,
} from "@/features/games/hooks";
import { closeGame, deletePlayerEntry, openGame, updateGame } from "@/features/admin/mutations";
import { useQueryClient } from "@tanstack/react-query";
import { displayGameLabel, formatCurrency, formatDate, formatPercent, gameStatusLabel } from "@/lib/format";
import {
  updateGameSchema,
  type UpdateGameFormValues,
} from "@/validation/schemas";
import { useEffect } from "react";
import type { LeaderboardEntryWithNumbers } from "@/types/database";

export function AdminGameDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { data: game, isLoading, error, refetch } = useGameDetail(id);
  const { data: leaderboard, isLoading: lbLoading } = useLeaderboardWithNumbers(id);
  const [modalOpen, setModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LeaderboardEntryWithNumbers | null>(null);
  const [closing, setClosing] = useState(false);
  const [opening, setOpening] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateGameFormValues>({
    resolver: zodResolver(updateGameSchema),
  });

  useEffect(() => {
    if (game) {
      reset({
        label: game.label,
        startDate: game.start_date,
        entryFee: Number(game.entry_fee),
        prizePercent: Number(game.prize_percent),
      });
    }
  }, [game, reset]);

  if (error) {
    return (
      <ErrorState message="No se pudo cargar el juego." onRetry={() => refetch()} />
    );
  }

  if (isLoading || !game) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const winnersCount = game.entries.filter((e) => e.is_winner).length;
  const isActive = game.status === "active";
  const isDraft = game.status === "draft";
  const canManage = isActive || isDraft;

  const handleOpen = async () => {
    if (!confirm("¿Activar este juego? Será visible en la página pública.")) return;
    setOpening(true);
    try {
      await openGame(game.id);
      await refetch();
    } finally {
      setOpening(false);
    }
  };

  const handleClose = async () => {
    if (!confirm("¿Cerrar este juego?")) return;
    setClosing(true);
    try {
      await closeGame(game.id);
      await refetch();
    } finally {
      setClosing(false);
    }
  };

  const handleSaveSettings = handleSubmit(async (values) => {
    setSaving(true);
    setSaveMessage(null);
    try {
      await updateGame(game.id, {
        label: values.label,
        startDate: values.startDate,
        entryFee: values.entryFee,
        prizePercent: values.prizePercent,
      });
      await refetch();
      setSaveMessage("Cambios guardados.");
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setSaving(false);
    }
  });

  const invalidate = () => {
    queryClient.invalidateQueries();
  };

  const handleDeletePlayer = async (entry: LeaderboardEntryWithNumbers) => {
    const label = entry.player_nickname ?? entry.player_name;
    if (!confirm(`¿Eliminar a ${label} de este juego?`)) return;
    await deletePlayerEntry(entry.entry_id);
    invalidate();
  };

  return (
    <div className="space-y-10 md:space-y-12">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link to="/admin/games" className="text-sm text-primary hover:underline">
            ← Juegos
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
              {displayGameLabel(game.label)}
            </h1>
            {!isActive && (
              <Badge variant="secondary">{gameStatusLabel(game.status)}</Badge>
            )}
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {isDraft
              ? "Borrador — no visible públicamente hasta activar."
              : isActive
                ? "Activo — los jugadores pueden agregarse, editarse o eliminarse."
                : "Solo lectura — el juego ya no admite cambios."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canManage && (
            <>
              <Button onClick={() => setModalOpen(true)}>Agregar jugador</Button>
              <Button variant="outline" onClick={() => setImportModalOpen(true)}>
                Del último archivado
              </Button>
            </>
          )}
          {isDraft && (
            <Button disabled={opening} onClick={handleOpen}>
              {opening ? "Activando…" : "Activar juego"}
            </Button>
          )}
          {isActive && (
            <>
              <Button variant="outline" disabled={closing} onClick={handleClose}>
                Cerrar juego
              </Button>
              <Link
                to="/admin/draws"
                className="inline-flex h-10 items-center justify-center rounded-md bg-secondary px-4 text-sm font-medium text-secondary-foreground hover:bg-secondary/80"
              >
                Registrar sorteo
              </Link>
            </>
          )}
        </div>
      </div>

      {canManage ? (
        <Card>
          <CardHeader>
            <CardTitle>Configuración del juego</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSaveSettings} className="grid gap-4 sm:grid-cols-3">
              <div className="sm:col-span-3">
                <Label htmlFor="gameLabel">Nombre</Label>
                <Input id="gameLabel" {...register("label")} />
                {errors.label && (
                  <p className="mt-1 text-sm text-destructive">{errors.label.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="startDate">Fecha de inicio</Label>
                <Input id="startDate" type="date" {...register("startDate")} />
                {errors.startDate && (
                  <p className="mt-1 text-sm text-destructive">{errors.startDate.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="entryFee">Cuota de entrada</Label>
                <Input
                  id="entryFee"
                  type="number"
                  min={0}
                  step={1}
                  {...register("entryFee")}
                />
                {errors.entryFee && (
                  <p className="mt-1 text-sm text-destructive">{errors.entryFee.message}</p>
                )}
              </div>
              <div>
                <Label htmlFor="prizePercent">% premio (0.01 – 1.00)</Label>
                <Input
                  id="prizePercent"
                  type="number"
                  min={0.01}
                  max={1}
                  step={0.01}
                  {...register("prizePercent")}
                />
                {errors.prizePercent && (
                  <p className="mt-1 text-sm text-destructive">
                    {errors.prizePercent.message}
                  </p>
                )}
              </div>
              <div className="flex items-end">
                <Button type="submit" disabled={saving}>
                  {saving ? "Guardando…" : "Guardar"}
                </Button>
              </div>
              {saveMessage && (
                <p
                  className={`sm:col-span-3 text-sm ${saveMessage.includes("Error") ? "text-destructive" : "text-primary"}`}
                >
                  {saveMessage}
                </p>
              )}
            </form>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Configuración del juego</CardTitle>
            <CardDescription>Solo lectura.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 text-sm sm:grid-cols-4">
            <p>
              <span className="text-muted-foreground">Nombre: </span>
              {displayGameLabel(game.label)}
            </p>
            <p>
              <span className="text-muted-foreground">Inicio: </span>
              {formatDate(game.start_date)}
            </p>
            <p>
              <span className="text-muted-foreground">Cuota: </span>
              {formatCurrency(game.entry_fee)}
            </p>
            <p>
              <span className="text-muted-foreground">% premio: </span>
              {formatPercent(Number(game.prize_percent) * 100)}
            </p>
          </CardContent>
        </Card>
      )}

      <CycleSummaryCards game={game} winnersCount={winnersCount} />

      <Card>
        <CardHeader>
          <CardTitle>Jugadores</CardTitle>
        </CardHeader>
        <CardContent>
          {lbLoading ? (
            <Skeleton className="h-48" />
          ) : (
            <LeaderboardTable
              entries={leaderboard ?? []}
              editable={canManage}
              onEdit={setEditingEntry}
              onDelete={handleDeletePlayer}
            />
          )}
        </CardContent>
      </Card>

      <AddPlayerModal
        gameId={game.id}
        open={modalOpen && canManage}
        onClose={() => setModalOpen(false)}
        onSuccess={invalidate}
      />

      <ImportFromArchivedModal
        gameId={game.id}
        currentPlayerIds={(leaderboard ?? []).map((e) => e.player_id)}
        open={importModalOpen && canManage}
        onClose={() => setImportModalOpen(false)}
        onSuccess={invalidate}
      />

      <EditPlayerModal
        entry={editingEntry}
        open={editingEntry !== null}
        onClose={() => setEditingEntry(null)}
        onSuccess={invalidate}
      />
    </div>
  );
}
