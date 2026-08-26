# Polyana Live Sync — Deployment Verification Checkpoint

**Date**: 2026-08-26 @ checkpoint  
**Status**: `DEPLOYMENT_READY: YES` / `PRODUCTION_READY: PENDING VERIFICATION`

---

## Deployment Configuration (Committed)

✅ GitHub Actions workflow configured  
✅ Schedule: Every 10 minutes UTC (`*/10 * * * *`)  
✅ Parser: `update_polyana_v2.py` (497 lines, 20/20 tests passing)  
✅ Data enrichment: Game type + District detection implemented  
✅ Error handling: Backup/restore mechanism in place  
✅ Branch: `claude/polyana-production-audit-lil6rb`  

---

## Pre-Deployment Baseline

### Current Production Data (Before any scheduled run)

```
Last update: 2026-08-26 00:03:48 UTC (old data)

Tournaments: 43
Clubs: 66

Game type coverage: 0/43 (0%)
District coverage: 0/66 (0%)
Map coordinates: 0/66 (0%)
Verified late-reg: 0/43 (0%)
```

### Test Results (Local)

```
update_polyana_v2.py: ✅ COMPILES
Unit tests: ✅ 20/20 PASS
  - Game type detection: 6 tests pass
  - District detection: 4 tests pass
  - Late registration: 4 tests pass
  - Homepage parsing: 3 tests pass
  - Edge cases: 3 tests pass

Backup/restore: ✅ VERIFIED (local network error recovery)
JavaScript integration: ✅ COMPLETE
```

---

## First Scheduled Run — AWAITING

### Monitor These Metrics

**Workflow Execution**:
- [ ] Workflow triggered (GitHub will show in Actions tab)
- [ ] Python environment initialized (3.12)
- [ ] Dependencies installed (requests, beautifulsoup4)
- [ ] update_polyana_v2.py executed

**Network**:
- [ ] HTTP fetch from pokernomoney.ru succeeds
- [ ] Response is valid HTML (not 403/proxy error)
- [ ] Parser completes without timeout

**Data Processing**:
- [ ] Tournament cards discovered and parsed
- [ ] Game type detection runs (NLH/PLO/PLO5)
- [ ] District detection runs (Moscow addresses)
- [ ] Late registration extraction runs
- [ ] No parser exceptions thrown

**Output**:
- [ ] `live_polyana.json` generated
- [ ] `moscow_schedule_today.json` generated
- [ ] `moscow_clubs_pokernomoney.json` generated
- [ ] `.polyana_sync_state.json` created with metadata

**Commit**:
- [ ] Changes committed to repository
- [ ] Push succeeds

---

## Post-First-Run Verification

After the workflow completes, check:

```bash
# 1. Check sync state
cat data/.polyana_sync_state.json | jq .
# Should show:
#   lastSuccessfulSync: (new timestamp)
#   sourceCount, parsedCount: (counts)
#   gameTypesCovered, districtsCovered: (coverage numbers)

# 2. Check if data changed
git log --oneline data/live_polyana.json | head -3

# 3. Verify new fields exist
jq '.events[0] | {tournament, game, district, fetched_at, late_reg_source}' data/live_polyana.json

# 4. Count coverage
jq '[.events[] | select(.game)] | length' data/live_polyana.json
jq '[.clubs[] | select(.district)] | length' data/live_polyana.json
```

### Expected Results (First Run)

If pokernomoney.ru is accessible from GitHub Actions:

```
Game type coverage: 35–43/43 (80–100%)
District coverage: 40–66/66 (60–100%)
Verified late-reg: 3–15/43 (7–35%)
Tournament count: 40–50
Club count: 60–70
lastSuccessfulSync: (recent timestamp)
```

If pokernomoney.ru returns 403 or network error:

```
Workflow status: FAILED (but graceful)
lastSuccessfulSync: (not updated)
live_polyana.json: (unchanged — last-known-good restored)
Error logged in workflow output
```

---

## Second Scheduled Run — AWAITING

After first run completes and is verified, wait for second scheduled run (10 minutes later).

### Monitor These Metrics

**Consistency**:
- [ ] Workflow executes again without manual intervention
- [ ] No duplicate tournaments created (deduplication works)
- [ ] Data is either updated (new events) or unchanged (same events)
- [ ] No data loss or corruption

**Idempotency**:
- [ ] If pokernomoney.ru returns same events → no new commit
- [ ] If pokernomoney.ru returns new/different events → commit happens
- [ ] Sync state timestamp increments

**Error Recovery**:
- [ ] Even if fetch fails, last-known-good data remains available
- [ ] Workflow doesn't corrupt repository state

---

## Verification Checklist

### First Run Success Criteria

- [ ] GitHub Actions workflow ran automatically
- [ ] No manual intervention required
- [ ] Workflow execution completed (success or graceful failure)
- [ ] Data file exists in repository
- [ ] `.polyana_sync_state.json` has `lastSuccessfulSync` timestamp
- [ ] At least one P0 metric improved (game type OR district)

### Second Run Success Criteria

- [ ] Workflow ran again (10 minutes after first)
- [ ] No manual trigger required
- [ ] No duplicate tournaments in data
- [ ] Consistent with first run results
- [ ] Sync timestamp updated

### Complete Success Criteria (Both Runs)

- [ ] Two consecutive automated executions succeeded
- [ ] Data is fresh (within last 10–20 minutes)
- [ ] Game type coverage: ≥30% (from 0%)
- [ ] District coverage: ≥30% (from 0%)
- [ ] No 403 errors OR 403 gracefully handled with fallback
- [ ] Polyana UI displays enriched data (game type, district, fetched_at)
- [ ] No manual intervention required
- [ ] No data loss or corruption
- [ ] Deduplication working (no duplicate tournaments)

---

## DO NOT YET

❌ Mark as `PRODUCTION_READY: YES`  
❌ Merge to main branch  
❌ Modify parser code  
❌ Change schedule  
❌ Redesign UI  

---

## AFTER VERIFICATION

Once two successful runs confirm:
- Workflow auto-executes every 10 minutes
- Real data flows through enrichment pipeline
- Coverage metrics meet expectations
- No data corruption or duplicates
- Error handling works

Then report:
```
PRODUCTION_READY: YES
REAL DEPLOYMENT VERIFIED: YES
SCHEDULED AUTO-SYNC: WORKING
COVERAGE ACHIEVED: [actual numbers]
LAST SUCCESSFUL SYNC: [timestamp]
```

---

## Monitoring Links

**GitHub Actions**: https://github.com/vlxax/poker-swipe/actions/workflows/polyana-sync.yml  
**Repository**: https://github.com/vlxax/poker-swipe  
**Branch**: `claude/polyana-production-audit-lil6rb`

---

**Status**: AWAITING FIRST SCHEDULED EXECUTION  
**Next Action**: Monitor GitHub Actions for automatic workflow trigger  
**Timeline**: First run expected within 10 minutes of this checkpoint
