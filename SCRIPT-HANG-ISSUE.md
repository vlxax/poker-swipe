# Script Execution Hang in JSDOM (jsdom 26.1.0)

## Problem

When using `runScripts: 'dangerously'` in JSDOM to load and execute index.html, the JSDOM constructor hangs indefinitely. The HTML and CSS load fine, but script execution is blocked.

## Diagnosis

- **Status**: Identified but root cause not yet determined
- **Location**: index.html loads ~80 JavaScript files
- **Symptom**: After the JSDOM constructor loads all CSS and JS resources successfully, execution never completes when runScripts is set to 'dangerously'
- **Timing**: Hang occurs during script execution, not resource loading

## Current Workaround

Changed `runScripts: 'dangerously'` to `runScripts: 'outside-only'` in:
- tests/polyana_regression.js
- tests/polyana_map.js

This prevents the hang but also prevents scripts from executing, so tests that require JavaScript functionality will fail.

## Likely Causes (in order of probability)

1. **Infinite loop** in one of the loaded scripts
2. **Unresolved Promise** blocking the event loop
3. **Synchronous wait** for a resource or condition that never happens
4. **Module loading issue** with the custom ResourceLoader

## Scripts to Investigate

The last scripts loaded before JSDOM hangs are:
- /poker_swipe_v40.js (95 lines, sets up tournament UI)
- /poker_brain_v34.js (165 lines)
- /poker_swipe_v34.js (298 lines)
- And possibly inline <script> blocks that execute during page parsing

## How to Debug

1. Create a test that loads index.html with `runScripts: 'outside-only'`
2. Manually extract and run each script with a timeout
3. Find which one causes execution to hang
4. Once identified, examine that script for:
   - Infinite loops (while, for, setInterval)
   - Unresolved promises
   - Blocking synchronous operations
   - External resource dependencies

## Files Modified

- tests/polyana_regression.js: Fixed jsdom 26.1.0 API (requestInterceptor → ResourceLoader)
- tests/polyana_map.js: Same fix as above

## Next Steps

1. Identify the specific script causing the hang
2. Fix the hanging script (likely add timeout guards or remove infinite loops)
3. Switch back to `runScripts: 'dangerously'`
4. Verify tests pass with full script execution
