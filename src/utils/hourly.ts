import type { DailyDaySeries } from "@/types";

// Same x mapping as HourlyLineChart: position 0 is the day-start anchor (always 0),
// DB hour N is drawn at position N+1 (the running total at the end of that hour)
export const POSITIONS = Array.from({ length: 25 }, (_, i) => i);

// Running total per position; hours missing from the DB are null
export function zRow(series: DailyDaySeries): (number | null)[] {
  const byHour = new Map(series.points.map((p) => [p.hour, p.value]));
  return POSITIONS.map((pos) => (pos === 0 ? 0 : byHour.get(pos - 1) ?? null));
}

// Carry the running total over missing hours (like connectNulls in the 2D chart)
export function filledRow(series: DailyDaySeries): number[] {
  let last = 0;
  return zRow(series).map((v) => (last = v ?? last));
}

// Value added in each DB hour 0–23. Downward corrections count as 0; today's hours that
// haven't happened yet are null rather than 0.
export function hourlyIncrements(series: DailyDaySeries): (number | null)[] {
  const cum = zRow(series);
  const lastKnown = cum.reduce<number>((acc, v, pos) => (v != null ? pos : acc), 0);
  let prev = 0;
  return cum.slice(1).map((v, h) => {
    if (series.is_today && h + 1 > lastKnown) return null;
    const cur = v ?? prev;
    const inc = Math.max(0, cur - prev);
    prev = cur;
    return inc;
  });
}
