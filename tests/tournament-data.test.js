import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');

(async () => {
  // Check that canonical tournament data files exist
  const scheduleFile = path.join(root, 'data/moscow_schedule_today.json');
  const polyanaFile = path.join(root, 'data/live_polyana.json');

  assert.ok(fs.existsSync(scheduleFile), 'data/moscow_schedule_today.json exists');
  assert.ok(fs.existsSync(polyanaFile), 'data/live_polyana.json exists');

  // Load and verify tournament data
  const schedule = JSON.parse(fs.readFileSync(scheduleFile, 'utf8'));
  const polyana = JSON.parse(fs.readFileSync(polyanaFile, 'utf8'));

  assert.ok(Array.isArray(schedule.events), 'schedule has events array');
  assert.ok(schedule.events.length > 0, 'schedule has tournaments (not empty)');

  console.log(`✓ Tournament data files verified`);
  console.log(`  - schedule.json: ${schedule.events.length} tournaments`);
  console.log(`  - last updated: ${schedule.updated_at}`);

  // Verify v40 hardcoded data is NOT being used
  // The old code had hardcoded TODAY with 3 items, EVENTS with 6 items
  // With the fix, renderTournaments23 should load from canonical sources

  // Check that poker_swipe_v40.js does NOT hijack renderTournaments23
  const v40Content = fs.readFileSync(path.join(root, 'poker_swipe_v40.js'), 'utf8');

  assert.ok(
    !v40Content.includes('window.renderTournaments23=function(){render()}'),
    'v40 does NOT hijack renderTournaments23 (fix applied)'
  );

  console.log('✓ v40 hijacking removed (real data will be loaded)');

  // Verify localStorage key is version-agnostic
  const storageKey = v40Content.match(/const STORE='([^']+)'/);
  assert.ok(storageKey, 'v40 has STORE constant');
  assert.equal(storageKey[1], 'pokerswipe.polyana.state', 'Storage key is version-agnostic');

  console.log('✓ Storage key is version-agnostic (state persists on upgrades)');

  console.log('\n✓ Tournament data test: PASS');
  process.exit(0);
})().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
