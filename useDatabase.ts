import { useState, useEffect, useCallback } from "react";
import type { Database } from "sql.js";
import type { DailyRow, MonthlyRow, StatKey, LoadState } from "@/types";
import { TARGET_IDS } from "@/types";

const DB_URL = import.meta.env.VITE_DB_URL ?? "/data/sbs.db";
const SQL_WASM_URL = "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/sql-wasm.wasm";

// sql.js doesn't export a proper ESM default in all environments.
// Load it via a CDN script tag which attaches initSqlJs to window.
function loadSqlJsScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as unknown as Record<string, unknown>)["initSqlJs"]) {
      resolve();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.12.0/sql-wasm.js";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load sql.js script"));
    document.head.appendChild(script);
  });
}

// ─── Singleton DB promise ─────────────────────────────────────────────────────
let dbPromise: Promise<Database> | null = null;

async function loadDatabase(): Promise<Database> {
  await loadSqlJsScript();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const initSqlJs = (window as any)["initSqlJs"] as (config: {
    locateFile: (file: string) => string;
  }) => Promise<{ Database: new (data: Uint8Array) => Database }>;

  const SQL = await initSqlJs({ locateFile: () => SQL_WASM_URL });

  const response = await fetch(DB_URL, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to fetch DB: ${response.status}`);
  const buffer = await response.arrayBuffer();
  return new SQL.Database(new Uint8Array(buffer));
}

function getOrCreateDbPromise(): Promise<Database> {
  if (!dbPromise) dbPromise = loadDatabase();
  return dbPromise;
}

// ─── Helper: read all columns present in a table ─────────────────────────────
function getTableColumns(db: Database, table: string): string[] {
  const result = db.exec(`PRAGMA table_info(${table})`);
  if (!result.length) return [];
  return result[0].values.map((row) => row[1] as string);
}

// ─── Helper: run a query and return typed rows ────────────────────────────────
function queryRows<T>(db: Database, sql: string): T[] {
  const results = db.exec(sql);
  if (!results.length) return [];
  const { columns, values } = results[0];
  return values.map((row) => {
    const obj: Record<string, unknown> = {};
    columns.forEach((col, i) => (obj[col] = row[i]));
    return obj as T;
  });
}

// ─── Build SELECT clause for stat keys that exist in the table ────────────────
function buildStatColumns(availableCols: string[]): string {
  const baseCols: StatKey[] = [
    "personnel_killed",
    "personnel_wounded",
    "total_targets_hit",
    "total_targets_destroyed",
    "total_personnel_casualties",
  ];
  const dynamicCols = TARGET_IDS.flatMap((id) => [
    `hit_${id}` as StatKey,
    `destroyed_${id}` as StatKey,
  ]);
  const allCols = [...baseCols, ...dynamicCols];
  return allCols
    .map((col) =>
      availableCols.includes(col)
        ? `COALESCE(${col}, 0) AS ${col}`
        : `0 AS ${col}`
    )
    .join(", ");
}

// ─── useDatabase hook ─────────────────────────────────────────────────────────
export function useDatabase() {
  const [db, setDb] = useState<Database | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoadState("loading");
    getOrCreateDbPromise()
      .then((database) => {
        setDb(database);
        setLoadState("ready");
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : String(err));
        setLoadState("error");
        dbPromise = null;
      });
  }, []);

  // ── Daily query ─────────────────────────────────────────────────────────────
  const queryDaily = useCallback(
    (days: number): DailyRow[] => {
      if (!db) return [];

      const availableCols = getTableColumns(db, "daily_stats");
      const statCols = buildStatColumns(availableCols);
      const todayStr = new Date().toISOString().slice(0, 10);

      const sql = `
        SELECT
          date,
          hour,
          CASE WHEN date = '${todayStr}' THEN 1 ELSE 0 END AS is_today,
          ${statCols}
        FROM daily_stats
        WHERE date >= date('${todayStr}', '-${days} days')
        ORDER BY date ASC, hour DESC
      `;

      type RawRow = DailyRow & { _seen?: boolean };
      const allRows = queryRows<RawRow>(db, sql);
      const seen = new Set<string>();
      const deduped: DailyRow[] = [];
      for (const row of allRows) {
        if (!seen.has(row.date)) {
          seen.add(row.date);
          const { _seen: _, ...clean } = row;
          deduped.push({
            ...clean,
            is_today: (row.is_today as unknown) === 1,
          });
        }
      }
      return deduped;
    },
    [db]
  );

  // ── Monthly query ───────────────────────────────────────────────────────────
  const queryMonthly = useCallback((): MonthlyRow[] => {
    if (!db) return [];

    const availableCols = getTableColumns(db, "monthly_stats");
    const statCols = buildStatColumns(availableCols);
    const today = new Date();
    const currentMonth = today.toISOString().slice(0, 7);
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const dayOfMonth = today.getDate();

    const sql = `
      SELECT
        date,
        ${statCols}
      FROM monthly_stats
      ORDER BY date ASC
    `;

    const rows = queryRows<Record<string, unknown>>(db, sql);

    return rows.map((row) => {
      const dateStr = String(row["date"]).slice(0, 7);
      const isCurrentMonth = dateStr === currentMonth;

      const typedRow: MonthlyRow = {
        date: dateStr,
        is_current_month: isCurrentMonth,
        projection_day: isCurrentMonth ? dayOfMonth : null,
        projection_days_in_month: isCurrentMonth ? daysInMonth : null,
        ...(row as Record<string, number>),
      };

      if (isCurrentMonth) {
        const multiplier = daysInMonth / dayOfMonth;
        const statKeys: StatKey[] = [
          "personnel_killed",
          "personnel_wounded",
          "total_targets_hit",
          "total_targets_destroyed",
          "total_personnel_casualties",
          ...TARGET_IDS.flatMap((id) => [
            `hit_${id}` as StatKey,
            `destroyed_${id}` as StatKey,
          ]),
        ];
        for (const key of statKeys) {
          const raw = row[key];
          if (typeof raw === "number") {
            typedRow[`${key}_projected`] = Math.round(raw * multiplier);
          }
        }
      }

      return typedRow;
    });
  }, [db]);

  return { loadState, error, queryDaily, queryMonthly };
}
