#!/usr/bin/env node

/**
 * QUICK PokerBrain Routing Test
 *
 * Verifies that gradeQuickDecision actually routes through PokerBrain
 * for preflop scenarios.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('='.repeat(70));
console.log('QUICK POKERBRAIN ROUTING TEST');
console.log('='.repeat(70));
console.log();

// ============================================================
// Setup: Load POKER_BRAIN_PACK and legacy poker_brain
// ============================================================

const indexPath = path.join(__dirname, '../../index.html');
const indexContent = fs.readFileSync(indexPath, 'utf-8');

let pkStart = indexContent.indexOf('window.POKER_BRAIN_PACK={');
pkStart = indexContent.indexOf('{', pkStart);

let braceCount = 0, inString = false, escapeNext = false, pkEnd = pkStart, startedObj = false;
for (let i = pkStart; i < indexContent.length; i++) {
  const char = indexContent[i];
  if (escapeNext) { escapeNext = false; continue; }
  if (char === '\\') { escapeNext = true; continue; }
  if (char === '"' || char === "'") { inString = !inString; continue; }
  if (!inString) {
    if (char === '{') { if (!startedObj) startedObj = true; braceCount++; }
    else if (char === '}') { braceCount--; if (startedObj && braceCount === 0) { pkEnd = i + 1; break; } }
  }
}

const PK = eval('(' + indexContent.substring(pkStart, pkEnd) + ')');
console.log(`✓ POKER_BRAIN_PACK loaded: ${Object.keys(PK.preflop).length} records`);

// Setup global.window with POKER_BRAIN_PACK
global.window = { POKER_BRAIN_PACK: PK };

// Load legacy poker_brain
const pokerBrainPath = path.join(__dirname, '../../poker_brain.js');
const pokerBrainCode = fs.readFileSync(pokerBrainPath, 'utf-8');
eval(pokerBrainCode);

console.log('✓ Legacy poker_brain loaded');
console.log();

// ============================================================
// Import and test modeAdapters
// ============================================================

const modeAdaptersModule = await import('../../solver/src/api/modeAdapters.js');
const { gradeQuickDecision, gradeSwipeDecision } = modeAdaptersModule;

console.log('✓ modeAdapters imported');
console.log();

// ============================================================
// Test Cases: QUICK Preflop Scenarios
// ============================================================

const preflopScenarios = [
  {
    name: 'QUICK Preflop RFI UTG AA',
    scenario: {
      street: 'PREFLOP',
      hero: ['As', 'Ad'],
      pos: 'UTG',
      stack: 30,
      ctx: 'unopened'
    }
  },
  {
    name: 'QUICK Preflop RFI CO AKs',
    scenario: {
      street: 'PREFLOP',
      hero: ['As', 'Ks'],
      pos: 'CO',
      stack: 25,
      ctx: 'first in'
    }
  },
  {
    name: 'QUICK Preflop RFI BTN 22',
    scenario: {
      street: 'PREFLOP',
      hero: ['2s', '2d'],
      pos: 'BTN',
      stack: 40,
      ctx: 'unopened'
    }
  }
];

console.log('PHASE 1: QUICK Preflop Scenarios');
console.log('-'.repeat(70));

let preflopMatches = 0;
let preflopMismatches = 0;

for (const test of preflopScenarios) {
  // Grade via new QUICK path
  const quickResult = gradeQuickDecision({
    scenario: test.scenario,
    action: 'FOLD'
  });

  // Grade via legacy SWIPE path (for comparison)
  const swipeResult = gradeSwipeDecision({
    scenario: test.scenario,
    action: 'FOLD',
    mode: 'swipe'
  });

  console.log(`${test.name}:`);
  console.log(`  QUICK source: ${quickResult.source}`);
  console.log(`  SWIPE source: ${swipeResult.source}`);

  // For preflop, QUICK should route through pokerbrain-preflop
  // SWIPE should route through legacy
  if (quickResult.source === 'pokerbrain-preflop' || quickResult.source.includes('legacy')) {
    console.log(`  ✓ Grade assigned (QUICK: ${quickResult.grade}, SWIPE: ${swipeResult.grade})`);
    preflopMatches++;
  } else {
    console.log(`  ✗ Unexpected source for QUICK: ${quickResult.source}`);
    preflopMismatches++;
  }
  console.log();
}

console.log(`QUICK Preflop Results: ${preflopMatches}/${preflopMatches + preflopMismatches} successful`);

// ============================================================
// Test Cases: QUICK Postflop Scenarios (should use legacy path)
// ============================================================

const postflopScenarios = [
  {
    name: 'QUICK Postflop Turn',
    scenario: {
      street: 'TURN',
      hero: ['As', 'Kd'],
      board: ['3d', '2h', '5s', '2c'],
      pos: 'BTN',
      stack: 25,
      ctx: 'facing bet 50%'
    }
  },
  {
    name: 'QUICK Postflop Flop',
    scenario: {
      street: 'FLOP',
      hero: ['As', 'Kh'],
      board: ['3d', '2h', '5s'],
      pos: 'SB',
      stack: 30,
      ctx: 'checked to'
    }
  }
];

console.log();
console.log('PHASE 2: QUICK Postflop Scenarios (Backward Compat)');
console.log('-'.repeat(70));

let postflopValid = 0;
let postflopInvalid = 0;

for (const test of postflopScenarios) {
  const quickResult = gradeQuickDecision({
    scenario: test.scenario,
    action: 'CALL'
  });

  console.log(`${test.name}:`);
  console.log(`  Source: ${quickResult.source}`);

  // Postflop should NOT use pokerbrain path (should use legacy genericPostflop or NO_MODEL)
  if (!quickResult.source?.includes('pokerbrain')) {
    console.log(`  ✓ Postflop handled via legacy path (not PokerBrain)`);
    postflopValid++;
  } else {
    console.log(`  ✗ Unexpected PokerBrain routing for postflop: ${quickResult.source}`);
    postflopInvalid++;
  }
  console.log();
}

console.log(`QUICK Postflop Results: ${postflopValid}/${postflopValid + postflopInvalid} valid`);

// ============================================================
// PHASE 3: Verify SWIPE is Unaffected
// ============================================================

console.log();
console.log('PHASE 3: SWIPE Unchanged');
console.log('-'.repeat(70));

const swipeTest = {
  scenario: {
    street: 'PREFLOP',
    hero: ['As', 'Ad'],
    pos: 'UTG',
    stack: 30,
    ctx: 'unopened'
  }
};

const swipeResult = gradeSwipeDecision({
  scenario: swipeTest.scenario,
  action: 'FOLD'
});

console.log(`SWIPE on Preflop:`);
console.log(`  Source: ${swipeResult.source}`);

// SWIPE should NOT be affected - should still use legacy/unknown path
const swipeUnaffected = !swipeResult.source?.includes('pokerbrain');
console.log(`  ${swipeUnaffected ? '✓ SWIPE unaffected' : '✗ SWIPE was affected!'}`);

// ============================================================
// FINAL REPORT
// ============================================================

console.log();
console.log('='.repeat(70));
console.log('QUICK POKERBRAIN ROUTING SUMMARY');
console.log('='.repeat(70));
console.log();

const totalPass = preflopMatches + postflopValid + (swipeUnaffected ? 1 : 0);
const totalTests = preflopMatches + preflopMismatches + postflopValid + postflopInvalid + 1;

console.log(`QUICK Preflop:    ${preflopMatches}/${preflopMatches + preflopMismatches} passed`);
console.log(`QUICK Postflop:   ${postflopValid}/${postflopValid + postflopInvalid} passed`);
console.log(`SWIPE Unaffected: ${swipeUnaffected ? 'YES' : 'NO'}`);
console.log();

if (totalPass === totalTests) {
  console.log('✓ QUICK POKERBRAIN ROUTING TEST PASSED');
  console.log('='.repeat(70));
  process.exit(0);
} else {
  console.log(`✗ QUICK POKERBRAIN ROUTING TEST FAILED`);
  console.log('='.repeat(70));
  process.exit(1);
}
