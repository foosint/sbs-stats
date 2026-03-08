import { useState } from "react";
import { ThemeProvider, useTheme } from "@/hooks/useTheme";
import { DailyPage } from "@/pages/DailyPage";
import { HourlyPage } from "@/pages/HourlyPage";
import { MonthlyPage } from "@/pages/MonthlyPage";
import type { Page } from "@/types";
import { FONTS, GLOBAL_CSS } from "@/theme";

function AppInner() {
  const { mode, theme: t, toggle } = useTheme();
  const [page, setPage] = useState<Page>("hourly");

  const navBtn = (target: Page, label: string) => (
    <button
      key={target}
      onClick={() => setPage(target)}
      style={{
        background: page === target ? t.primary : "transparent",
        color: page === target ? "#ffffff" : t.textMuted,
        border: `1px solid ${page === target ? t.primary : t.border}`,
        borderRadius: 4,
        padding: "5px 14px",
        fontFamily: FONTS.display,
        fontSize: 12,
        fontWeight: page === target ? 700 : 400,
        cursor: "pointer",
        letterSpacing: "0.04em",
        transition: "all 0.15s",
      }}
    >
      {label}
    </button>
  );

  return (
    <>
      <style>{GLOBAL_CSS(t)}</style>
      <div style={{ minHeight: "100vh", background: t.bg }}>

        {/* Header */}
        <header style={{
          borderBottom: `1px solid ${t.border}`,
          padding: "0 24px",
          height: 52,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backdropFilter: "blur(8px)",
          position: "sticky",
          top: 0,
          zIndex: 10,
          background: t.headerBg,
        }}>
          {/* Brand */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 8, height: 8, borderRadius: "50%",
              background: t.accent, animation: "blink 2s infinite",
            }} />
            <span style={{
              fontFamily: FONTS.display,
              fontSize: 13,
              fontWeight: 700,
              color: t.text,
              letterSpacing: "0.06em",
            }}>
              SBS BATTLEFIELD STATISTICS
            </span>
          </div>

          {/* Nav + theme toggle */}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {navBtn("hourly", "HOURLY")}
            {navBtn("daily", "DAILY")}
            {navBtn("monthly", "MONTHLY")}

            {/* Theme toggle */}
            <button
              onClick={toggle}
              title={`Switch to ${mode === "light" ? "dark" : "light"} mode`}
              style={{
                marginLeft: 8,
                background: t.bgAlt,
                border: `1px solid ${t.border}`,
                borderRadius: 4,
                padding: "5px 10px",
                cursor: "pointer",
                fontSize: 14,
                lineHeight: 1,
                color: t.text,
              }}
            >
              {mode === "light" ? "🌙" : "☀️"}
            </button>
          </div>
        </header>

        {/* Main */}
        <main style={{ maxWidth: 1400, margin: "0 auto", padding: "32px 20px 64px" }}>
          {page === "daily"   && <DailyPage />}
          {page === "hourly"  && <HourlyPage />}
          {page === "monthly" && <MonthlyPage />}
        </main>
      </div>
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AppInner />
    </ThemeProvider>
  );
}
