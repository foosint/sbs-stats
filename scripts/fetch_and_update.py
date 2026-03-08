#!/usr/bin/env python3
"""
fetch_and_update.py
-------------------
Fetches latest battlefield data and writes it into data/sbs.db.

Adapt the DATA SOURCE SECTION below to point at your actual data source.
The rest of the script (schema management, upsert logic) is ready to use.
"""

import os
import sqlite3
import requests
from datetime import datetime, timezone

DB_PATH = os.environ.get("DB_PATH", "data/sbs.db")

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


# ─── DATA SOURCE SECTION ──────────────────────────────────────────────────────
# Replace this section with your actual data fetching logic.
# The function must return a dict with keys matching the schema above.

def fetch_latest_data() -> dict:
    """
    Fetch the latest data from your source.

    Return format:
    {
        "daily": {
            "date": "YYYY-MM-DD",
            "hour": <int>,
            "data_collected_at": "<ISO string>",
            "personnel_killed": <int>,
            "personnel_wounded": <int>,
            "total_targets_hit": <int>,
            "total_targets_destroyed": <int>,
            "total_personnel_casualties": <int>,
            "targets": {
                <id: int>: {"hit": <int>, "destroyed": <int>},
                ...
            }
        },
        "monthly": {  # same shape but for the current month aggregate
            "date": "YYYY-MM",
            ...
        }
    }

    Example: if your source is a JSON API:
        response = requests.get("https://your-api.example.com/latest", timeout=10)
        response.raise_for_status()
        raw = response.json()
        # ... map raw to the format above
    """
    raise NotImplementedError(
        "Implement fetch_latest_data() with your actual data source.\n"
        "See the docstring above for the expected return format."
    )


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
    print(f"  Upserted daily_stats for {data['date']} hour {data['hour']}")


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
    print(f"  Upserted monthly_stats for {data['date']}")


# ─── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
    print(f"Connecting to {DB_PATH}")
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row

    ensure_schema(conn)

    print("Fetching latest data...")
    latest = fetch_latest_data()

    print("Upserting...")
    upsert_daily(conn, latest["daily"])
    upsert_monthly(conn, latest["monthly"])

    conn.close()
    print("Done.")


if __name__ == "__main__":
    main()
