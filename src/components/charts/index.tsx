import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const chartStyle = {
  fontSize: 12,
  fill: "oklch(0.65 0.02 260)",
};

export function ChartDailyMatches({
  data,
}: {
  data: Array<{ date: string; matches: number }>;
}) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Sin datos</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.03 260)" />
        <XAxis dataKey="date" tick={chartStyle} />
        <YAxis tick={chartStyle} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            background: "oklch(0.17 0.025 260)",
            border: "1px solid oklch(0.28 0.03 260)",
            borderRadius: 8,
          }}
        />
        <Bar dataKey="matches" fill="oklch(0.72 0.19 160)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ChartPlayerProgress({
  data,
}: {
  data: Array<{ matched: number; count: number }>;
}) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Sin datos</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.03 260)" />
        <XAxis dataKey="matched" tick={chartStyle} label={{ value: "Acertados", position: "insideBottom", offset: -4 }} />
        <YAxis tick={chartStyle} allowDecimals={false} />
        <Tooltip contentStyle={{ background: "oklch(0.17 0.025 260)", border: "1px solid oklch(0.28 0.03 260)", borderRadius: 8 }} />
        <Bar dataKey="count" fill="oklch(0.75 0.15 200)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ChartParticipation({
  data,
}: {
  data: Array<{ label: string; players: number }>;
}) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Sin datos</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.03 260)" />
        <XAxis dataKey="label" tick={chartStyle} interval={0} angle={-20} textAnchor="end" height={60} />
        <YAxis tick={chartStyle} allowDecimals={false} />
        <Tooltip contentStyle={{ background: "oklch(0.17 0.025 260)", border: "1px solid oklch(0.28 0.03 260)", borderRadius: 8 }} />
        <Bar dataKey="players" fill="oklch(0.72 0.19 160)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function ChartPrizeGrowth({
  data,
}: {
  data: Array<{ label: string; prize: number }>;
}) {
  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">Sin datos</p>;
  }
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.28 0.03 260)" />
        <XAxis dataKey="label" tick={chartStyle} interval={0} angle={-20} textAnchor="end" height={60} />
        <YAxis tick={chartStyle} />
        <Tooltip contentStyle={{ background: "oklch(0.17 0.025 260)", border: "1px solid oklch(0.28 0.03 260)", borderRadius: 8 }} />
        <Line type="monotone" dataKey="prize" stroke="oklch(0.78 0.22 145)" strokeWidth={2} dot={{ r: 3 }} />
      </LineChart>
    </ResponsiveContainer>
  );
}
