import { useMemo, useEffect, useState } from "react";
import { useDatabaseContext } from "@/context/useDatabaseContext";
import { useTheme } from "@/hooks/useTheme";
import { Top10 } from "@/components/Top10";
import { ChartGrid, LoadingScreen, ErrorScreen } from "@/components/Layout";
import { buildMetrics } from "@/utils/metrics";
import type { DailyDataPoint, StatKey, Metric } from "@/types";
import { FONTS } from "@/theme";

interface Top10PageProps {
  refreshKey?: number;
}

export function Top10Page({ refreshKey }: Top10PageProps) {
  const { theme: t } = useTheme();
  const { loadState, error, queryTop10 } = useDatabaseContext();
  const [top10, setTop10] = useState<Record<StatKey, DailyDataPoint[]>>({} as Record<StatKey, DailyDataPoint[]>);
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    if (loadState === "ready") { setTop10(queryTop10()); setHasData(true); }
  }, [loadState, queryTop10, refreshKey]);

  const metrics = useMemo<Metric[]>(() => buildMetrics(), []);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 24, color: t.text }}>
            Top 10 Days
          </h1>
          <p style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.textMuted, marginTop: 3 }}>
            Highest daily values per category · all available data
          </p>
          <p style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.bgImportant, marginTop: 3 }}>Today's figures are preliminary and will be updated over the course of the next day.</p>
        </div>
      </div>

      {loadState === "loading" && !hasData && <LoadingScreen />}
      {loadState === "error" && <ErrorScreen message={error ?? "Unknown error"} />}
      {(loadState === "ready" || hasData) && (
        <ChartGrid>
          {metrics.map((m: Metric) => (
            <Top10
              key={m.key}
              title={m.label}
              data={top10[m.key] ?? []}
              wfull={m.wfull ?? false}
            />
          ))}
        </ChartGrid>
      )}
    </div>
  );
}
