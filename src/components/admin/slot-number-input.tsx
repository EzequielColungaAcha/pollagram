import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { formatNumberInput, parseNumberInput } from "@/validation/schemas";
import { cn } from "@/lib/utils";

function digitsOnly(raw: string): string {
  return raw.replace(/\D/g, "").slice(0, 2);
}

function slotToNumber(slot: string): number | null {
  if (slot === "") return null;
  return parseNumberInput(slot);
}

function slotsToNumbers(slots: string[]): (number | null)[] {
  return slots.map(slotToNumber);
}

/** Normalize raw slot strings to parsed numbers for submit validation. */
export function normalizeSlots(slots: string[]): (number | null)[] {
  return slots.map((slot) => {
    const trimmed = slot.trim();
    if (trimmed === "") return null;
    return parseNumberInput(trimmed);
  });
}

interface SlotNumberInputProps {
  count?: number;
  columns?: number;
  value: (number | null)[];
  onChange: (value: (number | null)[]) => void;
  onRawChange?: (slots: string[]) => void;
  className?: string;
  showSlotLabels?: boolean;
}

export function SlotNumberInput({
  count = 10,
  value,
  onChange,
  onRawChange,
  columns,
  className,
  showSlotLabels = count <= 10,
}: SlotNumberInputProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const onRawChangeRef = useRef(onRawChange);
  onRawChangeRef.current = onRawChange;
  const [slots, setSlots] = useState<string[]>(() => Array(count).fill(""));
  const [invalidSlots, setInvalidSlots] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (value.every((n) => n == null)) {
      setSlots((prev) => {
        if (prev.every((s) => s === "")) return prev;
        const empty = Array(count).fill("");
        onRawChangeRef.current?.(empty);
        return empty;
      });
      setInvalidSlots(new Set());
      return;
    }

    setSlots((prev) => {
      const inSync = value.every((n, i) => n === slotToNumber(prev[i] ?? ""));
      if (inSync) return prev;
      const next = value.map((n) => (n == null ? "" : formatNumberInput(n)));
      onRawChangeRef.current?.(next);
      return next;
    });
    setInvalidSlots(new Set());
  }, [value, count]);

  const update = (index: number, raw: string) => {
    const digits = digitsOnly(raw);
    const parsed = digits.length === 2 ? parseNumberInput(digits) : null;
    const isInvalid = digits.length === 2 && parsed == null;

    setSlots((prev) => {
      const next = [...prev];
      next[index] = digits;
      onChange(slotsToNumbers(next));
      onRawChange?.(next);
      return next;
    });

    setInvalidSlots((prev) => {
      const next = new Set(prev);
      if (isInvalid) next.add(index);
      else next.delete(index);
      return next;
    });

    if (digits.length === 2 && !isInvalid && index < count - 1) {
      refs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && e.currentTarget.value === "" && index > 0) {
      e.preventDefault();
      setSlots((prev) => {
        const next = [...prev];
        next[index - 1] = "";
        onChange(slotsToNumbers(next));
        onRawChange?.(next);
        return next;
      });
      setInvalidSlots((prev) => {
        const next = new Set(prev);
        next.delete(index - 1);
        return next;
      });
      refs.current[index - 1]?.focus();
      return;
    }

    if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault();
      refs.current[index - 1]?.focus();
      return;
    }

    if (e.key === "ArrowRight" && index < count - 1) {
      e.preventDefault();
      refs.current[index + 1]?.focus();
    }
  };

  const handlePaste = (index: number, text: string) => {
    const parts = text
      .split(/[\s,;]+/)
      .map((p) => digitsOnly(p.trim()))
      .filter((p) => p !== "");

    if (parts.length === 0) return;

    setSlots((prev) => {
      const next = [...prev];
      const invalid = new Set<number>();
      for (let i = 0; i < parts.length && index + i < count; i++) {
        const digits = parts[i]!.slice(0, 2);
        const parsed = parseNumberInput(digits);
        if (parsed == null && digits.length === 2) {
          invalid.add(index + i);
          next[index + i] = digits;
        } else {
          next[index + i] = digits;
        }
      }
      setInvalidSlots(invalid);
      onChange(slotsToNumbers(next));
      onRawChange?.(next);
      return next;
    });

    const focusIndex = Math.min(index + parts.length, count - 1);
    refs.current[focusIndex]?.focus();
  };

  const gridStyle =
    count > 10 && columns
      ? { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }
      : undefined;

  return (
    <div
      className={cn(
        "grid gap-2 sm:gap-3",
        count <= 10 && "grid-cols-5",
        className,
      )}
      style={gridStyle}
    >
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex flex-col gap-1">
          {showSlotLabels && (
            <span className="text-center text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              {i + 1}
            </span>
          )}
          <Input
            ref={(el) => {
              refs.current[i] = el;
            }}
            inputMode="numeric"
            maxLength={2}
            placeholder="–"
            value={slots[i] ?? ""}
            onChange={(e) => update(i, e.target.value)}
            onFocus={(e) => e.target.select()}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={(e) => {
              e.preventDefault();
              handlePaste(i, e.clipboardData.getData("text"));
            }}
            className={cn(
              "h-12 w-full min-w-[2.75rem] text-center text-lg font-mono font-semibold",
              invalidSlots.has(i) && "ring-2 ring-destructive",
            )}
            aria-label={`Número ${i + 1}`}
            aria-invalid={invalidSlots.has(i)}
          />
        </div>
      ))}
    </div>
  );
}
