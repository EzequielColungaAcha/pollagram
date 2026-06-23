import { useForm } from "react-hook-form";
import {
  type DrawFormValues,
  drawSchema,
} from "@/validation/schemas";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { todayInAppTz } from "@/lib/format";
import { useState } from "react";
import {
  normalizeSlots,
  SlotNumberInput,
} from "@/components/admin/slot-number-input";

interface NumberInputGridProps {
  count: number;
  value: (number | null)[];
  onChange: (value: (number | null)[]) => void;
  onRawChange?: (slots: string[]) => void;
  columns?: number;
}

export function NumberInputGrid({
  count,
  value,
  onChange,
  onRawChange,
  columns = 5,
}: NumberInputGridProps) {
  return (
    <SlotNumberInput
      count={count}
      columns={columns}
      value={value}
      onChange={onChange}
      onRawChange={onRawChange}
      showSlotLabels={false}
    />
  );
}

function nextAvailableDrawDate(usedDates: string[]): string {
  const used = new Set(usedDates);
  const [year, month, day] = todayInAppTz().split("-").map(Number);
  const date = new Date(year, month - 1, day);
  for (let i = 0; i < 366; i += 1) {
    const iso = [
      date.getFullYear(),
      String(date.getMonth() + 1).padStart(2, "0"),
      String(date.getDate()).padStart(2, "0"),
    ].join("-");
    if (!used.has(iso)) return iso;
    date.setDate(date.getDate() + 1);
  }
  return todayInAppTz();
}

export function DrawEntryForm({
  onSubmit,
  loading,
  usedDates = [],
  submitError,
}: {
  onSubmit: (values: DrawFormValues) => Promise<void>;
  loading?: boolean;
  usedDates?: string[];
  submitError?: string | null;
}) {
  const [numbers, setNumbers] = useState<(number | null)[]>(
    Array(20).fill(null),
  );
  const [rawSlots, setRawSlots] = useState<string[]>(Array(20).fill(""));
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<{ drawDate: string }>({
    defaultValues: { drawDate: nextAvailableDrawDate(usedDates) },
  });

  const displayError = error ?? submitError ?? null;

  const submit = handleSubmit(async ({ drawDate }) => {
    setError(null);
    if (usedDates.includes(drawDate)) {
      setError("Ya existe un sorteo para esta fecha.");
      return;
    }
    const normalized = normalizeSlots(rawSlots);
    const result = drawSchema.safeParse({
      drawDate,
      numbers: normalized.map((n) => n ?? -1),
    });
    if (!result.success) {
      setError(result.error.errors[0]?.message ?? "Datos inválidos");
      return;
    }
    try {
      await onSubmit(result.data);
      setNumbers(Array(20).fill(null));
      setRawSlots(Array(20).fill(""));
    } catch {
      // Parent surfaces server errors via submitError.
    }
  });

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="drawDate">Fecha del sorteo</Label>
        <Input id="drawDate" type="date" {...register("drawDate")} />
        {errors.drawDate && (
          <p className="mt-1 text-sm text-destructive">{errors.drawDate.message}</p>
        )}
      </div>
      <div className="space-y-2">
        <Label>20 números del sorteo</Label>
        <p className="text-xs text-muted-foreground">
          Dos dígitos por número (00–99).
        </p>
        <NumberInputGrid
          count={20}
          value={numbers}
          onChange={setNumbers}
          onRawChange={setRawSlots}
          columns={5}
        />
      </div>
      {displayError && <p className="text-sm text-destructive">{displayError}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? "Registrando…" : "Registrar sorteo"}
      </Button>
    </form>
  );
}

export function PlayerEntryForm({
  players,
  gameId,
  onCreatePlayer,
  onCreateEntry,
  loading,
}: {
  players: Array<{ id: string; name: string; nickname: string | null }>;
  gameId: string;
  onCreatePlayer: (name: string, nickname?: string) => Promise<void>;
  onCreateEntry: (playerId: string, numbers: number[]) => Promise<void>;
  loading?: boolean;
}) {
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [playerId, setPlayerId] = useState("");
  const [name, setName] = useState("");
  const [nickname, setNickname] = useState("");
  const [numbers, setNumbers] = useState<(number | null)[]>(Array(10).fill(null));
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const parsedNumbers = numbers.map((n) => n ?? -1);
    try {
      if (mode === "new") {
        if (!name.trim()) {
          setError("Nombre requerido");
          return;
        }
        await onCreatePlayer(name, nickname || undefined);
        setMode("existing");
        setError("Jugador creado. Selecciónelo de la lista para registrar números.");
        return;
      }
      if (!playerId) {
        setError("Seleccione un jugador");
        return;
      }
      const { entrySchema } = await import("@/validation/schemas");
      const result = entrySchema.safeParse({
        playerId,
        gameId,
        numbers: parsedNumbers,
      });
      if (!result.success) {
        setError(result.error.errors[0]?.message ?? "Datos inválidos");
        return;
      }
      await onCreateEntry(playerId, result.data.numbers);
      setNumbers(Array(10).fill(null));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar");
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="flex gap-2">
        <Button
          type="button"
          variant={mode === "existing" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("existing")}
        >
          Jugador existente
        </Button>
        <Button
          type="button"
          variant={mode === "new" ? "default" : "outline"}
          size="sm"
          onClick={() => setMode("new")}
        >
          Nuevo jugador
        </Button>
      </div>

      {mode === "new" ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Nombre</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label>Apodo (opcional)</Label>
            <Input value={nickname} onChange={(e) => setNickname(e.target.value)} />
          </div>
        </div>
      ) : (
        <>
          <div>
            <Label>Jugador</Label>
            <select
              className={cn(
                "flex h-10 w-full rounded-md border border-border bg-input px-3 text-sm",
              )}
              value={playerId}
              onChange={(e) => setPlayerId(e.target.value)}
            >
              <option value="">Seleccionar…</option>
              {players.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nickname ? `${p.name} (${p.nickname})` : p.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label>10 números</Label>
            <NumberInputGrid count={10} value={numbers} onChange={setNumbers} columns={5} />
          </div>
        </>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" disabled={loading}>
        {loading ? "Guardando…" : mode === "new" ? "Crear jugador" : "Registrar entrada"}
      </Button>
    </form>
  );
}
