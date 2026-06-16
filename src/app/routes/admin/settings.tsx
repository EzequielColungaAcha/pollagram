import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { settingsSchema, type SettingsFormValues } from "@/validation/schemas";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/feedback";
import { useSettings } from "@/features/games/hooks";
import { updateSettings } from "@/features/admin/mutations";
import { useEffect } from "react";

export function AdminSettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
  });

  useEffect(() => {
    if (settings) {
      reset({
        entryFee: Number(settings.entry_fee),
        prizePercent: Number(settings.prize_percent),
      });
    }
  }, [settings, reset]);

  const onSubmit = handleSubmit(async (values) => {
    setLoading(true);
    setMessage(null);
    try {
      await updateSettings(values.entryFee, values.prizePercent);
      setMessage("Configuración guardada.");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Error al guardar");
    } finally {
      setLoading(false);
    }
  });

  if (isLoading) return <Skeleton className="h-48 w-full max-w-lg" />;

  return (
    <div className="space-y-10 md:space-y-12">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Configuración</h1>
        <p className="text-base text-muted-foreground">
          Valores por defecto para juegos nuevos (cuota y porcentaje del premio).
        </p>
      </div>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Parámetros por defecto</CardTitle>
          <CardDescription>
            Se aplican al crear un juego sin especificar cuota o porcentaje.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <form onSubmit={onSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label>Cuota de entrada</Label>
              <Input type="number" min={0} step={1} {...register("entryFee")} />
              {errors.entryFee && (
                <p className="text-sm text-destructive">{errors.entryFee.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Porcentaje del premio (0.01 – 1.00)</Label>
              <Input
                type="number"
                min={0.01}
                max={1}
                step={0.01}
                {...register("prizePercent")}
              />
              {errors.prizePercent && (
                <p className="text-sm text-destructive">{errors.prizePercent.message}</p>
              )}
            </div>
            {message && (
              <p className={message.includes("Error") ? "text-destructive" : "text-primary"}>
                {message}
              </p>
            )}
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando…" : "Guardar"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
