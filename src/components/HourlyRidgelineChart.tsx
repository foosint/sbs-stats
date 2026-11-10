import { useMemo, useState } from "react";
import { ComposedChart, Area, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import type { DailyDaySeries, Metric, StatKey } from "@/types";
import { useTheme } from "@/hooks/useTheme";
import { ChartCard } from "@/components/ChartCard";
import { MetricSelect } from "@/components/MetricSelect";
import { hourlyIncrements } from "@/utils/hourly";
import { FONTS } from "@/theme";

interface Props {
  data: DailyDaySeries[];
  metrics: Metric[];
  metricKey: StatKey;
  onMetricChange: (key: StatKey) => void;
}

// Each day sits on its own baseline, one unit apart. The 99th-percentile hourly increment in
// view is `overlap` units tall, so ridges overlap the rows above them; scaling by the 99th
// percentile rather than the max keeps one outlier hour from flattening every other ridge.
// Few days get taller rows, so they need less overlap (7d → 1.5 rows, 30d+ → 5 rows).
const overlapFor = (days: number) => Math.min(5, Math.max(1.5, days / 6));
const SCALE_PERCENTILE = 0.99;
const MAX_DATE_TICKS = 8;
const HOUR_TICKS = [0, 3, 6, 9, 12, 15, 18, 21, 23];
const rawKey = (date: string) => `${date}__v`;
const topKey = (date: string) => `${date}__top`;

// Blend two #rrggbb colors (k = 0 → a, 1 → b). Ridge fills must be opaque to hide the ridges
// behind them, so tints are mixed into the card color instead of using fillOpacity.
function mix(a: string, b: string, k: number): string {
  const ch = (hex: string, i: number) => parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16);
  return "#" + [0, 1, 2]
    .map((i) => Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * k).toString(16).padStart(2, "0"))
    .join("");
}

type Row = Record<string, number | [number, number] | null>;

// Ridgeline: one ridge per day (oldest at the top, today in front), height = value added per hour.
// Recharts has no ridgeline type, so each ridge is a range Area from its baseline to baseline + value.
export function HourlyRidgelineChart({ data, metrics, metricKey, onMetricChange }: Props) {
  const { theme: t } = useTheme();
  const [hovered, setHovered] = useState<string | null>(null);
  const label = metrics.find((m) => m.key === metricKey)?.label ?? metricKey;
  const pastCount = data.filter((s) => !s.is_today).length;
  const n = data.length;
  const overlap = overlapFor(n);

  // data is sorted oldest → newest (today last), so baselines count down to 0 at the front
  const { rows, baselines } = useMemo(() => {
    const incs = data.map(hourlyIncrements);
    const sorted = incs.flat().filter((v): v is number => v != null).sort((a, b) => a - b);
    const max = Math.max(1, sorted[Math.floor((sorted.length - 1) * SCALE_PERCENTILE)] ?? 0);
    const baselines = new Map(data.map((s, i) => [s.date, n - 1 - i]));
    const rows: Row[] = Array.from({ length: 24 }, (_, hour) => {
      const row: Row = { hour };
      data.forEach((s, i) => {
        const v = incs[i][hour];
        const base = baselines.get(s.date)!;
        const top = v == null ? null : base + (v / max) * overlap;
        row[s.date] = top == null ? null : [base, top];
        row[topKey(s.date)] = top;
        row[rawKey(s.date)] = v;
      });
      return row;
    });
    return { rows, baselines };
  }, [data, n, overlap]);

  const tickStep = Math.max(1, Math.ceil(n / MAX_DATE_TICKS));
  const dateTicks = data.filter((_, i) => (n - 1 - i) % tickStep === 0).map((s) => baselines.get(s.date)!);
  const dateAt = new Map(data.map((s) => [baselines.get(s.date)!, s.date]));
  // Older days fade toward the faint text color, newer ones toward the primary accent
  const age = (i: number) => (n <= 1 ? 1 : i / (n - 1));
  const strokeFor = (i: number) => mix(t.textFaint, t.primary, 0.5 + 0.5 * age(i));

  return (
    <ChartCard title={`${label} — per hour, by day`} wfull>
      <div style={{ display: "flex", gap: 16, marginBottom: 10, fontFamily: FONTS.mono, fontSize: 10, alignItems: "center", flexWrap: "wrap" }}>
        <MetricSelect metrics={metrics} value={metricKey} onChange={onMetricChange} ariaLabel="Metric for the ridgeline chart" />
        <span style={{ color: t.accent, fontWeight: 700 }}>— TODAY</span>
        <span style={{ color: t.textMuted }}>{pastCount} previous day{pastCount !== 1 ? "s" : ""}</span>
        <span style={{ color: t.textFaint }}>ridge height = added in that hour</span>
      </div>
      <ResponsiveContainer width="100%" height={Math.max(260, n * 10 + 120)}>
        <ComposedChart data={rows} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} onMouseLeave={() => setHovered(null)}>
          <XAxis dataKey="hour" type="number" domain={[0, 23]} ticks={HOUR_TICKS} interval={0}
            tick={{ fontSize: 10, fill: t.textMuted, fontFamily: FONTS.mono }} tickLine={false} axisLine={false} />
          <YAxis type="number" domain={[0, n - 1 + overlap]} allowDataOverflow ticks={dateTicks} interval={0} width={78}
            tickFormatter={(v: number) => dateAt.get(v) ?? ""}
            tick={{ fontSize: 10, fill: t.textMuted, fontFamily: FONTS.mono }} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ stroke: t.border, strokeDasharray: "2 4" }}
            content={({ active, label: hour, payload }) => {
              if (!active || hovered == null || hour == null || !payload?.length) return null;
              const v = (payload[0].payload as Row)[rawKey(hovered)];
              if (v == null) return null;
              const hh = String(hour).padStart(2, "0");
              return (
                <div style={{
                  background: t.surface, border: `1px solid ${t.border}`, borderRadius: 6,
                  padding: "6px 8px", fontFamily: FONTS.mono, fontSize: 10, color: t.textMuted,
                  boxShadow: "0 4px 20px rgba(0,0,0,0.22)",
                }}>
                  <div>{hovered} · {hh}:00–{hh}:59</div>
                  <div style={{ color: t.text, fontWeight: 700 }}>+{(v as number).toLocaleString()}</div>
                </div>
              );
            }}
          />
          {/* Oldest first: later children paint on top, so nearer (newer) ridges cover older ones.
              The fill is an unstroked range Area (stroking it would also draw its flat baseline);
              the ridge outline is a separate Line along the top edge. */}
          {data.flatMap((s, i) => {
            const isHovered = hovered === s.date;
            const color = s.is_today ? t.accent : strokeFor(i);
            return [
              <Area key={s.date} dataKey={s.date} type="monotone"
                fill={mix(t.surface, color, isHovered ? 0.55 : 0.38)} fillOpacity={1} stroke="none"
                dot={false} activeDot={false} isAnimationActive={false}
                onMouseEnter={() => setHovered(s.date)}
              />,
              <Line key={topKey(s.date)} dataKey={topKey(s.date)} type="monotone"
                stroke={isHovered && !s.is_today ? t.text : color}
                strokeWidth={s.is_today ? 2.5 : isHovered ? 2 : 1.2}
                dot={false} activeDot={false} isAnimationActive={false}
              />,
            ];
          })}
        </ComposedChart>
      </ResponsiveContainer>
    </ChartCard>
  );
}
