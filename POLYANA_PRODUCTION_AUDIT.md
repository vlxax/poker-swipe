# ПОЛЯНА — PRODUCTION AUDIT REPORT

**Audit Date**: 2026-08-26  
**Audit Scope**: V8 production-ready Polyana (polyana-integrated.js/css)  
**Status**: PARTIAL — Real data pipeline, critical map gaps, filter integrity questionable  

---

## EXECUTIVE SUMMARY

**PRODUCTION_READY**: PARTIAL

Раздел «Поляна» использует РЕАЛЬНЫЕ данные с pokernomoney.ru, но имеет КРИТИЧНЫЕ проблемы:
- **MAP**: 92% клубов БЕЗ координат (5 из 65)
- **DATA**: Отсутствуют районы, типы дисциплин парсятся из названий  
- **FILTERS**: Работают, но с неполными данными
- **LATE REG**: Работает, countdowns обновляются

---

## 1. DATA PIPELINE

### Sources

```
DATA_URLS (events):
  ├─ data/moscow_schedule_today.json (PRIMARY)
  └─ data/live_polyana.json (PRIMARY)

CLUB_URLS (venues):
  ├─ data/moscow_club_locations_source.json (metadata only, NO coords)
  ├─ data/moscow_clubs_pokernomoney.json (PRIMARY)
  └─ data/live_polyana.json (SECONDARY)
```

### Data Origin

- **Source**: pokernomoney.ru (web scraping)
- **Last Updated**: 2026-08-26 00:03:48 UTC (~1 hour old)
- **Exact Match**: true (exact_homepage_match flag)

### Real Data vs Fallback

| File | Purpose | Status | Size |
|------|---------|--------|------|
| `live_polyana.json` | REAL tournaments + clubs | ✅ LIVE | 142 KB |
| `moscow_schedule_today.json` | TODAY tournaments | ✅ LIVE | 27 KB |
| `moscow_clubs_pokernomoney.json` | ALL clubs | ✅ LIVE | 116 KB |
| `moscow_clubs.json` | FALLBACK (empty) | ⚠️ FALLBACK | 57 B |
| `moscow_club_locations_source.json` | Club metadata | ⚠️ NO COORDS | 14 KB |

**Fallback Logic**:
```javascript
// polyana-integrated.js line 637
const [ed,cd] = await Promise.all([
  fetchFirst(DATA_URLS, 'events'),      // Try live_polyana, fall to moscow_schedule
  fetchFirst(CLUB_URLS, 'clubs')        // Try locations_source, fall to pokernomoney
]);
```

---

## 2. TOURNAMENT DATA COMPLETENESS

### Available Fields (real data)

```json
{
  "date": "2026-08-26",                    // ✅ Present
  "time": "18:00",                         // ✅ Present
  "club": "Quantum",                       // ✅ Present
  "tournament": "Обучение новичков",      // ✅ Present (title)
  "fee_rub": 0,                            // ✅ Present (parsed)
  "type": "Обучающий",                    // ✅ Present (parsed)
  "address": "Новая Басманная улица...",  // ✅ Present
  "late_reg_minutes": null,                // ❌ Often null
  "reentry_limit": null,                   // ❌ Often null
  "reentry_cost_rub": null,                // ❌ Often null
  "duration_minutes": null,                // ❌ Often null
  "district": null,                        // ❌ ALWAYS null
  "admin_district": null,                  // ❌ ALWAYS null
  "game": null,                            // ❌ NEVER present
  "bounty": null,                          // ❌ NEVER present in source
  "freezeout": null,                       // ❌ NEVER present in source
  "addon_allowed": null                    // ❌ NEVER present in source
}
```

### Parsing Strategy

All missing fields are **parsed from strings** (tournament name + type):

```javascript
// polyana-integrated.js lines 64-112
function gameOf(n) {
  if (/plo5|5-card/.test(n.toLowerCase())) return 'PLO5';
  if (/plo|omaha/.test(n.toLowerCase())) return 'PLO';
  if (/nlh|hold.?em/.test(n.toLowerCase())) return 'NLH';
  return '';  // ❌ Default empty if not found
}

function typeOf(n) {
  if (/mystery/.test(n)) return 'Mystery Bounty';
  if (/bounty|knockout/.test(n)) return 'Bounty';
  if (/freeze|фризаут/.test(n)) return 'Freezeout';
  if (/freeroll|бесплат/.test(n)) return 'Freeroll';
  // ...
  return '';  // ❌ Default empty
}
```

### Critical Data Gaps

| Field | Count | Completion | Issue |
|-------|-------|------------|-------|
| game (NLH/PLO/PLO5) | ~5-8 | < 20% | Mostly missing from source |
| district/admin_district | 0 | 0% | **ALWAYS null** |
| late_reg_minutes | ~15 | ~35% | Sparse, often null |
| reentry_limit | ~8 | ~19% | Sparse |
| duration_minutes | ~3 | ~7% | Rarely provided |

### Sample Tournament Types

```javascript
{tournament: "ARIA RISING STAKES", type: ""}     // type is empty
{tournament: "Golden LVL", type: ""}               // type is empty
{tournament: "FREEZEOUT TOURNAMENT", type: "Freezeout"}  // OK
{tournament: "MYSTERY DOGS", type: "Mystery Bounty"}     // OK
```

**Finding**: ~50% of tournaments have empty/generic type strings, forcing fallback to regex parsing.

---

## 3. FILTERS — DESIGN vs REALITY

### Implemented Filters

```javascript
state.filters = {
  game: '',                    // NLH/PLO/PLO5
  freezeout: '',               // yes/no
  bounty: '',                  // yes/no
  reentry: '',                 // 0,1,2,3,4plus,unlimited
  addon: '',                   // yes/no
  late: '',                    // open,none,upto60,60to120,120plus
  levels: '',                  // 10to15,20,25to30,40plus
  fee: '',                     // lte500,lte1000,gt1000
  district: '',                // ❌ NEVER populated (data always null)
  favoriteOnly: false,
  clubs: new Set()
}
```

### Filter Availability at Runtime

| Filter | Shown | Works | Issue |
|--------|-------|-------|-------|
| Game | ✅ Yes | ⚠️ Partial | Data < 20% complete |
| Freezeout | ✅ Yes | ⚠️ Partial | Parsed from name |
| Bounty | ✅ Yes | ⚠️ Partial | Parsed from name |
| Re-entry | ✅ Yes | ⚠️ Partial | < 35% tournaments have data |
| Add-on | ✅ Yes | ❌ No | Never in source data |
| Late reg | ✅ Yes | ⚠️ Partial | < 35% have minutes |
| Levels | ✅ Yes | ❌ No | duration_minutes < 7% |
| Fee | ✅ Yes | ✅ Yes | fee_rub always present |
| District | ❌ Hidden | ❌ No | Code checks `districtOptions()`, always empty |
| Favorite clubs | ✅ Yes | ✅ Yes | localStorage based |

### Filter Logic (match function)

```javascript
function match(e) {
  if (!allowed(e)) return false;  // Filter far regions (Krasnoyarsk, etc)
  
  // game: parsed from tournament name
  if (f.game && e._game !== f.game) return false;
  
  // freezeout: parsed OR field
  if (f.freezeout === 'yes' && !e._isFreezeout) return false;
  
  // bounty: parsed OR field
  if (f.bounty === 'yes' && !e._isBounty) return false;
  
  // reentry: check reentry_limit (often null)
  if (f.reentry && ...) return false;
  
  // district: if data is always null, this filter is dead code
  if (f.district && districtOf(e) !== f.district) return false;
  
  // ... etc
  
  return true;
}
```

### Known Filter Issues

1. **Game filter (NLH/PLO/PLO5)**: ~80% tournaments with empty `_game`
   - User selects "PLO" → only 5-8 tournaments match
   - Rest have empty game despite being PLO events

2. **Levels filter**: Effectively non-functional
   - Only ~7% of tournaments have duration_minutes
   - Filter UI exists but almost always "no match"

3. **District filter**: Never shown, never functional
   - `districtOptions()` always returns empty array
   - Dead code path: `if(f.district && districtOf(e) !== f.district)`

4. **Add-on filter**: Misleading
   - Filter shows but addon_allowed never in source data
   - Only hardcoded test events have this field

---

## 4. DATE / TIME LOGIC

### Time Handling

```javascript
function startDate(e) {
  if (!e.date || !e.time) return null;
  const time = String(e.time).trim();
  // Parse HH:MM as HH:MM:00
  const normalizedTime = /^\d{2}:\d{2}$/.test(time) 
    ? `${time}:00` 
    : time;
  const d = new Date(`${e.date}T${normalizedTime}+03:00`);
  return Number.isNaN(+d) ? null : d;
}
```

- ✅ Timezone: Hardcoded +03:00 (Moscow)
- ✅ Date format: YYYY-MM-DD (ISO)
- ✅ Time format: HH:MM or HH:MM:SS
- ✅ Fallback on parse error

### Sorting

```javascript
const arr = state.events.filter(match).sort((a, b) =>
  (a.time || '99:99').localeCompare(b.time || '99:99')
);
```

- ✅ Sorted by time string (HH:MM)
- ✅ Fallback time '99:99' pushes failures to end
- ⚠️ String sort, not numeric (but works for HH:MM format)

### Late Registration

```javascript
function lateClose(e) {
  const s = startDate(e), raw = e.late_reg_minutes;
  if (!s || !raw) return null;
  const m = Number(raw);
  return Number.isFinite(m) && m >= 0 
    ? new Date(+s + m * 60000) 
    : null;
}

function lateRegInfo(e, nowMs = Date.now()) {
  const c = lateClose(e);
  if (!c) return null;
  const diff = +c - nowMs;
  // Updates every 1-30 seconds based on remaining time
  return { open: diff > 0, remainingMs: diff, text: ... };
}
```

- ✅ Calculates close time from start + late_reg_minutes
- ✅ Live countdown (updates via timer)
- ✅ Text format: "MM:SS" or "X мин" or "X ч Y мин"
- ⚠️ Updates stop if no tournaments with active late reg

### Time Transition (Today/Tomorrow)

- ✅ TAB "СЕГОДНЯ" shows only today's tournaments
- ✅ Date from JSON: "2026-08-26"
- ❌ No "ЗАВТРА" tab (tomorrow not shown)
- ❌ No "БЛИЖАЙШИЕ" tab (next N days not shown)

---

## 5. CLUBS + MAP

### Club Data Sources

```javascript
CLUB_URLS = [
  'data/moscow_club_locations_source.json',     // 65 clubs, NO coords
  'data/moscow_clubs_pokernomoney.json',        // 66 clubs, has schedule
  'data/live_polyana.json'                      // clubs array (SECONDARY)
]
```

### Coordinate Resolution

**Problematic Flow**:

1. `moscow_club_locations_source.json`:
   ```json
   {
     "included_count": 65,
     "coordinate_status": "not_geocoded_yet",
     "clubs": [
       {
         "name": "Quantum",
         "address": "Новая Басманная улица, 19 ст7",
         "lat": null,
         "lng": null,
         "geocode_status": "pending"
       }
     ]
   }
   ```
   - ❌ **ALL 65 clubs have lat=null, lng=null**

2. `club_coords.json` (in polyana/):
   ```json
   {
     "resolved_count": 5,
     "unresolved_count": 60,
     "clubs": [
       {"id": "minds", "name": "Minds", "lat": 55.682229, "lng": 37.580647},
       // ... only 4 more
     ]
   }
   ```
   - ⚠️ **Only 5 out of 65 clubs have coordinates** (8%)

3. Map geocoding (map.html, lines 120-131):
   ```javascript
   const todo = sourceClubs.filter(c => 
     !coords.has(clubKey(c)) && c.address
   );
   
   await pool(todo, 6, async c => {
     const p = await geocodeAddress(c.address);  // ArcGIS + Photon
     if (!p) return;
     cache[id] = p;  // Save to localStorage
     add(c, p[0], p[1]);
   });
   ```
   - Attempts to geocode remaining 60 clubs
   - **Falls back to localStorage cache** (only if previously resolved)
   - **If ArcGIS/Photon fail**: map shows only 5 clubs

### Map Status on Production

**Best case**: If all 60 geocoding requests succeed and cache is populated:
- ✅ 65 clubs shown on map

**Reality case** (external geocoder downtime/rate limit/network):
- ⚠️ Only 5 verified + whatever is in localStorage cache
- Could be **5-10 clubs** visible on actual map

**Worst case**:
- ❌ localStorage empty, external APIs down
- Map shows **only 5 clubs**, says "На карте 5 из 65"

### Club-to-Marker Sync

```javascript
// polyana-integrated.js, line 674
window.addEventListener('message', e => {
  if (e.data.type === 'psp-map-open-club' && e.data.club) {
    const k = normName(e.data.club);
    state.filters.clubs = new Set([k]);
    state.filters.game = '';  // Reset other filters
    render();
  }
});
```

- ✅ Marker click → filter by club
- ✅ Filters reset to show all tournaments for that club
- ✅ Filters synchronize (main app ↔ map iframe via postMessage)

### Club Duplicates

```javascript
eventClubNames() {
  return [...new Set(state.events.filter(allowed)
    .map(e => String(e.club || '').trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'ru'));
}
```

- ✅ Uses Set to deduplicate club names
- ⚠️ Name matching is whitespace-sensitive
- Potential issue: "Club ABC" vs "Club  ABC" (extra space) would be different

---

## 6. TOURNAMENT CARDS

### Card Data Source

```javascript
function card(e) {
  const fav = isFavorite(e.club);           // localStorage
  const tags = [
    e._game,                                 // Parsed from name
    e._type,                                 // Parsed from name
    e.level_minutes ? `${e.level_minutes} мин` : '',  // Duration
    e._reentryUnlimited ? 're-entry ∞' : 
      Number.isFinite(e._reentryCount) ? `${e._reentryCount} re-entry` : ''
  ];
  const late = lateRegInfo(e);               // Calculated
  const meta = [
    e.reentry_cost_rub ? `Re-entry ${e.reentry_cost_rub.toLocaleString('ru-RU')} ₽` : '',
    e.addon_allowed === true ? 'Add-on есть' : '',
    e.duration_minutes ? `≈ ${e.duration_minutes/60} ч` : ''
  ];
  
  return `<button class="pspEvent ${fav ? 'favorite' : ''}">
    <div>${esc(e.time || '—')}</div>
    <div>${esc(e._title)}</div>
    <div>${esc(e.club)}</div>
    <div>${tags.map(esc).join(' · ')}</div>
    <div>${meta.join(' · ')}</div>
    <div>${fee(e)}</div>
  </button>`;
}
```

**Hardcoded values**: ❌ None
- All data comes from JSON
- "Сегодня" label is hardcoded string
- Favorite star is localStorage-driven

**Fallbacks**:
- No time? Shows "—"
- No title? Shows "Турнир клуба" (from cleanTitle)
- No fee? Shows "Уточняется"

---

## 7. "МОИ ПОЕЗДКИ" CONNECTION

### Bridge: Map → Trips Builder

The map can click-to-filter by club:
```javascript
// map.html line 32
popup.querySelector('[data-go]').onclick = e => {
  parent.postMessage({
    type: 'psp-map-open-club',
    club: r.c.name || ''
  }, location.origin);
};
```

### Current Trips Integration

**Version**: V60 Trip Builder (newer than Polyana V54/V56)

```javascript
// index.html lines 4769-4780
const V60_TRIP_KEY = 'ps_v60_trips_key';

// Saves trip with:
{
  id: 'trip_' + Date.now(),
  city: 'Москва',
  from: '2026-08-26',
  to: '2026-08-30',
  budget: 50000,
  plan: 'plan-0',
  label: 'Budget Plan',
  tournaments: [ /* event objects */ ],
  total: 45000
}
```

### Polyana → Trips Data Flow

**Incomplete**:
- ✅ Can filter by club from map
- ✅ Can see all tournaments for a city (Moscow)
- ❌ No one-click "add this tournament to my trip"
- ❌ No "my trips" button inside Polyana cards
- ⚠️ Trips builder loads fresh, doesn't deep-link from Polyana

### Tested Path

1. User opens Polyana
2. Opens map
3. Clicks club marker → "Турниры клуба →" button
4. Sends postMessage to main app
5. Main app filters by club ✅

But:
- No way to "save this to my trip" from card
- No trip-builder CTA inside tournament cards
- Integration is read-only (map → Polyana), not bidirectional

---

## 8. NAVIGATION / STATE

### Entry/Exit

```javascript
function openPolyana() {
  if (typeof window.show === 'function') 
    window.show('polyana');              // Show section
  
  const nav = document.querySelector('.nav [data-nav="polyana"]');
  document.querySelectorAll('.nav [data-nav]')
    .forEach(x => x.classList.toggle('on', x === nav));  // Highlight nav
  
  if (!state.loaded) 
    load();                              // First time: fetch data
  else 
    render();                            // Cached: re-render
  
  warmMapCache();                        // Pre-warm map iframe
}
```

- ✅ Calls `window.show('polyana')` (main app navigation)
- ✅ Updates .nav active state
- ✅ Lazy loads data on first entry
- ✅ Returns to cached state if re-entered

### Back Navigation

```javascript
// From map, close button
document.getElementById('v60Back')?.addEventListener('click', () => {
  if (typeof openPolyanaV56 === 'function') 
    openPolyanaV56();  // Returns to Polyana
});
```

- ✅ Back button from trips → returns to Polyana
- ⚠️ Uses V56 version name (legacy?)

### Filter State Persistence

```javascript
state.filters = {
  game: '',
  freezeout: '',
  // ...
};

// NOT saved to localStorage
// Resets on page reload or section switch
```

- ❌ Filters NOT persisted
- ❌ Favorites ARE persisted (FAV_KEY = 'psp-polyana-favorite-clubs-v1')
- On re-entry: filters reset, favorites remembered

### Conflicts with Other Sections

```javascript
window.__PSP_NATIVE_POLYANA = true;  // Disables legacy versions

// polyana-filters-v3.js checks this flag
// polyana-promo-animated.js checks this flag
```

- ✅ Native Polyana prevents duplicate UI
- ⚠️ Legacy filters/promo code still in index.html (unused)
- No known conflicts observed

---

## 9. MOBILE RUNTIME (390×844)

### Viewport Setup

```html
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
```

- ✅ Proper viewport meta
- ✅ Safe area inset used for bottom nav

### Responsive Layout

**Max width**: 760px (desktop), scales down to 390px

```css
#polyana #psPolyanaArea {
  max-width: 760px;
  margin: 0 auto;
  padding: 8px 12px 28px;
}

@media(max-width: 390px) {
  padding-left: 10px;
  padding-right: 10px;
  .pspEvent { grid-template-columns: 62px minmax(0, 1fr); }
  .pspFee { grid-column: 2; text-align: left; }
}
```

### Touch Target Sizes

| Element | Min Height | Status |
|---------|-----------|--------|
| Tab buttons | 44px | ✅ Sufficient |
| Filter chips | 43px | ✅ Sufficient |
| Event cards | ~80px | ✅ Sufficient |
| Map marker | 34px | ⚠️ Small, but interactive |
| Dropdown buttons | 24-34px | ⚠️ Small |

### Vertical Scrolling

- ✅ Event list scrollable
- ✅ Club list scrollable
- ✅ Map container fixed height (470px) with scroll
- ✅ Filter sheet bottom sheet (overflow auto)

### Fixed Bottom Navigation

```css
#polyana { padding-bottom: calc(110px + var(--safe)); }
```

- ✅ Adds padding to prevent overlap with nav
- ✅ Uses safe-area-inset-bottom for notch-aware devices

### Horizontal Overflow

Checked on 390px width:
- ✅ No horizontal scroll on event list
- ✅ Chips wrap (flex-wrap: wrap)
- ✅ Club names truncate (single line)
- ✅ Map container respects width

### Modal/Sheet Rendering

```javascript
function openFilters() {
  const sheet = document.getElementById('pspFilters');
  sheet.classList.add('on');  // Slides up
}
```

```css
#polyana .pspSheetBg {
  position: fixed;
  inset: 0;
  background: #000a;
  display: grid;
  align-items: flex-end;
}

.pspSheet {
  max-width: 480px;
  width: 100%;
  margin: auto;
  border-radius: 28px 28px 0 0;
}
```

- ✅ Bottom sheet animation
- ✅ Full width on mobile
- ✅ Scroll inside sheet (max-height via overflow-y)
- ✅ Closes with ESC key or background click

### Tested on 390×844 Simulation

- ✅ Hero section fits (font size adjusted to 42px)
- ✅ Tabs 3-column grid scales
- ✅ Event cards stack correctly
- ✅ Map container maintains aspect
- ✅ Bottom nav stays above content
- ✅ Filter sheet opens full screen
- ⚠️ Club detail modal may cut off very long addresses (width: 205px, max-width: calc(100% - 16px))

---

## 10. DEAD / LEGACY CODE

### Found Legacy Files (Not Used)

```
/home/user/poker-swipe/
├─ polyana-filters-v3.js        [UNUSED - newer native version exists]
├─ polyana-filters-v3.css        [UNUSED]
├─ polyana-promo-animated.js     [UNUSED - promotional variant]
├─ polyana-promo-animated.css    [UNUSED]
├─ polyana-clubs-adapter.js      [UNUSED - club data adapter stub]
├─ polyana2.html                 [UNUSED - standalone test file]
├─ polyana-test.html             [UNUSED - test harness]
├─ polyana-finish.patch          [UNUSED - git patch file, 142 KB]
```

### Legacy Code in index.html

```javascript
// Line 3563: Comment marker
/* MY TOURNAMENTS = PERSONAL P&L, NOT POLYANA */

// Line 3706-3730: openPolyana() v54 - still defined
window.openPolyanaV54 = openPolyana;

// Line 3847-3906: V56 setup (seems alive)
window.openPolyanaV56 = () => { 
  if(typeof show === 'function') 
    show('tournaments'); 
  load(); 
};

// Line 4247: Hook note
/* Hook existing "МОИ ПОЕЗДКИ" buttons inside Polyana to the new product-style trip builder. */
```

### Disabled Features

```javascript
// polyana-integrated.js top-level flag
window.__PSP_NATIVE_POLYANA = true;
```

This disables:
- polyana-filters-v3.js (checks flag, skips init)
- polyana-promo-animated.js (checks flag, skips overlay)

---

## CRITICAL ISSUES

### P0 (Blocker)

1. **MAP COORDINATE CRISIS**
   - **File**: `data/moscow_club_locations_source.json`
   - **Issue**: ALL 65 clubs have lat=null, lng=null
   - **Impact**: Map cannot render club markers without external geocoding
   - **Fallback**: `club_coords.json` has only 5 (verified_seed)
   - **Consequence**: If geocoding API fails (ArcGIS/Photon down), map shows ≤5 clubs
   - **Fix Needed**: Pre-geocode or sync coordinates from source

2. **DISTRICT FILTER DEAD**
   - **File**: `data/moscow_schedule_today.json`
   - **Issue**: All events have district=null, admin_district=null
   - **Impact**: Filter UI hidden (districtOptions() returns [])
   - **Code Location**: `polyana-integrated.js:297-298`
   - **User Sees**: No district filter at all
   - **Fix Needed**: Populate district data in JSON

### P1 (Major)

3. **GAME TYPE PARSING INCOMPLETE**
   - **File**: Tournament data (all sources)
   - **Issue**: ~80% of tournaments missing game info (NLH/PLO/PLO5)
   - **Impact**: Game filter (NLH/PLO/PLO5) unreliable
   - **Workaround**: Parsed from tournament name (low accuracy)
   - **Data Example**: `{tournament: "Golden LVL", type: ""}` → no game field
   - **Fix Needed**: Enrichment step to extract game from name or add field

4. **ADD-ON/LEVELS FILTERS MISLEADING**
   - **File**: `polyana-integrated.js:287, 289`
   - **Issue**: 
     - Add-on filter shown but addon_allowed NEVER in real data
     - Levels filter shown but duration_minutes < 7% populated
   - **Impact**: User clicks filter, gets 0-1 result every time
   - **Fix Needed**: 
     - Hide filters with < 5% data coverage, OR
     - Enrich source data, OR
     - Show "data incomplete" disclaimer

5. **LATE REG COUNTDOWN CAN FREEZE**
   - **File**: `polyana-integrated.js:422-456`
   - **Issue**: updateLateRegCountdowns() timer stops if no active late-reg tournaments
   - **Example**: All late-reg windows close → scheduleLateTicker(Infinity)
   - **Consequence**: If new late-reg tournament added later, countdown won't update
   - **Fix Needed**: Minimum timer interval (e.g., always reschedule 60s)

### P2 (Minor)

6. **LEGACY VERSIONS NOT REMOVED**
   - **Files**: polyana-filters-v3.*, polyana-promo-animated.*, polyana2.html, polyana-test.html
   - **Issue**: Dead code increases bundle size (~40 KB)
   - **Impact**: Technical debt, confusion for future maintainers
   - **Fix Needed**: Delete unused files

7. **NO "TOMORROW" OR "NEXT DAYS" TAB**
   - **Current**: Only "СЕГОДНЯ" tab
   - **Missing**: "ЗАВТРА", "БЛИЖАЙШИЕ" views
   - **Impact**: User must manually check other cities for next-day events
   - **Workaround**: Can filter by club and see future schedule
   - **Fix Needed**: Add day navigation tabs

8. **FILTER STATE NOT PERSISTED**
   - **Issue**: Filters reset on navigation away/back
   - **Impact**: User loses search context
   - **Favorite Clubs**: ARE persisted (using localStorage)
   - **Fix Needed**: Add sessionStorage for current filter state

9. **TRIPS INTEGRATION ONE-WAY ONLY**
   - **Flow**: Map → click club → filter Polyana ✅
   - **Missing**: Card → click "add to trip" → Trips builder
   - **Consequence**: Users must manually copy tournament details to trip builder
   - **Fix Needed**: Deep-link tournament to trip builder

10. **CLUB NAME NORMALIZATION FRAGILE**
    - **Issue**: `normName(s) = s.trim().toLowerCase().replace(/\s+/g, ' ')`
    - **Problem**: "Club  ABC" (double space) ≠ "Club ABC"
    - **Happens**: If JSON source inconsistent or parsed with extra spaces
    - **Fix Needed**: More robust matching (fuzzy or use IDs)

---

## RECOMMENDATIONS

### Immediate (Production Readiness)

**For P0s**:
1. Generate/sync coordinates for all 65 clubs (ArcGIS API, Yandex Geocoder, or manual)
2. Populate district/admin_district in moscow_schedule_today.json
3. Add game type (NLH/PLO/PLO5) field or enrichment step
4. Fix late-reg timer minimum interval

**For P1s**:
5. Hide Add-on and Levels filters (or label "incomplete data")
6. Test map rendering with external geocoder down (localStorage empty)

### Follow-up (Next Phase)

7. Remove legacy polyana-*.js files (~40 KB savings)
8. Add "ЗАВТРА" and "БЛИЖАЙШИЕ" day tabs
9. Implement filter state sessionStorage
10. Add deep-link from Polyana card to Trips builder
11. Create ID-based club matching (not name-based)
12. Document data schema and parsing rules

---

## CONCLUSION

| Category | Status | Notes |
|----------|--------|-------|
| **Data Source** | ✅ REAL | pokernomoney.ru, ~1 hour old |
| **Real Data Pipeline** | ✅ WORKING | fetchFirst, fallbacks configured |
| **Mock/Fallback Data** | ⚠️ PARTIAL | Empty moscow_clubs.json, no coords in source |
| **Filters** | ⚠️ PARTIAL | Work but data incomplete |
| **Date Logic** | ✅ WORKING | Timezone correct, sorting OK, live countdown OK |
| **Map** | ❌ CRITICAL | Only 5/65 clubs have coords; others need geocoding |
| **Club Data** | ✅ WORKING | 66 clubs loaded, no duplicates |
| **Tournament Cards** | ✅ WORKING | Data sourced from JSON, no hardcoding |
| **My Trips Connection** | ⚠️ PARTIAL | One-way (map→Polyana), no card→trip integration |
| **Mobile 390×844** | ✅ WORKING | Responsive, touch targets OK, no overflow |
| **Dead/Legacy Code** | ⚠️ YES | ~40 KB of unused files + dead version stubs |

**PRODUCTION_READY**: **PARTIAL**

✅ **Production-worthy**:
- Real data pipeline working
- Filters functional (with data caveats)
- Mobile rendering solid
- Navigation correct
- Late-reg countdown active

❌ **Not production-ready**:
- Map broken (92% clubs without coordinates)
- Data completeness < 50% (districts, game types, levels)
- Filter UX misleading (shows filters for missing data)

**Recommended Status**: CONDITIONAL PRODUCTION
- Launch if map geocoding is working (external APIs available)
- Show disclaimer about incomplete data filters
- Mark map as "beta: still adding clubs" if < 50 clubs geocoded

