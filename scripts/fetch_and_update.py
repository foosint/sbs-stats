#!/usr/bin/env python3
"""
fetch_and_update.py
-------------------
Fetches latest battlefield data from sbs-group.army and writes it into data/sbs.db.
Runs on a cron schedule via GitHub Actions (.github/workflows/update-db.yml).
"""

import os
import sqlite3
import time
import zoneinfo
import requests
from datetime import datetime, timezone

DB_PATH = os.environ.get("DB_PATH", "data/sbs.db")
KYIV_TZ = zoneinfo.ZoneInfo("Europe/Kyiv")

# ─── API endpoints ────────────────────────────────────────────────────────────

DAILY_URL = "https://sbs-group.army/api/public/statistics/68b0c85589944c4bfb2a5edc/68fa98652f31834f2e051459"

MONTHLY_URLS: dict[str, str] = {
    "2025-06": "https://sbs-group.army/api/public/statistics/68b0c85589944c4bfb2a5edc/68e4e5d484f8ca462d9a7c77",
    "2025-07": "https://sbs-group.army/api/public/statistics/68b0c85589944c4bfb2a5edc/68e4e67684f8ca462d9a80db",
    "2025-08": "https://sbs-group.army/api/public/statistics/68b0c85589944c4bfb2a5edc/68b47e50792cdf918400b06c",
    "2025-09": "https://sbs-group.army/api/public/statistics/68b0c85589944c4bfb2a5edc/68b1c0f79d5ff32bdf80e705",
    "2025-10": "https://sbs-group.army/api/public/statistics/68b0c85589944c4bfb2a5edc/68dd1906de22367a4e908027",
    "2025-11": "https://sbs-group.army/api/public/statistics/68b0c85589944c4bfb2a5edc/690531b56519eae72cea27b4",
    "2025-12": "https://sbs-group.army/api/public/statistics/68b0c85589944c4bfb2a5edc/692cbeb9145504ee2b0171e5",
    "2026-01": "https://sbs-group.army/api/public/statistics/68b0c85589944c4bfb2a5edc/69559d35869d2691543f313f",
    "2026-02": "https://sbs-group.army/api/public/statistics/68b0c85589944c4bfb2a5edc/697e7bbb1ae0eb20ad9dbf56",
    "2026-03": "https://sbs-group.army/api/public/statistics/68b0c85589944c4bfb2a5edc/69a365b5e9679075a2e69d57",
}

REQUEST_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/136.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Connection": "keep-alive",
    "Sec-Fetch-Site": "same-origin",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Dest": "empty",
}

# ─── Schema ───────────────────────────────────────────────────────────────────

def ensure_schema(conn: sqlite3.Connection) -> None:
    conn.execute("""
        CREATE TABLE IF NOT EXISTS daily_stats (
            date DATE,
            hour INTEGER,
            data_collected_at TEXT,
            last_updated DATETIME,
            personnel_killed INTEGER,
            personnel_wounded INTEGER,
            total_targets_hit INTEGER,
            total_targets_destroyed INTEGER,
            total_personnel_casualties INTEGER,
            PRIMARY KEY (date, hour)
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS monthly_stats (
            date DATE,
            data_collected_at TEXT,
            last_updated DATETIME,
            personnel_killed INTEGER,
            personnel_wounded INTEGER,
            total_targets_hit INTEGER,
            total_targets_destroyed INTEGER,
            total_personnel_casualties INTEGER,
            PRIMARY KEY (date)
        )
    """)
    conn.commit()


def ensure_columns(conn: sqlite3.Connection, table: str, target_ids: list[int]) -> None:
    """Dynamically add hit_X / destroyed_X columns if they don't exist yet."""
    cur = conn.cursor()
    cur.execute(f"PRAGMA table_info({table})")
    existing = {row[1] for row in cur.fetchall()}
    for tid in target_ids:
        for prefix in ("hit", "destroyed"):
            col = f"{prefix}_{tid}"
            if col not in existing:
                print(f"  Adding column {table}.{col}")
                conn.execute(f"ALTER TABLE {table} ADD COLUMN {col} INTEGER")
    conn.commit()


# ─── HTTP fetch with retries ──────────────────────────────────────────────────

def fetch_json(url: str, retries: int = 5, backoff: int = 5) -> dict:
    session = requests.Session()
    session.headers.update(REQUEST_HEADERS)

    for attempt in range(1, retries + 1):
        now = datetime.now().strftime("[%d.%m.%Y %H:%M:%S]")
        try:
            response = session.get(url, timeout=15)
            response.raise_for_status()
            return response.json()
        except requests.exceptions.HTTPError as e:
            if "525" in str(e):
                print(f"⚠️ {now} HTTP 525 (SSL Handshake Failed). Attempt {attempt}/{retries}...")
                if attempt < retries:
                    time.sleep(backoff * attempt)
                    continue
            raise
        except requests.exceptions.RequestException as e:
            print(f"⚠️ {now} Network error: {e}. Attempt {attempt}/{retries}...")
            if attempt < retries:
                time.sleep(backoff * attempt)
                continue
            raise

    raise RuntimeError(f"Failed to fetch {url} after {retries} attempts")


# ─── Parse API response → internal dict ──────────────────────────────────────

def parse_api_response(raw: dict) -> dict:
    """
    Convert the sbs-group.army API response into the internal dict format.

    API shape:
      { "data": {
          "dataCollectedAt": "2025-10-26T00:19:00.008Z",
          "lastUpdated": "...",
          "personnel": { "killed": N, "wounded": N },
          "totalTargetsHit": N,
          "totalTargetsDestroyed": N,
          "totalPersonnelCasualties": N,
          "targetsByType": [
            { "targetClassId": N, "hit": N, "destroyed": N }, ...
          ]
      }}
    """
    data = raw.get("data", {})
    if not data:
        raise ValueError("API response missing 'data' field")

    personnel = data.get("personnel", {})
    targets = {
        t["targetClassId"]: {"hit": t.get("hit"), "destroyed": t.get("destroyed")}
        for t in data.get("targetsByType", [])
        if t.get("targetClassId") is not None
    }

    return {
        "data_collected_at": data.get("dataCollectedAt"),
        "last_updated": data.get("lastUpdated"),
        "personnel_killed": personnel.get("killed"),
        "personnel_wounded": personnel.get("wounded"),
        "total_targets_hit": data.get("totalTargetsHit"),
        "total_targets_destroyed": data.get("totalTargetsDestroyed"),
        "total_personnel_casualties": data.get("totalPersonnelCasualties"),
        "targets": targets,
    }


def to_kyiv_dt(iso_str: str) -> datetime:
    """Parse an ISO UTC timestamp and return it in Kyiv local time."""
    utc_dt = datetime.fromisoformat(iso_str.replace("Z", "+00:00"))
    return utc_dt.astimezone(KYIV_TZ)


# ─── Upsert helpers ───────────────────────────────────────────────────────────

def upsert_daily(conn: sqlite3.Connection, data: dict) -> None:
    now = datetime.now(timezone.utc).isoformat()
    targets: dict[int, dict] = data.pop("targets", {})
    target_ids = list(targets.keys())

    ensure_columns(conn, "daily_stats", target_ids)

    base_cols = [
        "date", "hour", "data_collected_at", "last_updated",
        "personnel_killed", "personnel_wounded",
        "total_targets_hit", "total_targets_destroyed",
        "total_personnel_casualties",
    ]
    target_cols = [f"hit_{tid}" for tid in target_ids] + [f"destroyed_{tid}" for tid in target_ids]
    all_cols = base_cols + target_cols

    values = (
        data["date"], data["hour"], data.get("data_collected_at"), now,
        data.get("personnel_killed"), data.get("personnel_wounded"),
        data.get("total_targets_hit"), data.get("total_targets_destroyed"),
        data.get("total_personnel_casualties"),
        *[targets[tid]["hit"] for tid in target_ids],
        *[targets[tid]["destroyed"] for tid in target_ids],
    )

    placeholders = ", ".join("?" * len(all_cols))
    updates = ", ".join(f"{c} = excluded.{c}" for c in all_cols if c not in ("date", "hour"))

    conn.execute(f"""
        INSERT INTO daily_stats ({", ".join(all_cols)})
        VALUES ({placeholders})
        ON CONFLICT(date, hour) DO UPDATE SET {updates}
    """, values)
    conn.commit()
    print(f"  ✅ daily_stats: {data['date']} hour {data['hour']} ({len(target_ids)} target types)")


def upsert_monthly(conn: sqlite3.Connection, data: dict) -> None:
    now = datetime.now(timezone.utc).isoformat()
    targets: dict[int, dict] = data.pop("targets", {})
    target_ids = list(targets.keys())

    ensure_columns(conn, "monthly_stats", target_ids)

    base_cols = [
        "date", "data_collected_at", "last_updated",
        "personnel_killed", "personnel_wounded",
        "total_targets_hit", "total_targets_destroyed",
        "total_personnel_casualties",
    ]
    target_cols = [f"hit_{tid}" for tid in target_ids] + [f"destroyed_{tid}" for tid in target_ids]
    all_cols = base_cols + target_cols

    values = (
        data["date"], data.get("data_collected_at"), now,
        data.get("personnel_killed"), data.get("personnel_wounded"),
        data.get("total_targets_hit"), data.get("total_targets_destroyed"),
        data.get("total_personnel_casualties"),
        *[targets[tid]["hit"] for tid in target_ids],
        *[targets[tid]["destroyed"] for tid in target_ids],
    )

    placeholders = ", ".join("?" * len(all_cols))
    updates = ", ".join(f"{c} = excluded.{c}" for c in all_cols if c != "date")

    conn.execute(f"""
        INSERT INTO monthly_stats ({", ".join(all_cols)})
        VALUES ({placeholders})
        ON CONFLICT(date) DO UPDATE SET {updates}
    """, values)
    conn.commit()
    print(f"  ✅ monthly_stats: {data['date']} ({len(target_ids)} target types)")


# ─── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    db_dir = os.path.dirname(DB_PATH)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)

    print(f"Connecting to {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    ensure_schema(conn)

    # ── Daily ──────────────────────────────────────────────────────────────────
    print("Fetching daily data...")
    parsed = parse_api_response(fetch_json(DAILY_URL))
    kyiv_dt = to_kyiv_dt(parsed["data_collected_at"])
    parsed["date"] = kyiv_dt.strftime("%Y-%m-%d")
    parsed["hour"] = kyiv_dt.hour
    upsert_daily(conn, parsed)

    # ── Monthly ────────────────────────────────────────────────────────────────
    for month, url in MONTHLY_URLS.items():
        print(f"Fetching monthly data for {month}...")
        try:
            parsed_m = parse_api_response(fetch_json(url))
            parsed_m["date"] = f"{month}-01"
            upsert_monthly(conn, parsed_m)
        except Exception as e:
            print(f"  ⚠️ Skipping {month}: {e}")

    conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
