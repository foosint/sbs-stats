// ─── Target classification IDs ────────────────────────────────────────────────
export const TARGET_IDS = [1, 2, 3, 4, 5, 32, 7, 18, 25, 29, 21, 22] as const;
export type TargetId = (typeof TARGET_IDS)[number];

export const TARGET_LABELS: Record<TargetId, string> = {
  1: "Tanks",
  2: "APCs, IFVs, ACVs",
  3: "Guns, howitzers",
  4: "Self-propelled artillery",
  5: "MLRS (was MLRS, SAMs, AA Guns before around March 20)",
  7: "Light, Heavy, Special-purpose vehicles",
  18: "Motorcycles and military buggies",
  21: "Shelters",
  22: "Dugouts",
  25: "Enemy Wings",
  29: "Shaheds and Gerberas (since around March 20)",
  32: "SAMs, SPADs (split from MRLS around March 20)",
};

// ─── Base numeric stat keys ───────────────────────────────────────────────────
export type BaseStatKey =
  | "personnel_killed"
  | "personnel_wounded"
  | "total_targets_hit"
  | "total_targets_destroyed"
  | "total_personnel_casualties";

export type HitKey = `hit_${TargetId}`;
export type DestroyedKey = `destroyed_${TargetId}`;
export type TargetStatKey = HitKey | DestroyedKey;
export type StatKey = BaseStatKey | TargetStatKey;

// ─── DB row shapes ────────────────────────────────────────────────────────────
export type DailyRow = {
  date: string;   // "YYYY-MM-DD"
  hour: number;
  is_today: boolean;
} & Record<StatKey, number>;

export type ProjectedKey = `${StatKey}_projected`;

export type MonthlyRow = {
  date: string;   // "YYYY-MM"
  is_current_month: boolean;
  projection_day: number | null;
  projection_days_in_month: number | null;
} & Record<StatKey, number> & Partial<Record<ProjectedKey, number>>;

// ─── Daily chart (one value per day) ─────────────────────────────────────────
export interface DailyDataPoint {
  date: string;
  value: number;
  is_today: boolean;
}

// ─── Hourly chart (one line per day, x-axis = hours) ─────────────────────────
export interface HourPoint {
  hour: number;
  value: number;
}

export interface DailyDaySeries {
  date: string;
  is_today: boolean;
  points: HourPoint[];
}

// ─── Monthly chart ────────────────────────────────────────────────────────────
export interface MonthlyDataPoint {
  date: string;
  value: number;
  gap?: number;
  projected?: number;
  projection_day?: number;
  projection_days_in_month?: number;
}

// ─── Metric descriptor ────────────────────────────────────────────────────────
export interface Metric {
  key: StatKey;
  label: string;
  wfull?: boolean;
}

// ─── App state ────────────────────────────────────────────────────────────────
export type Page = "daily" | "hourly" | "monthly";
export type LoadState = "idle" | "loading" | "ready" | "error";

// ─── Global stats (max + median across all data) ──────────────────────────────
export type GlobalStats = Record<StatKey, { max: number; median: number }>;
