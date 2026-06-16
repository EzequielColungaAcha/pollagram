import { formatNumber, sortPickNumbersAsc } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface PickSlot {
  number: number;
  matched: boolean;
}

const numberCircleClass =
  "flex size-10 items-center justify-center rounded-full p-0 font-mono text-sm font-medium leading-none tabular-nums sm:size-11 sm:text-base";

function NumberCircle({
  children,
  variant,
  matched,
  title,
}: {
  children: React.ReactNode;
  variant: "default" | "outline";
  matched?: boolean;
  title?: string;
}) {
  return (
    <Badge
      variant={variant}
      title={title}
      className={cn(numberCircleClass, matched && "bg-primary text-primary-foreground")}
    >
      {children}
    </Badge>
  );
}

export function PickSlotBadges({ numbers }: { numbers: PickSlot[] }) {
  const sorted = sortPickNumbersAsc(numbers);

  return (
    <div className="grid grid-cols-5 justify-items-center gap-2 sm:grid-cols-10 md:gap-2.5">
      {sorted.map((slot, i) => (
        <NumberCircle
          key={i}
          variant={slot.matched ? "default" : "outline"}
          matched={slot.matched}
          title={slot.matched ? "Acertado" : "Pendiente"}
        >
          {formatNumber(slot.number)}
        </NumberCircle>
      ))}
    </div>
  );
}

export function NumberGrid({
  numbers,
  columns = 10,
  matchedSet,
}: {
  numbers: number[];
  columns?: number;
  matchedSet?: Set<number>;
}) {
  return (
    <div
      className="grid justify-items-center gap-2 md:gap-2.5"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {numbers.map((num, i) => (
        <NumberCircle
          key={i}
          variant={matchedSet?.has(i) ? "default" : "outline"}
          matched={matchedSet?.has(i)}
        >
          {formatNumber(num)}
        </NumberCircle>
      ))}
    </div>
  );
}
