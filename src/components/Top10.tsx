import type { DailyDataPoint } from "@/types";
import { useTheme } from "@/hooks/useTheme";
import { FONTS } from "@/theme";

interface Props {
  title: string;
  data: DailyDataPoint[];
  wfull: boolean;
}

const formatDate = (v: string) => { const [y, m, d] = v.split("-"); return `${d}.${m}.${y}`; };

export function Top10({ title, data, wfull }: Props) {
  const { theme: t } = useTheme();

  const cell = {
    padding: "6px 8px",
    borderBottom: `1px solid ${t.surfaceBorder}`,
  };
  const headCell = {
    ...cell,
    fontFamily: FONTS.display,
    fontWeight: 700,
    fontSize: 10,
    color: t.textMuted,
    letterSpacing: "0.07em",
    textTransform: "uppercase" as const,
  };

  return (
    <div style={{
      background: t.surface,
      border: `1px solid ${t.surfaceBorder}`,
      borderRadius: 8,
      padding: "18px 16px 12px",
      gridColumn: wfull ? "1 / -1" : undefined,
      animation: "fadeIn 0.3s ease both",
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    }}>
      <div style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 12, color: t.textMuted, letterSpacing: "0.07em", textTransform: "uppercase", marginBottom: 14 }}>
        {title}
      </div>
      {data.length === 0 ? (
        <div style={{ fontFamily: FONTS.mono, fontSize: 12, color: t.textMuted, padding: "12px 8px" }}>
          No data
        </div>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: FONTS.mono, fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ ...headCell, textAlign: "left", width: 40 }}>#</th>
              <th style={{ ...headCell, textAlign: "left" }}>Date</th>
              <th style={{ ...headCell, textAlign: "right" }}>Value</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => {
              const valueColor = d.is_today ? t.accent : i === 0 ? t.primary : t.text;
              return (
                <tr key={d.date}>
                  <td style={{ ...cell, color: t.textMuted }}>{i + 1}</td>
                  <td style={{ ...cell, color: d.is_today ? t.accent : t.text }}>
                    {formatDate(d.date)}
                    {d.is_today && (
                      <span style={{ marginLeft: 8, fontSize: 10, color: t.accent }}>today</span>
                    )}
                  </td>
                  <td style={{ ...cell, textAlign: "right", color: valueColor, fontWeight: i === 0 ? 700 : 400 }}>
                    {d.value.toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}
