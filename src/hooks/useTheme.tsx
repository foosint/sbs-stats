import { createContext, useContext, useState, useEffect } from "react";
import type { Theme } from "@/theme";
import { LIGHT, DARK } from "@/theme";

type ThemeMode = "light" | "dark";

interface ThemeContextValue {
  mode: ThemeMode;
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: "light",
  theme: LIGHT,
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<ThemeMode>(() => {
    try {
      return (localStorage.getItem("theme") as ThemeMode) ?? "light";
    } catch {
      return "light";
    }
  });

  const theme = mode === "light" ? LIGHT : DARK;

  const toggle = () => {
    setMode((prev) => {
      const next = prev === "light" ? "dark" : "light";
      try { localStorage.setItem("theme", next); } catch { /* ignore */ }
      return next;
    });
  };

  // Keep body background in sync (avoids flash on first paint)
  useEffect(() => {
    document.body.style.background = theme.bg;
    document.body.style.color = theme.text;
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ mode, theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
