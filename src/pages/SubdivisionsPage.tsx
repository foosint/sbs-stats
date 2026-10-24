import { useMemo, useEffect, useState } from "react";
import { useDatabaseContext } from "@/context/useDatabaseContext";
import { useTheme } from "@/hooks/useTheme";
import { MonthlyBarChart } from "@/components/MonthlyBarChart";
import { RankingBarChart, type RankingDataPoint } from "@/components/RankingBarChart";
import { ChartGrid, LoadingScreen, ErrorScreen } from "@/components/Layout";
import { buildMetrics } from "@/utils/metrics";
import type { MonthlyDataPoint, MonthlyRow, StatKey, Metric } from "@/types";
import { FONTS } from "@/theme";

const STORAGE_KEY = "sbs.subdivision";

// Sentinel selection value for the ranking view (not a valid subdivision name)
const RANKING = "__ranking__";
// Sentinel period value for the all-time ranking
const ALL_TIME = "__all__";

function loadStoredSubdivision(): string | null {
  try { return localStorage.getItem(STORAGE_KEY); } catch { return null; }
}

function storeSubdivision(value: string) {
  try { localStorage.setItem(STORAGE_KEY, value); } catch { /* ignore */ }
}

// "foo_bar" → "FOO-BAR"
function formatSubdivision(name: string): string {
  return name.replace(/_/g, "-").toUpperCase();
}

interface SubdivisionsPageProps {
  refreshKey?: number;
}

export function SubdivisionsPage({ refreshKey }: SubdivisionsPageProps) {
  const { theme: t } = useTheme();
  const {
    loadState, error,
    querySubdivisions, querySubdivisionMonthly, querySubdivisionMonths, querySubdivisionRanking,
  } = useDatabaseContext();
  const [subdivisions, setSubdivisions] = useState<string[]>([]);
  const [selected, setSelected] = useState<string | null>(loadStoredSubdivision);
  const [rows, setRows] = useState<MonthlyRow[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [period, setPeriod] = useState<string | null>(null);
  const [rankingRows, setRankingRows] = useState<ReturnType<typeof querySubdivisionRanking>>([]);
  const [hasData, setHasData] = useState(false);

  const isRanking = selected === RANKING;

  // Load subdivision list + months; keep the current selections if they still exist
  useEffect(() => {
    if (loadState !== "ready") return;
    const list = querySubdivisions();
    const monthList = querySubdivisionMonths();
    setSubdivisions(list);
    setMonths(monthList);
    setSelected((prev) => (prev === RANKING || (prev && list.includes(prev)) ? prev : list[0] ?? null));
    setPeriod((prev) => (prev === ALL_TIME || (prev && monthList.includes(prev)) ? prev : monthList[0] ?? ALL_TIME));
    setHasData(true);
  }, [loadState, querySubdivisions, querySubdivisionMonths, refreshKey]);

  useEffect(() => {
    if (loadState !== "ready" || !selected) return;
    if (selected === RANKING) {
      if (period) setRankingRows(querySubdivisionRanking(period === ALL_TIME ? null : period));
    } else {
      setRows(querySubdivisionMonthly(selected));
    }
  }, [loadState, selected, period, querySubdivisionMonthly, querySubdivisionRanking, refreshKey]);

  const metrics = useMemo<Metric[]>(() => buildMetrics(), []);

  const handleSelect = (value: string) => {
    setSelected(value);
    storeSubdivision(value);
  };

  const makeDataset = (key: StatKey): MonthlyDataPoint[] =>
    rows.map((d: MonthlyRow) => ({ date: d.date, value: (d[key] as number) ?? 0 }));

  const makeRanking = (key: StatKey): RankingDataPoint[] =>
    rankingRows
      .map((r) => ({ name: formatSubdivision(r.subdivision), value: (r[key] as number) ?? 0 }))
      .filter((d) => d.value > 0)
      .sort((a, b) => b.value - a.value);

  const toggleBtn = (key: string, label: string, active: boolean, onClick: () => void) => (
    <button
      key={key}
      onClick={onClick}
      style={{
        background: active ? t.primary : "transparent",
        color: active ? "#ffffff" : t.textMuted,
        border: `1px solid ${active ? t.primary : t.border}`,
        borderRadius: 4,
        padding: "5px 14px",
        fontFamily: FONTS.display,
        fontSize: 12,
        fontWeight: active ? 700 : 400,
        cursor: "pointer",
        letterSpacing: "0.04em",
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );

  const showContent = (loadState === "ready" || hasData) && subdivisions.length > 0;

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 24, color: t.text }}>
            Subdivision Statistics
          </h1>
          <p style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.textMuted, marginTop: 3 }}>
            {isRanking
              ? "Subdivisions ranked by total per category · subdivisions with zero are omitted"
              : "Monthly aggregates per subdivision · current month shows actual values so far (no projection)"}
          </p>
        </div>
      </div>

      {subdivisions.length > 0 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
          {toggleBtn(RANKING, "RANKING", isRanking, () => handleSelect(RANKING))}
          <span style={{ width: 1, alignSelf: "stretch", background: t.border, margin: "0 4px" }} />
          {subdivisions.map((s) => toggleBtn(s, formatSubdivision(s), s === selected, () => handleSelect(s)))}
        </div>
      )}

      {showContent && isRanking && (
        <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
          {toggleBtn(ALL_TIME, "ALL TIME", period === ALL_TIME, () => setPeriod(ALL_TIME))}
          {months.map((m) => toggleBtn(m, m.replace("-", "/"), m === period, () => setPeriod(m)))}
        </div>
      )}

      {showContent && !isRanking && (
        <div style={{ display: "flex", gap: 20, marginBottom: 20, fontFamily: FONTS.mono, fontSize: 11, flexWrap: "wrap" }}>
          <span style={{ color: t.primary }}>■ Past months</span>
          <span style={{ color: t.accent }}>■ Current (actual)</span>
        </div>
      )}

      {loadState === "loading" && !hasData && <LoadingScreen />}
      {loadState === "error" && <ErrorScreen message={error ?? "Unknown error"} />}
      {(loadState === "ready" || hasData) && subdivisions.length === 0 && (
        <p style={{ fontFamily: FONTS.mono, fontSize: 12, color: t.textMuted }}>
          No subdivision data available.
        </p>
      )}
      {showContent && (
        <ChartGrid>
          {metrics.map((m: Metric) =>
            isRanking ? (
              <RankingBarChart
                key={m.key}
                title={m.label}
                data={makeRanking(m.key)}
                wfull={m.wfull ?? false}
              />
            ) : (
              <MonthlyBarChart
                key={m.key}
                title={m.label}
                data={makeDataset(m.key).reverse()}
                wfull={m.wfull ?? false}
              />
            )
          )}
        </ChartGrid>
      )}
    </div>
  );
}
