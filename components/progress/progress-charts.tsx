"use client";

import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts";
import { CHALLENGES } from "@/data/challenges";
import { DESIGNS } from "@/data/designs";
import type { ProgressState } from "@/lib/storage";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";

const ALL = [...CHALLENGES, ...DESIGNS];

const scoreConfig = {
  score: { label: "Best score", color: "var(--brand-blue)" },
} satisfies ChartConfig;

/** Best score for every attempted problem, coloured green once solved. */
export function ScoreChart({ progress }: { progress: ProgressState }) {
  const rows = ALL.filter((c) => progress.challenges[c.id]).map((c) => ({
    name: c.title,
    short: c.mode === "build" ? c.title : `#${String(c.order).padStart(2, "0")}`,
    score: progress.challenges[c.id].bestScore,
    passed: progress.challenges[c.id].passed,
  }));
  if (rows.length === 0) {
    return <p className="flex h-56 items-center justify-center text-xs text-muted-foreground">Attempt a problem to see your scores here.</p>;
  }
  return (
    <ChartContainer config={scoreConfig} className="h-56 w-full">
      <BarChart data={rows} margin={{ top: 12, left: -20, right: 4 }}>
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="short" tickLine={false} axisLine={false} tickMargin={8} interval={0} tick={{ fontSize: 10 }} />
        <YAxis domain={[0, 100]} ticks={[0, 50, 75, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
        <ChartTooltip cursor={{ fill: "oklch(1 0 0 / 4%)" }} content={<ChartTooltipContent labelKey="name" nameKey="score" />} />
        <Bar dataKey="score" radius={[6, 6, 2, 2]} maxBarSize={36}>
          {rows.map((r) => (
            <Cell key={r.name} fill={r.passed ? "var(--status-ok)" : "var(--brand-blue)"} fillOpacity={r.passed ? 0.9 : 0.75} />
          ))}
        </Bar>
      </BarChart>
    </ChartContainer>
  );
}

const diffConfig = {
  solved: { label: "Solved", color: "var(--status-ok)" },
  open: { label: "Not yet", color: "oklch(1 0 0 / 10%)" },
} satisfies ChartConfig;

/** Solved vs remaining, per difficulty. */
export function DifficultyChart({ progress }: { progress: ProgressState }) {
  const rows = (["Easy", "Medium", "Hard"] as const).map((d) => {
    const items = ALL.filter((c) => c.difficulty === d);
    const solved = items.filter((c) => progress.challenges[c.id]?.passed).length;
    return { difficulty: d, solved, open: items.length - solved };
  });
  return (
    <ChartContainer config={diffConfig} className="h-56 w-full">
      <BarChart data={rows} layout="vertical" margin={{ top: 12, left: 4, right: 12 }} barCategoryGap={18}>
        <XAxis type="number" hide allowDecimals={false} />
        <YAxis type="category" dataKey="difficulty" tickLine={false} axisLine={false} width={64} tick={{ fontSize: 12 }} />
        <ChartTooltip cursor={false} content={<ChartTooltipContent />} />
        <Bar dataKey="solved" stackId="a" fill="var(--color-solved)" radius={[6, 0, 0, 6]} />
        <Bar dataKey="open" stackId="a" fill="var(--color-open)" radius={[0, 6, 6, 0]} />
      </BarChart>
    </ChartContainer>
  );
}
