import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  registerPlayerSchema,
  type RegisterPlayerFormValues,
} from "@/validation/schemas";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  normalizeSlots,
  SlotNumberInput,
} from "@/components/admin/slot-number-input";
import { registerPlayerEntry } from "@/features/admin/mutations";

interface AddPlayerModalProps {
  gameId: string;
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function AddPlayerModal({
  gameId,
  open,
  onClose,
  onSuccess,
}: AddPlayerModalProps) {
  const [numbers, setNumbers] = useState<(number | null)[]>(Array(10).fill(null));
  const [rawSlots, setRawSlots] = useState<string[]>(Array(10).fill(""));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Pick<RegisterPlayerFormValues, "name" | "nickname">>({
    resolver: zodResolver(
      registerPlayerSchema.pick({ name: true, nickname: true }),
    ),
    defaultValues: { name: "", nickname: "" },
  });

  const close = () => {
    reset();
    setNumbers(Array(10).fill(null));
    setRawSlots(Array(10).fill(""));
    setError(null);
    onClose();
  };

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    const normalized = normalizeSlots(rawSlots);
    const parsed = registerPlayerSchema.safeParse({
      ...values,
      numbers: normalized.map((n) => n ?? -1),
    });
    if (!parsed.success) {
      setError(parsed.error.errors[0]?.message ?? "Datos inválidos");
      return;
    }

    setLoading(true);
    try {
      await registerPlayerEntry(
        gameId,
        parsed.data.name,
        parsed.data.numbers,
        parsed.data.nickname || undefined,
      );
      close();
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al registrar jugador");
    } finally {
      setLoading(false);
    }
  });

  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Agregar jugador</DialogTitle>
          <DialogDescription>
            Registre el jugador con sus 10 números (00–99).
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="playerName">Nombre</Label>
            <Input id="playerName" {...register("name")} autoFocus />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="playerNickname">Apodo (opcional)</Label>
            <Input id="playerNickname" {...register("nickname")} />
          </div>
          <div className="space-y-2">
            <Label>10 números</Label>
            <p className="text-xs text-muted-foreground">
              Dos dígitos por número (00–99). Use Tab o flechas para moverse entre casillas.
            </p>
            <SlotNumberInput
              value={numbers}
              onChange={setNumbers}
              onRawChange={setRawSlots}
            />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando…" : "Registrar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
