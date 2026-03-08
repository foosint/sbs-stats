import { type ReactNode } from "react";
import { useTheme } from "@/hooks/useTheme";
import { FONTS } from "@/theme";
export function ChartGrid({ children }: { children: ReactNode }) {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 480px), 1fr))",
      gap: 16,
      // Allow tooltips to overflow above neighbouring grid cells
      overflow: "visible",
    }}>
      {children}
    </div>
  );
}
export function LoadingScreen({ message = "Loading database..." }: { message?: string }) {
  const { theme: t } = useTheme();
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 80, gap: 16 }}>
      <div style={{ width: 10, height: 10, borderRadius: "50%", background: t.primary, animation: "blink 1.2s infinite" }} />
      <span style={{ fontFamily: FONTS.mono, fontSize: 12, color: t.textMuted }}>{message}</span>
    </div>
  );
}
export function ErrorScreen({ message }: { message: string }) {
  const { theme: t } = useTheme();
  return (
    <div style={{
      padding: 40, textAlign: "center", fontFamily: FONTS.mono, fontSize: 13,
      color: t.accent, border: `1px solid ${t.accent}`, borderRadius: 12,
      background: t.surface, opacity: 0.9,
    }}>
      ✖ {message}
    </div>
  );
}
