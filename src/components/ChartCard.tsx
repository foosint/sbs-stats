import { useRef, useState, type ReactNode } from "react";
import { toPng } from "html-to-image";
import { useTheme } from "@/hooks/useTheme";
import { useDatabaseContext } from "@/context/useDatabaseContext";
import { formatDataTime, slugify, KYIV_TZ } from "@/utils/format";
import { FONTS } from "@/theme";

interface Props {
  title: string;
  wfull: boolean;
  titleGap?: number;        // space below the title row (4 when a legend row follows, 14 otherwise)
  exportContext?: string;   // prefixed to the title in the PNG only, e.g. a subdivision name
  className?: string;
  // Runs before the PNG capture; returns an undo. WebGL charts use it to swap their canvas
  // (which html-to-image reads back blank) for a static snapshot.
  beforeExport?: () => Promise<() => void>;
  children: ReactNode;
}

const CAPTION_FONT_PX = 10;
const CAPTION_MIN_FONT_PX = 7;

// Elements left out of the PNG: the download button itself, plus any open chart tooltip
// and its hover highlight (the band/line recharts draws under the mouse)
const EXCLUDED_CLASSES = ["chart-download", "recharts-tooltip-wrapper", "recharts-tooltip-cursor"];
const excludeFromExport = (node: HTMLElement) =>
  !EXCLUDED_CLASSES.some((c) => node.classList?.contains(c));

// Card container shared by all charts, with a download-as-PNG button in the top-right corner.
// The PNG gets an extra caption (source + data time, optional context) that only shows while exporting.
export function ChartCard({ title, wfull, titleGap = 4, exportContext, className, beforeExport, children }: Props) {
  const { theme: t } = useTheme();
  const { dataCollectedAt } = useDatabaseContext();
  const cardRef = useRef<HTMLDivElement>(null);
  const captionRef = useRef<HTMLDivElement>(null);
  const [busy, setBusy] = useState(false);

  const download = async () => {
    const card = cardRef.current;
    if (!card || busy) return;
    setBusy(true);
    card.classList.add("exporting");
    let undoPrepare: (() => void) | undefined;
    try {
      undoPrepare = await beforeExport?.();
      // Let the export-only caption render before capturing
      await new Promise((r) => requestAnimationFrame(() => r(null)));
      // Keep the caption on one line: shrink its font until it fits narrow (phone) cards
      const caption = captionRef.current;
      if (caption) {
        let size = CAPTION_FONT_PX;
        while (caption.scrollWidth > caption.clientWidth && size > CAPTION_MIN_FONT_PX) {
          size -= 0.5;
          caption.style.fontSize = `${size}px`;
        }
      }
      const dataUrl = await toPng(card, { pixelRatio: 2, cacheBust: true, filter: excludeFromExport });
      const day = (dataCollectedAt ?? new Date()).toLocaleDateString("sv-SE", { timeZone: KYIV_TZ });
      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `sbs-${[exportContext, title].filter(Boolean).map((s) => slugify(s!)).join("-")}-${day}.png`;
      link.click();
    } catch (err) {
      console.error("Chart export failed", err);
    } finally {
      undoPrepare?.();
      card.classList.remove("exporting");
      if (captionRef.current) captionRef.current.style.fontSize = `${CAPTION_FONT_PX}px`;
      setBusy(false);
    }
  };

  return (
    <div ref={cardRef} className={className} style={{
      position: "relative",
      background: t.surface,
      border: `1px solid ${t.surfaceBorder}`,
      borderRadius: 8,
      padding: "18px 16px 12px",
      gridColumn: wfull ? "1 / -1" : undefined,
      animation: "fadeIn 0.3s ease both",
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: titleGap }}>
        <div style={{ fontFamily: FONTS.display, fontWeight: 700, fontSize: 12, color: t.textMuted, letterSpacing: "0.07em", textTransform: "uppercase" }}>
          {exportContext && <span className="chart-export-only">{exportContext} — </span>}
          {title}
        </div>
        <button
          className="chart-download"
          onClick={download}
          disabled={busy}
          title="Download PNG"
          aria-label={`Download "${title}" as PNG`}
          style={{
            flexShrink: 0,
            width: 24, height: 24,
            marginTop: -4,
            display: "flex", alignItems: "center", justifyContent: "center",
            background: "transparent",
            // Deliberately subtle: no visible border at rest; the global button hover effect
            // adds the ring and tint. Transparent (not none) so the size doesn't change.
            border: "1px solid transparent",
            borderRadius: 4,
            color: t.textFaint,
            cursor: busy ? "wait" : "pointer",
            opacity: busy ? 0.5 : 1,
            transition: "all 0.15s",
          }}
        >
          <svg width={13} height={13} viewBox="0 0 16 16" fill="none" stroke="currentColor"
            strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M8 2v8M4.5 6.5L8 10l3.5-3.5M2.5 11.5v2h11v-2" />
          </svg>
        </button>
      </div>
      {children}
      <div ref={captionRef} className="chart-export-only" style={{
        fontFamily: FONTS.mono, fontSize: CAPTION_FONT_PX, color: t.textMuted, marginTop: 8,
        whiteSpace: "nowrap", overflow: "hidden",
      }}>
        Source: sbs-group.army{dataCollectedAt && ` · as of ${formatDataTime(dataCollectedAt, true)}`}
      </div>
    </div>
  );
}
