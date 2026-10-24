import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LabelList,
} from "recharts";
import { useTheme } from "@/hooks/useTheme";
import { FONTS } from "@/theme";

export interface RankingDataPoint {
  name: string;
  value: number;
}

interface Props {
  title: string;
  data: RankingDataPoint[]; // already sorted, highest first
  wfull: boolean;
}

const BAR_SIZE = 16;
const ROW_HEIGHT = 24;

const RankingTooltip = ({
  active, payload, t,
}: {
  active?: boolean;
  payload?: Array<{ payload?: RankingDataPoint }>;
  t: ReturnType<typeof useTheme>["theme"];
}) => {
  const d = payload?.[0]?.payload;
  if (!active || !d) return null;
  return (
    <div style={{
      background: t.surface, border: `1px solid ${t.border}`,
      borderRadius: 6, padding: "10px 14px",
      fontFamily: FONTS.mono, fontSize: 12,
      boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
    }}>
      <div style={{ color: t.textMuted, marginBottom: 6 }}>{d.name}</div>
      <div style={{ color: t.primary }}>
        Total: <span style={{ color: t.text, fontWeight: 700 }}>{d.value.toLocaleString()}</span>
      </div>
    </div>
  );
};

export function RankingBarChart({ title, data, wfull }: Props) {
  const { theme: t } = useTheme();

  // Size the category axis to the longest label (mono font ≈ 6.5px per char at 10px)
  const labelWidth = Math.min(200, Math.max(60, ...data.map((d) => d.name.length * 6.5 + 8)));
  const height = Math.max(80, data.length * ROW_HEIGHT + 24);

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
        <div style={{ fontFamily: FONTS.mono, fontSize: 11, color: t.textMuted, padding: "24px 0", textAlign: "center" }}>
          No data
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} layout="vertical" margin={{ top: 0, right: 48, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="2 4" stroke={t.chartGrid} horizontal={false} />
            <XAxis type="number"
              tick={{ fontSize: 10, fill: t.textMuted, fontFamily: FONTS.mono }}
              tickLine={false} axisLine={false}
            />
            <YAxis type="category" dataKey="name" width={labelWidth} interval={0}
              tick={{ fontSize: 10, fill: t.textMuted, fontFamily: FONTS.mono }}
              tickLine={false} axisLine={false}
            />
            <Tooltip cursor={{ fill: t.chartGrid, opacity: 0.4 }} content={(props) => <RankingTooltip {...props} t={t} />} />
            <Bar dataKey="value" name="Total" fill={t.primary} opacity={0.85} barSize={BAR_SIZE} radius={[0, 3, 3, 0]}>
              <LabelList dataKey="value" position="right"
                formatter={(v: number) => v.toLocaleString()}
                style={{ fontSize: 10, fill: t.text, fontFamily: FONTS.mono }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
