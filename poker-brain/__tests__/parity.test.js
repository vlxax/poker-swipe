#!/usr/bin/env node

/**
 * Exhaustive Parity Test for PokerBrain Slice 1
 *
 * Verifies that LegacyPreflopProvider returns EXACT policy equality
 * for all 18,590 POKER_BRAIN_PACK.preflop records.
 *
 * Methodology:
 * 1. Load POKER_BRAIN_PACK from index.html
 * 2. Load new PokerBrain and LegacyPreflopProvider modules
 * 3. For each of 18,590 records:
 *    - Parse legacy key (4-part or 5-part)
 *    - Construct normalized context
 *    - Call LegacyPreflopProvider.lookup(context)
 *    - Deep compare returned policy with legacy policy
 * 4. Require 18,590/18,590 exact matches
 * 5. Report results and exit with appropriate code
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PokerBrain } from '../PokerBrain.js';
import { LegacyPreflopProvider } from '../providers/LegacyPreflopProvider.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================
// 1. LOAD POKER_BRAIN_PACK FROM INDEX.HTML
// ============================================================

console.log('='.repeat(60));
console.log('POKERBRAIN PARITY TEST - SLICE 1');
console.log('='.repeat(60));
console.log();

console.log('PHASE 1: Loading POKER_BRAIN_PACK from index.html...');

const indexPath = path.join(__dirname, '../../index.html');
const indexContent = fs.readFileSync(indexPath, 'utf-8');

let pkStart = indexContent.indexOf('window.POKER_BRAIN_PACK={');
if (pkStart === -1) {
  console.error('✗ POKER_BRAIN_PACK not found in index.html');
  process.exit(1);
}

pkStart = indexContent.indexOf('{', pkStart);

let braceCount = 0;
let inString = false;
let escapeNext = false;
let pkEnd = pkStart;
let startedObj = false;

for (let i = pkStart; i < indexContent.length; i++) {
  const char = indexContent[i];

  if (escapeNext) {
    escapeNext = false;
    continue;
  }
  if (char === '\\') {
    escapeNext = true;
    continue;
  }
  if (char === '"' || char === "'") {
    inString = !inString;
    continue;
  }
  if (!inString) {
    if (char === '{') {
      if (!startedObj) startedObj = true;
      braceCount++;
    } else if (char === '}') {
      braceCount--;
      if (startedObj && braceCount === 0) {
        pkEnd = i + 1;
        break;
      }
    }
  }
}

const pkStr = indexContent.substring(pkStart, pkEnd);
let PK;
try {
  PK = eval('(' + pkStr + ')');
  console.log('✓ POKER_BRAIN_PACK extracted');
  console.log(`  Total records: ${Object.keys(PK.preflop).length}`);
} catch (e) {
  console.error('✗ Parse error:', e.message);
  process.exit(1);
}

const legacyPreflop = PK.preflop || {};

// ============================================================
// 2. LOAD NEW PROVIDER MODULES
// ============================================================

console.log();
console.log('PHASE 2: Loading new PokerBrain modules...');
console.log('✓ PokerBrain loaded');
console.log('✓ LegacyPreflopProvider loaded');

// ============================================================
// 3. INITIALIZE PROVIDER WITH LEGACY DATA
// ============================================================

console.log();
console.log('PHASE 3: Initializing LegacyPreflopProvider...');

const provider = new LegacyPreflopProvider(PK);
console.log(`✓ Provider initialized with POKER_BRAIN_PACK`);
console.log(`  Source: ${provider.source()}`);
console.log(`  Authority: ${provider.authority()}`);

// ============================================================
// 4. PARITY TEST EXECUTION
// ============================================================

console.log();
console.log('PHASE 4: Running exhaustive parity tests...');
console.log('-'.repeat(60));

const stats = {
  total: 0,
  passed: 0,
  failed: 0,
  null_match: 0,
  null_mismatch: 0,
  value_mismatch: 0,
  deep_eq_failures: [],
  first_failures: []
};

// Iterate all 18,590 keys
for (const legacyKey of Object.keys(legacyPreflop)) {
  const legacyPolicy = legacyPreflop[legacyKey];
  stats.total++;

  // Parse key
  const parts = legacyKey.split('|');
  let situation, heroPosition, villainPosition, stack, handClass;

  if (parts.length === 4) {
    [situation, heroPosition, stack, handClass] = parts;
    villainPosition = null;
  } else if (parts.length === 5) {
    [situation, heroPosition, villainPosition, stack, handClass] = parts;
  } else {
    stats.failed++;
    stats.first_failures.push({
      key: legacyKey,
      reason: `Invalid key format: ${parts.length} parts`
    });
    continue;
  }

  // Construct context
  const context = {
    situation,
    heroPosition,
    heroStack: Number(stack),
    handClass
  };

  if (villainPosition) {
    context.villainPosition = villainPosition;
  }

  // Call provider
  let returnedPolicy;
  try {
    returnedPolicy = provider.lookup(context);
  } catch (err) {
    stats.failed++;
    stats.first_failures.push({
      key: legacyKey,
      reason: `Provider threw: ${err.message}`
    });
    continue;
  }

  // Compare policies (deep equality)
  if (legacyPolicy === null || legacyPolicy === undefined) {
    if (returnedPolicy === null || returnedPolicy === undefined) {
      stats.passed++;
      stats.null_match++;
    } else {
      stats.failed++;
      stats.null_mismatch++;
      stats.first_failures.push({
        key: legacyKey,
        reason: `Legacy returned null, provider returned ${typeof returnedPolicy}`
      });
    }
  } else {
    if (returnedPolicy === null || returnedPolicy === undefined) {
      stats.failed++;
      stats.null_mismatch++;
      stats.first_failures.push({
        key: legacyKey,
        reason: `Legacy returned policy, provider returned null`
      });
    } else {
      // Deep equality check using JSON stringification
      const legacyStr = JSON.stringify(legacyPolicy);
      const returnedStr = JSON.stringify(returnedPolicy);

      if (legacyStr === returnedStr) {
        stats.passed++;
      } else {
        stats.failed++;
        stats.value_mismatch++;
        stats.deep_eq_failures.push({
          key: legacyKey,
          legacy: legacyPolicy,
          returned: returnedPolicy
        });
        if (stats.first_failures.length < 10) {
          stats.first_failures.push({
            key: legacyKey,
            reason: `Deep equality failed`,
            legacy: legacyStr,
            returned: returnedStr
          });
        }
      }
    }
  }

  // Progress indicator
  if (stats.total % 2000 === 0) {
    console.log(`  Processed ${stats.total} records...`);
  }
}

// ============================================================
// 5. REPORT RESULTS
// ============================================================

console.log();
console.log('='.repeat(60));
console.log('PARITY TEST RESULTS');
console.log('='.repeat(60));
console.log();

console.log(`Total Records:        ${stats.total}`);
console.log(`Passed (exact match): ${stats.passed} (${(stats.passed / stats.total * 100).toFixed(2)}%)`);
console.log(`Failed:               ${stats.failed} (${(stats.failed / stats.total * 100).toFixed(2)}%)`);
console.log();

if (stats.null_match > 0) {
  console.log(`  Null matches:       ${stats.null_match}`);
}
if (stats.null_mismatch > 0) {
  console.log(`  Null mismatches:    ${stats.null_mismatch}`);
}
if (stats.value_mismatch > 0) {
  console.log(`  Value mismatches:   ${stats.value_mismatch}`);
}
console.log();

if (stats.failed > 0) {
  console.log('FIRST 10 FAILURES:');
  console.log('-'.repeat(60));
  for (let i = 0; i < Math.min(10, stats.first_failures.length); i++) {
    const failure = stats.first_failures[i];
    console.log(`${i + 1}. Key: ${failure.key}`);
    console.log(`   Reason: ${failure.reason}`);
    if (failure.legacy) {
      console.log(`   Legacy:   ${failure.legacy.substring(0, 100)}`);
    }
    if (failure.returned) {
      console.log(`   Returned: ${failure.returned.substring(0, 100)}`);
    }
    console.log();
  }
}

// ============================================================
// 6. EXIT CODE
// ============================================================

console.log('='.repeat(60));

if (stats.failed === 0) {
  console.log('✓ PARITY TEST PASSED - All 18,590 records match exactly');
  console.log('='.repeat(60));
  process.exit(0);
} else {
  console.log('✗ PARITY TEST FAILED - Some records do not match');
  console.log(`  ${stats.failed} record(s) failed exact equality check`);
  console.log('='.repeat(60));
  process.exit(1);
}
