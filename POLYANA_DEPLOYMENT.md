# Polyana Live Sync — Deployment Configuration

**Date**: 2026-08-26  
**Status**: ✅ DEPLOYED — GitHub Actions scheduled sync active

---

## Deployment Architecture

### Scheduler: GitHub Actions

**Workflow File**: `.github/workflows/polyana-sync.yml`

**Schedule**: Every 10 minutes  
```
cron: "*/10 * * * *"  (UTC)
```

**Trigger**: 
- Automatic schedule every 10 minutes
- Manual trigger via `workflow_dispatch`

---

## Sync Pipeline

```
Every 10 minutes (UTC)
    ↓
[GitHub Actions ubuntu-latest runner]
    ↓
1. Checkout repository
2. Setup Python 3.12
3. Install dependencies (requests, beautifulsoup4)
4. Run: python scripts/update_polyana_v2.py
    ├─ Fetch pokernomoney.ru homepage
    ├─ Parse tournaments, clubs, addresses
    ├─ Detect game types (NLH/PLO/PLO5)
    ├─ Detect districts from addresses
    ├─ Extract verified late registration
    ├─ Backup existing data
    ├─ Write JSON: live_polyana.json
    ├─ Write JSON: moscow_schedule_today.json
    ├─ Write JSON: moscow_clubs_pokernomoney.json
    ├─ Write state: .polyana_sync_state.json
    └─ On failure: restore from backup (last-known-good)
5. Commit changes (if data changed)
6. Push to repository
    ↓
[Data updated in git repository]
    ↓
[Deployed as static files]
    ↓
[Polyana UI reads and renders]
```

---

## Production Data Files

All files in `data/` directory:

| File | Purpose | Updated By |
|------|---------|-----------|
| `live_polyana.json` | All clubs + full events | v2 parser |
| `moscow_schedule_today.json` | Today's tournaments only | v2 parser |
| `moscow_clubs_pokernomoney.json` | Clubs with schedules | v2 parser |
| `.polyana_sync_state.json` | Sync metadata & success time | v2 parser |

---

## Data Enhancement Pipeline

### update_polyana_v2.py (497 lines)

**Input**: pokernomoney.ru homepage HTML

**Processing**:
1. `detect_game_type(text)` → NLH/PLO/PLO5/None
   - Pattern-based detection with priority (PLO5 > PLO > NLH)
   - English and Russian variants supported
   - Expected coverage: 90%+

2. `detect_district(address)` → Moscow district name/None
   - Keyword mapping from address text
   - Covers: Центральный, Замоскворечье, Басманный, Красносельский, Таганский, Якиманка
   - Expected coverage: 80%+

3. `late_from_card(text, start)` → (raw_time, minutes_from_start)/None
   - Parses late registration deadline
   - Validates against start time (0–12 hours maximum)
   - Verified source only (no defaults)
   - Sets `late_reg_source: "homepage_text"` for tracked data

4. Deduplication via URL MD5 hash (`_id` field)

5. Metadata tracking:
   - `fetched_at`: ISO 8601 timestamp
   - `source`: "https://pokernomoney.ru"
   - `late_reg_source`: Source of late-reg data

**Output**: Enriched JSON with new fields

### JavaScript Integration

`polyana/polyana-integrated.js` normalize() function:

```javascript
const gameFromData = e.game ? String(e.game).toUpperCase() : '';
const districtFromData = e.district || null;
const lateRegSource = e.late_reg_source || null;

return {
  ...e,
  _game: ['NLH','PLO','PLO5'].includes(gameFromData) ? gameFromData : [...fallback...],
  _district: districtFromData,
  _lateRegSource: lateRegSource,
  _fetchedAt: e.fetched_at || null
};
```

**Priority chain**: JSON data → legacy parsing → fallback

---

## Error Handling & Reliability

### Last-Known-Good Fallback

If pokernomoney.ru fetch/parse fails:
1. Backup of previous data exists
2. Script detects error
3. Restores previous valid data
4. Logs failure with timestamp
5. Workflow reports status
6. Next cycle (10 min later) retries

**Status tracking**: `.polyana_sync_state.json` contains:
- `lastSuccessfulSync`: Timestamp of last successful update
- `sourceCount`, `parsedCount`: Event counts
- `clubCount`: Club count
- `gameTypesCovered`, `districtsCovered`: Coverage metrics

### Concurrency Control

No duplicate syncs:
- Lock file mechanism in Python script
- Stale lock auto-cleanup (>5 minutes)
- GitHub Actions natural serialization (runs one workflow per trigger)

### Timeout Protection

- Python script timeout: None specified (will run to completion)
- Workflow timeout: Default GitHub Actions limit (6 hours)
- pokernomoney.ru fetch timeout: 25 seconds

---

## Workflow Configuration

**File**: `.github/workflows/polyana-sync.yml`

```yaml
name: Update Polyana live data

on:
  workflow_dispatch:  # Manual trigger
  schedule:
    - cron: "*/10 * * * *"  # Every 10 minutes UTC

permissions:
  contents: write  # Can commit changes

jobs:
  sync-polyana:
    runs-on: ubuntu-latest
    
    steps:
      - Checkout repository
      - Setup Python 3.12
      - Install dependencies
      - Run update_polyana_v2.py
      - Check sync result
      - Commit & push (if changed)
```

---

## Production Data Flow

```
pokernomoney.ru
    ↓ (fetch every 10 min)
update_polyana_v2.py
    ├─ detect_game_type()
    ├─ detect_district()
    ├─ late_from_card()
    └─ backup/restore
    ↓
live_polyana.json (committed to repo)
    ↓ (deployed as static file)
GitHub Pages / Static hosting
    ↓ (fetched by browser)
polyana-integrated.js
    ├─ normalize(event)
    ├─ Enrich with metadata
    └─ Render UI
    ↓
PokerSwipe Polyana UI
    ├─ Tournament cards
    ├─ Club filter
    ├─ Map
    └─ Late-reg countdown
```

---

## Current Production Status

**Deployment Type**: GitHub Actions scheduled workflow  
**Scheduler**: GitHub's native cron system  
**Production Interval**: Every 10 minutes (UTC)  
**Production Data Path**: `/data/live_polyana.json` (in repository)  

**Update Frequency**: ✅ Every 10 minutes (scheduled)  
**Last Sync State**: Tracked in `.polyana_sync_state.json`  

---

## Testing Checklist

- [x] update_polyana_v2.py compiles without errors
- [x] All 20 unit tests pass
- [x] Game type detection tested (6 tests)
- [x] District detection tested (4 tests)
- [x] Late registration tested (4 tests)
- [x] Backup/restore mechanism tested
- [x] Deduplication verified
- [x] Metadata tracking implemented
- [x] JavaScript integration updated
- [x] Workflow file valid YAML
- [x] .gitignore updated (excludes backups, logs)
- [x] Dependencies declared (requests, beautifulsoup4)

---

## Limitations & Notes

### Network Isolation

The GitHub Actions environment may have different network policies than local development:
- GitHub Actions IP addresses: Likely different from this Claude session
- pokernomoney.ru: May allow/block based on IP
- If 403 occurs in GitHub Actions: Will trigger last-known-good fallback

**Mitigation**: Workflow logs will show fetch success/failure.

### Coverage Expectations

**Before deployment**:
- Game type: 0/43 (0%) — legacy fallback only gets 2.3%
- District: 0/66 (0%)
- Coordinates: 0/66 (0%)
- Verified late-reg: 0/43 (0%)

**After v2 parser runs successfully**:
- Game type: Expected ~35–38/43 (80–90%)
- District: Expected ~40–55/66 (60–80%)
- Coordinates: 0/66 (0%) — Separate geocoding effort needed
- Verified late-reg: Expected ~3–8/43 (7–20%) — Data from pokernomoney.ru only

---

## Monitoring

### Check Sync Status

View latest sync state:
```bash
cat data/.polyana_sync_state.json | jq .
```

Sample output:
```json
{
  "lastSuccessfulSync": "2026-08-26T12:34:56+00:00",
  "sourceCount": 43,
  "parsedCount": 43,
  "clubCount": 66,
  "gameTypesCovered": 37,
  "districtsCovered": 48
}
```

### Check Workflow Status

In GitHub:
1. Go to Actions tab
2. Find "Update Polyana live data" workflow
3. Check recent runs for success/failure
4. View logs for detailed output

### Monitor Real Updates

```bash
# Check when JSON was last modified
stat data/live_polyana.json | grep Modify

# Check if fields are populated
jq '.events[0] | {tournament, game, district, fetched_at}' data/live_polyana.json
```

---

## Next Steps

1. **Verify first successful sync**: Monitor GitHub Actions for next scheduled run (within 10 minutes)
2. **Check data enrichment**: Verify game type, district, fetched_at fields are populated
3. **Test UI rendering**: Verify Polyana displays enriched data correctly
4. **Monitor for errors**: Watch for network/fetch failures
5. **Coordinate geocoding**: Separate effort to populate map coordinates

---

## Production Readiness

✅ **Configuration**: Valid YAML, proper permissions, correct schedule  
✅ **Code**: Tested (20/20 tests pass), error handling implemented  
✅ **Data Pipeline**: Backup/restore, deduplication, metadata tracking  
✅ **Deployment**: Automated via GitHub Actions every 10 minutes  
❌ **Real Deployment Test**: Awaiting first GitHub Actions run to verify pokernomoney.ru fetch succeeds  

**Status**: DEPLOYED — Awaiting real-world validation

---

**Generated**: 2026-08-26 by Deployment Configuration Process
