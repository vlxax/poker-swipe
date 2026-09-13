#!/usr/bin/env python3
"""
Polyana sync daemon: runs update_polyana_v2.py every 10 minutes.
Handles backoff on errors, prevents concurrent runs.
"""
from __future__ import annotations

import sys
import time
import subprocess
import json
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Optional

SCRIPT = Path(__file__).resolve().parents[0] / "update_polyana_v2.py"
DATA = Path(__file__).resolve().parents[1] / "data"
LOCK_FILE = DATA / ".polyana_sync.lock"
SYNC_LOG = DATA / ".polyana_sync.log"

SYNC_INTERVAL = 10 * 60  # 10 minutes in seconds
BACKOFF_INTERVALS = [30, 60, 120, 300]  # seconds: 30s, 1m, 2m, 5m
MAX_BACKOFF_LEVEL = len(BACKOFF_INTERVALS)

MOSCOW_TZ = timezone(timedelta(hours=3))


def log(msg: str):
    """Write to sync log."""
    now = datetime.now(MOSCOW_TZ).isoformat(timespec="seconds")
    try:
        with SYNC_LOG.open("a", encoding="utf-8") as f:
            f.write(f"[{now}] {msg}\n")
    except Exception:
        pass
    print(msg)


def is_locked() -> bool:
    """Check if another sync is running."""
    if not LOCK_FILE.exists():
        return False
    try:
        data = json.loads(LOCK_FILE.read_text("utf-8"))
        pid = data.get("pid")
        started_at = data.get("started_at")
        # Lock is stale if older than 5 minutes
        if started_at:
            started = datetime.fromisoformat(started_at)
            age = datetime.now(MOSCOW_TZ) - started.replace(tzinfo=MOSCOW_TZ)
            if age.total_seconds() > 300:
                log(f"Stale lock (age={age.total_seconds():.0f}s), removing")
                try:
                    LOCK_FILE.unlink()
                except Exception:
                    pass
                return False
        return True
    except Exception:
        return False


def acquire_lock() -> bool:
    """Acquire lock file."""
    try:
        LOCK_FILE.write_text(
            json.dumps({
                "pid": subprocess.os.getpid(),
                "started_at": datetime.now(MOSCOW_TZ).isoformat(timespec="seconds"),
            }),
            encoding="utf-8"
        )
        return True
    except Exception as e:
        log(f"Failed to acquire lock: {e}")
        return False


def release_lock():
    """Release lock file."""
    try:
        LOCK_FILE.unlink()
    except Exception:
        pass


def run_sync() -> bool:
    """Run update_polyana_v2.py, return True on success."""
    if is_locked():
        log("⏳ Another sync is running, skipping")
        return False

    if not acquire_lock():
        return False

    try:
        log("🔄 Starting Polyana sync...")
        result = subprocess.run(
            [sys.executable, str(SCRIPT)],
            capture_output=True,
            timeout=60,
            text=True,
        )

        if result.returncode == 0:
            log(result.stdout.strip() if result.stdout else "✅ Sync completed")
            return True
        else:
            log(f"❌ Sync failed: {result.stderr.strip() if result.stderr else 'unknown error'}")
            return False

    except subprocess.TimeoutExpired:
        log("❌ Sync timeout (> 60s)")
        return False
    except Exception as e:
        log(f"❌ Sync error: {e}")
        return False
    finally:
        release_lock()


def main():
    """Main daemon loop."""
    log("=" * 60)
    log(f"🚀 Polyana sync daemon started")
    log(f"   Interval: {SYNC_INTERVAL} seconds ({SYNC_INTERVAL // 60} minutes)")
    log(f"   Script: {SCRIPT}")
    log(f"   Log: {SYNC_LOG}")
    log("=" * 60)

    backoff_level = 0
    last_success = None

    while True:
        try:
            success = run_sync()

            if success:
                backoff_level = 0
                last_success = datetime.now(MOSCOW_TZ)
                interval = SYNC_INTERVAL
            else:
                backoff_interval = BACKOFF_INTERVALS[
                    min(backoff_level, MAX_BACKOFF_LEVEL - 1)
                ]
                backoff_level += 1
                log(f"📊 Backoff level {backoff_level}, next attempt in {backoff_interval}s")
                interval = backoff_interval

            # Calculate next sync time
            next_sync = datetime.now(MOSCOW_TZ) + timedelta(seconds=interval)
            log(f"⏰ Next sync at {next_sync.strftime('%H:%M:%S')}")

            time.sleep(interval)

        except KeyboardInterrupt:
            log("💤 Daemon stopped")
            sys.exit(0)
        except Exception as e:
            log(f"💥 Daemon error: {e}")
            time.sleep(30)


if __name__ == "__main__":
    main()
