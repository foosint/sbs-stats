import { useState, useMemo, useEffect, lazy, Suspense } from "react";
import { useDatabaseContext } from "@/context/useDatabaseContext";
import { useTheme } from "@/hooks/useTheme";
import { HourlyLineChart } from "@/components/HourlyLineChart";
import { HourlyRidgelineChart } from "@/components/HourlyRidgelineChart";
import { ChartGrid, LoadingScreen, ErrorScreen } from "@/components/Layout";
import { buildMetrics } from "@/utils/metrics";
import type { DailyRow, DailyDaySeries, GlobalStats, StatKey, Metric } from "@/types";
import { FONTS } from "@/theme";

const DAY_OPTIONS = [7, 14, 30, 60] as const;
type DayOption = (typeof DAY_OPTIONS)[number];

// WebGL/plotly is heavy, so the 3D chart is its own chunk and doesn't hold up the 2D charts
const HourlySurfaceChart = lazy(() => import("@/components/HourlySurfaceChart"));

interface HourlyPageProps {
  refreshKey?: number;
}

function makeDataset(rows: DailyRow[], key: StatKey): DailyDaySeries[] {
  const map = new Map<string, DailyDaySeries>();
  for (const row of rows) {
    if (!map.has(row.date)) map.set(row.date, { date: row.date, is_today: row.is_today, points: [] });
    map.get(row.date)!.points.push({ hour: row.hour, value: (row[key] as number) ?? 0 });
  }
  for (const s of map.values()) s.points.sort((a, b) => a.hour - b.hour);
  return Array.from(map.values()).sort((a, b) => {
    if (a.is_today) return 1;
    if (b.is_today) return -1;
    return a.date.localeCompare(b.date);
  });
}

export function HourlyPage({ refreshKey }: HourlyPageProps) {
  const { theme: t } = useTheme();
  const { loadState, error, queryHourly, queryGlobalStats } = useDatabaseContext();
  const [days, setDays] = useState<DayOption>(60);
  const [rows, setRows] = useState<DailyRow[]>([]);
  const [globalStats, setGlobalStats] = useState<GlobalStats>({} as GlobalStats);
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    if (loadState === "ready") setGlobalStats(queryGlobalStats());
  }, [loadState, queryGlobalStats, refreshKey]);

  useEffect(() => {
    if (loadState === "ready") { setRows(queryHourly(days)); setHasData(true); }
  }, [loadState, days, queryHourly, refreshKey]);

  const metrics = useMemo<Metric[]>(() => buildMetrics(), []);
  const [surfaceKey, setSurfaceKey] = useState<StatKey>("total_personnel_casualties");
  // Memoized so the 3D chart only redraws when its data actually changes
  const surfaceData = useMemo(() => makeDataset(rows, surfaceKey), [rows, surfaceKey]);
  const [ridgeKey, setRidgeKey] = useState<StatKey>("total_personnel_casualties");
  const ridgeData = useMemo(() => makeDataset(rows, ridgeKey), [rows, ridgeKey]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 24, color: t.text }}>
            Hourly Statistics
          </h1>
          <p style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.textMuted, marginTop: 3 }}>
            Each line = one day · X-axis = hour · 3D view stacks the days by date · MAX/MEDIAN based on all days with data · {new Date().toDateString()}
          </p>
          <p style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.bgImportant, marginTop: 3}}>The red line is based on preliminary figures for today and is subject to changes (which will then be reflected in the corresponding gray line on the next day)</p>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {DAY_OPTIONS.map((d) => (
            <button key={d} onClick={() => setDays(d)} style={{
              background: days === d ? t.accent : t.bgAlt,
              color: days === d ? "#fff" : t.textMuted,
              border: `1px solid ${days === d ? t.accent : t.border}`,
              borderRadius: 4, padding: "5px 12px",
              fontFamily: FONTS.mono, fontSize: 11,
              fontWeight: days === d ? 700 : 400,
              cursor: "pointer", transition: "all 0.15s",
            }}>{d}d</button>
          ))}
        </div>
      </div>
      {loadState === "loading" && !hasData && <LoadingScreen />}
      {loadState === "error" && <ErrorScreen message={error ?? "Unknown error"} />}
      {(loadState === "ready" || hasData) && (
        <ChartGrid>
          <Suspense fallback={null}>
            <HourlySurfaceChart
              data={surfaceData}
              metrics={metrics}
              metricKey={surfaceKey}
              onMetricChange={setSurfaceKey}
            />
          </Suspense>
          <HourlyRidgelineChart
            data={ridgeData}
            metrics={metrics}
            metricKey={ridgeKey}
            onMetricChange={setRidgeKey}
          />
          {metrics.map((m: Metric) => (
            <HourlyLineChart
              key={m.key}
              title={m.label}
              data={makeDataset(rows, m.key)}
              globalMax={globalStats[m.key]?.max ?? 0}
              globalMedian={globalStats[m.key]?.median ?? 0}
              wfull={m.wfull ?? false}
            />
          ))}
        </ChartGrid>
      )}
    </div>
  );
}
