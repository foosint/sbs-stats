import type { Metric, StatKey } from "@/types";
import { useTheme } from "@/hooks/useTheme";
import { FONTS } from "@/theme";

interface Props {
  metrics: Metric[];
  value: StatKey;
  onChange: (key: StatKey) => void;
  ariaLabel: string;
}

// Metric picker for the single-metric charts on the Hourly page (3D, ridgeline)
export function MetricSelect({ metrics, value, onChange, ariaLabel }: Props) {
  const { theme: t } = useTheme();
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as StatKey)}
      aria-label={ariaLabel}
      style={{
        background: t.bgAlt, color: t.text,
        border: `1px solid ${t.border}`, borderRadius: 4,
        padding: "4px 8px", fontFamily: FONTS.mono, fontSize: 11,
        maxWidth: "100%",
      }}
    >
      {metrics.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
    </select>
  );
}
