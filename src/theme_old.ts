export const COLORS = {
  primary: "#00d4ff",
  accent: "#ff6b35",
  muted: "#4a6fa5",
  bg: "#080c14",
  surface: "#0d1420",
  border: "#1a2540",
  text: "#e2e8f0",
  textMuted: "#64748b",
} as const;

export const FONTS = {
  display: "'Syne', sans-serif",
  mono: "'Space Mono', monospace",
} as const;

export const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Syne:wght@400;600;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body {
    background: ${COLORS.bg};
    color: ${COLORS.text};
    font-family: ${FONTS.display};
    -webkit-font-smoothing: antialiased;
  }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: ${COLORS.surface}; }
  ::-webkit-scrollbar-thumb { background: ${COLORS.border}; border-radius: 3px; }
  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.2} }
  @keyframes fadeIn { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
`;
