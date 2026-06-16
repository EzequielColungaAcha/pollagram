import { z } from "zod";

export const lotteryNumberSchema = z
  .number()
  .int()
  .min(0, "Mínimo 00")
  .max(99, "Máximo 99");

export const entryNumbersSchema = z
  .array(lotteryNumberSchema)
  .length(10, "Se requieren exactamente 10 números");

export const drawNumbersSchema = z
  .array(lotteryNumberSchema)
  .length(20, "Se requieren exactamente 20 números");

export const playerSchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido").max(100),
  nickname: z.string().trim().max(50).optional().or(z.literal("")),
});

export const entrySchema = z.object({
  playerId: z.string().uuid("Jugador inválido"),
  gameId: z.string().uuid("Juego inválido"),
  numbers: entryNumbersSchema,
});

export const drawSchema = z.object({
  drawDate: z.string().min(1, "Fecha requerida"),
  numbers: drawNumbersSchema,
});

export const gameSchema = z.object({
  label: z.string().trim().max(100).optional().or(z.literal("")),
  entryFee: z.coerce.number().min(0).optional(),
  prizePercent: z.coerce.number().min(0.01).max(1).optional(),
});

export const updateGameSchema = z.object({
  label: z.string().trim().min(1, "Nombre requerido").max(100),
  entryFee: z.coerce.number().min(0, "Cuota mínima 0"),
  prizePercent: z.coerce
    .number()
    .min(0.01, "Mínimo 1%")
    .max(1, "Máximo 100%"),
});

export const registerPlayerSchema = z.object({
  name: z.string().trim().min(1, "Nombre requerido").max(100),
  nickname: z.string().trim().max(50).optional().or(z.literal("")),
  numbers: entryNumbersSchema,
});

export const settingsSchema = z.object({
  entryFee: z.coerce.number().min(0, "Cuota mínima 0"),
  prizePercent: z.coerce
    .number()
    .min(0.01, "Mínimo 1%")
    .max(1, "Máximo 100%"),
});

export const loginSchema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
});

export type PlayerFormValues = z.infer<typeof playerSchema>;
export type EntryFormValues = z.infer<typeof entrySchema>;
export type RegisterPlayerFormValues = z.infer<typeof registerPlayerSchema>;
export type GameFormValues = z.infer<typeof gameSchema>;
export type UpdateGameFormValues = z.infer<typeof updateGameSchema>;
export type DrawFormValues = z.infer<typeof drawSchema>;
export type SettingsFormValues = z.infer<typeof settingsSchema>;
export type LoginFormValues = z.infer<typeof loginSchema>;

export function parseNumberInput(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  const num = parseInt(trimmed, 10);
  if (Number.isNaN(num) || num < 0 || num > 99) return null;
  return num;
}

export function formatNumberInput(num: number): string {
  return num.toString().padStart(2, "0");
}
