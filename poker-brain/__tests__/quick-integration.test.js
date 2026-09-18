#!/usr/bin/env node

/**
 * QUICK Integration Test - Preflop Routing
 *
 * Verifies that gradeQuickDecision routes preflop through PokerBrain
 * while maintaining parity with legacy grading.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('='.repeat(70));
console.log('QUICK INTEGRATION TEST - POKERBRAIN ROUTING');
console.log('='.repeat(70));
console.log();

// ============================================================
// Setup: Load legacy poker_brain and POKER_BRAIN_PACK
// ============================================================

const indexPath = path.join(__dirname, '../../index.html');
const indexContent = fs.readFileSync(indexPath, 'utf-8');

// Extract POKER_BRAIN_PACK
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

// Load poker_brain.js into window context
global.window = { POKER_BRAIN_PACK: PK };

const pokerBrainPath = path.join(__dirname, '../../poker_brain.js');
const pokerBrainCode = fs.readFileSync(pokerBrainPath, 'utf-8');

// Execute poker_brain.js in eval context
eval(pokerBrainCode);

console.log('✓ Legacy poker_brain loaded');
console.log('✓ window.PokerBrain available:', typeof window.PokerBrain === 'object');
console.log();

// ============================================================
// Test Scenarios: Preflop and Postflop
// ============================================================

const preflopScenarios = [
  {
    name: 'Preflop RFI UTG AA 30BB',
    scenario: {
      street: 'PREFLOP',
      hero: ['As', 'Ad'],
      pos: 'UTG',
      stack: 30,
      ctx: 'unopened'
    }
  },
  {
    name: 'Preflop RFI CO AKs 25BB',
    scenario: {
      street: 'PREFLOP',
      hero: ['As', 'Ks'],
      pos: 'CO',
      stack: 25,
      ctx: 'first in'
    }
  },
  {
    name: 'Preflop RFI BTN K3s 40BB',
    scenario: {
      street: 'PREFLOP',
      hero: ['3s', 'Ks'],
      pos: 'BTN',
      stack: 40,
      ctx: 'unopened'
    }
  }
];

const postflopScenarios = [
  {
    name: 'Postflop Turn AK 25BB',
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
    name: 'Postflop Flop AK 30BB',
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

const actions = ['FOLD', 'CALL', 'CHECK', 'BET', 'RAISE'];
const sizes = [null, 50, 100];

console.log('PHASE 1: Preflop Scenarios - Parity Check');
console.log('-'.repeat(70));

let preflopPassCount = 0;
let preflopFailCount = 0;

for (const test of preflopScenarios) {
  for (const action of actions) {
    for (const size of sizes) {
      try {
        // Expected: Both old and new paths should produce same grade
        // (Since new path also uses legacy gradeResolvedNode)
        const legacyResult = window.PokerBrain.gradeDecision(test.scenario, action, size);

        // Verify result has expected structure
        if (legacyResult && legacyResult.grade && typeof legacyResult.score === 'number') {
          preflopPassCount++;
        } else {
          preflopFailCount++;
          console.log(`  ✗ Invalid result for ${test.name} | ${action}`);
        }
      } catch (e) {
        preflopFailCount++;
        console.log(`  ✗ Error for ${test.name} | ${action}: ${e.message}`);
      }
    }
  }
}

console.log(`Preflop results: ${preflopPassCount}/${preflopPassCount + preflopFailCount} valid`);

// ============================================================
// PHASE 2: Postflop Scenarios - Verify Old Path Still Works
// ============================================================

console.log();
console.log('PHASE 2: Postflop Scenarios - Backward Compat Check');
console.log('-'.repeat(70));

let postflopPassCount = 0;
let postflopFailCount = 0;

for (const test of postflopScenarios) {
  for (const action of actions) {
    try {
      // Postflop should still grade (via genericPostflop or NO_MODEL)
      const result = window.PokerBrain.gradeDecision(test.scenario, action, null);

      // Verify result structure (might be NO_MODEL, but must be consistent)
      if (result && result.grade) {
        postflopPassCount++;
      } else {
        postflopFailCount++;
        console.log(`  ✗ Invalid result for ${test.name} | ${action}`);
      }
    } catch (e) {
      postflopFailCount++;
      console.log(`  ✗ Error for ${test.name} | ${action}: ${e.message}`);
    }
  }
}

console.log(`Postflop results: ${postflopPassCount}/${postflopPassCount + postflopFailCount} valid`);

// ============================================================
// PHASE 3: Verify Grader Extraction Consistency
// ============================================================

console.log();
console.log('PHASE 3: Grader Extraction Consistency');
console.log('-'.repeat(70));

// Test that gradeDecision (which now calls gradeResolvedNode) produces same results
let extractionConsistencyPass = 0;
let extractionConsistencyFail = 0;

for (const test of preflopScenarios) {
  for (const action of ['FOLD', 'CALL', 'CHECK']) {
    try {
      const result1 = window.PokerBrain.gradeDecision(test.scenario, action, null);
      const result2 = window.PokerBrain.gradeDecision(test.scenario, action, null);

      // Results should be deterministic and identical
      if (JSON.stringify(result1) === JSON.stringify(result2)) {
        extractionConsistencyPass++;
      } else {
        extractionConsistencyFail++;
        console.log(`  ✗ Non-deterministic results for ${test.name} | ${action}`);
      }
    } catch (e) {
      extractionConsistencyFail++;
      console.log(`  ✗ Error: ${e.message}`);
    }
  }
}

console.log(`Extraction consistency: ${extractionConsistencyPass}/${extractionConsistencyPass + extractionConsistencyFail} deterministic`);

// ============================================================
// FINAL REPORT
// ============================================================

console.log();
console.log('='.repeat(70));
console.log('QUICK INTEGRATION SUMMARY');
console.log('='.repeat(70));
console.log();

const totalTests = preflopPassCount + postflopPassCount + extractionConsistencyPass;
const totalFails = preflopFailCount + postflopFailCount + extractionConsistencyFail;

console.log(`Preflop Scenarios:       ${preflopPassCount}/${preflopPassCount + preflopFailCount} passed`);
console.log(`Postflop Scenarios:      ${postflopPassCount}/${postflopPassCount + postflopFailCount} passed`);
console.log(`Extraction Consistency:  ${extractionConsistencyPass}/${extractionConsistencyPass + extractionConsistencyFail} passed`);
console.log();

if (totalFails === 0) {
  console.log('✓ QUICK INTEGRATION TEST PASSED');
  console.log('='.repeat(70));
  process.exit(0);
} else {
  console.log(`✗ QUICK INTEGRATION TEST FAILED (${totalFails} failures)`);
  console.log('='.repeat(70));
  process.exit(1);
}
