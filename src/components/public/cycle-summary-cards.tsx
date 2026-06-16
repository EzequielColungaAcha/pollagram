import { formatCurrency, displayGameLabel } from "@/lib/format";
import type { Game } from "@/types/database";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Trophy, TrendingUp, Users, Wallet } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string;
  icon?: React.ReactNode;
}

export function MetricCard({ label, value, icon }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="gap-3 pb-0">
        <div className="flex items-center justify-between gap-3">
          <CardDescription className="text-sm">{label}</CardDescription>
          {icon && (
            <span className="rounded-lg bg-muted p-2.5 text-muted-foreground [&_svg]:size-4">
              {icon}
            </span>
          )}
        </div>
        <CardTitle className="text-3xl font-semibold tracking-tight tabular-nums">
          {value}
        </CardTitle>
      </CardHeader>
      <CardContent className="hidden" />
    </Card>
  );
}

export function CycleSummaryCards({
  game,
  winnersCount,
  fallbackIndex,
  showIdentifier = true,
}: {
  game: Game | null;
  winnersCount: number;
  fallbackIndex?: number;
  showIdentifier?: boolean;
}) {
  if (!game) {
    const labels = showIdentifier
      ? ["Juego", "Jugadores", "Premio", "Ganadores"]
      : ["Jugadores", "Premio", "Ganadores"];
    return (
      <div
        className={
          showIdentifier
            ? "grid gap-5 sm:grid-cols-2 md:gap-6 lg:grid-cols-4"
            : "grid gap-5 sm:grid-cols-2 md:gap-6 lg:grid-cols-3"
        }
      >
        {labels.map((label) => (
          <MetricCard key={label} label={label} value="—" />
        ))}
      </div>
    );
  }

  const metrics = [
    ...(showIdentifier
      ? [
          {
            label: "Identificador",
            value: displayGameLabel(game.label, fallbackIndex),
            icon: <TrendingUp />,
          },
        ]
      : []),
    {
      label: "Jugadores",
      value: String(game.player_count),
      icon: <Users />,
    },
    {
      label: "Premio acumulado",
      value: formatCurrency(game.prize_pool),
      icon: <Wallet />,
    },
    {
      label: "Ganadores",
      value: String(winnersCount),
      icon: <Trophy />,
    },
  ];

  return (
    <div
      className={
        showIdentifier
          ? "grid gap-5 sm:grid-cols-2 md:gap-6 lg:grid-cols-4"
          : "grid gap-5 sm:grid-cols-2 md:gap-6 lg:grid-cols-3"
      }
    >
      {metrics.map((metric) => (
        <MetricCard
          key={metric.label}
          label={metric.label}
          value={metric.value}
          icon={metric.icon}
        />
      ))}
    </div>
  );
}

export { formatCurrency };
