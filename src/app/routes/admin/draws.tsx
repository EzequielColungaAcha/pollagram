import { useActiveGames, useDraws } from "@/features/games/hooks";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/feedback";
import { DrawEntryForm } from "@/components/admin/forms";
import { NumberGrid } from "@/components/public/pick-slot-badges";
import { enterDraw, invalidateDraw } from "@/features/admin/mutations";
import { formatDate } from "@/lib/format";
import type { DrawFormValues } from "@/validation/schemas";
import { useState } from "react";

export function AdminDrawsPage() {
  const { data: activeGames = [] } = useActiveGames();
  const activeOnly = activeGames.filter((g) => g.game.status === "active");
  const { data: draws = [], refetch } = useDraws();
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const usedDates = draws
    .filter((d) => !d.is_invalidated)
    .map((d) => d.draw_date);

  if (activeOnly.length === 0) {
    return (
      <EmptyState
        title="No hay juegos activos"
        description="Cree un juego para registrar sorteos diarios."
      />
    );
  }

  const handleSubmit = async (values: DrawFormValues) => {
    setSubmitError(null);
    setLoading(true);
    try {
      await enterDraw(values.drawDate, values.numbers);
      await refetch();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al registrar sorteo";
      if (
        message.includes("draws_one_date_idx") ||
        message.includes("duplicate key")
      ) {
        setSubmitError("Ya existe un sorteo para esta fecha.");
      } else {
        setSubmitError(message);
      }
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleInvalidate = async (drawId: string) => {
    if (!confirm("¿Invalidar este sorteo? Se revertirán los aciertos asociados.")) return;
    setLoading(true);
    try {
      await invalidateDraw(drawId);
      await refetch();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-10 md:space-y-12">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Sorteos</h1>
        <p className="text-base text-muted-foreground">
          Ingresar 20 números del sorteo diario. Aplica a todos los juegos activos (
          {activeOnly.length}).
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Registrar sorteo</CardTitle>
          <CardDescription>
            Ingrese la fecha y los 20 números del sorteo diario.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <DrawEntryForm
            onSubmit={handleSubmit}
            loading={loading}
            usedDates={usedDates}
            submitError={submitError}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Sorteos registrados</CardTitle>
          <CardDescription>Sorteos activos aplicados a los juegos en curso.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 pt-2">
          {draws.filter((d) => !d.is_invalidated).length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin sorteos aún.</p>
          ) : (
            draws
              .filter((d) => !d.is_invalidated)
              .map((draw) => (
                <div key={draw.id} className="rounded-lg border border-border p-5 md:p-6">
                  <div className="mb-4 flex items-center justify-between">
                    <p className="font-medium">{formatDate(draw.draw_date)}</p>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={loading}
                      onClick={() => handleInvalidate(draw.id)}
                    >
                      Invalidar
                    </Button>
                  </div>
                  <NumberGrid numbers={draw.numbers.map((n) => n.number)} columns={10} />
                </div>
              ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
