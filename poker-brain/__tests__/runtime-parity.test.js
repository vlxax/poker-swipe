#!/usr/bin/env node

/**
 * Runtime Parity Test - Stack & Hand Normalization
 *
 * Verifies that LegacyPreflopProvider normalization functions
 * match the legacy runtime behavior exactly.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { LegacyPreflopProvider } from '../providers/LegacyPreflopProvider.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('='.repeat(70));
console.log('RUNTIME PARITY TEST - NORMALIZATION FUNCTIONS');
console.log('='.repeat(70));
console.log();

// ============================================================
// Load POKER_BRAIN_PACK
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

// ============================================================
// Define Legacy Runtime Normalization Functions
// ============================================================

const R = 'AKQJT98765432';

function legacyNearest(v, arr) {
  // Exact legacy implementation: reduce with < (strict less than)
  return arr.reduce((a, b) => Math.abs(b - v) < Math.abs(a - v) ? b : a, arr[0]);
}

function legacyClassOf(cards = []) {
  if (cards.length < 2) return null;
  const a = cards[0][0], b = cards[1][0];
  const ia = R.indexOf(a), ib = R.indexOf(b);
  if (ia < 0 || ib < 0) return null;
  if (a === b) return a + a;
  const suited = cards[0].slice(1) === cards[1].slice(1);
  return ia < ib ? a + b + (suited ? 's' : 'o') : b + a + (suited ? 's' : 'o');
}

function legacyParseCards(input = []) {
  if (Array.isArray(input)) return input;
  const str = String(input).trim();
  if (!str) return [];
  const suits = ['s', 'h', 'd', 'c'];
  let cards = [], i = 0;
  while (i < str.length) {
    if (i + 1 < str.length && R.includes(str[i]) && suits.includes(str[i + 1].toLowerCase())) {
      cards.push(str[i] + str[i + 1].toLowerCase());
      i += 2;
    } else if (R.includes(str[i])) {
      const suit = suits[(cards.length % 4)];
      cards.push(str[i] + suit);
      i++;
    } else {
      i++;
    }
  }
  return cards;
}

console.log('✓ Legacy runtime functions defined');

// Initialize provider
const provider = new LegacyPreflopProvider(PK);
console.log('✓ LegacyPreflopProvider initialized');
console.log();

// ============================================================
// PHASE 1: Stack Normalization Boundary Testing
// ============================================================

console.log('PHASE 1: Stack Normalization Boundaries');
console.log('-'.repeat(70));

const stackTestValues = [
  1, 5, 9, 10, 15, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 34, 35, 36, 39, 40, 41, 44, 45, 46, 49, 50, 51, 60, 100
];

let stackMatches = 0;
const stackMismatches = [];

for (const stackVal of stackTestValues) {
  const legacyResult = legacyNearest(stackVal, [20, 25, 30, 40, 50]);
  const newResult = Number(provider._normalizeStack(stackVal));

  if (legacyResult === newResult) {
    stackMatches++;
  } else {
    stackMismatches.push({ input: stackVal, legacy: legacyResult, new: newResult });
  }
}

console.log(`Stack Normalization: ${stackMatches}/${stackTestValues.length} matched`);
if (stackMismatches.length > 0) {
  console.log('MISMATCHES:');
  stackMismatches.forEach(m => {
    console.log(`  ${m.input} → Legacy: ${m.legacy}, New: ${m.new}`);
  });
}

// ============================================================
// PHASE 2: Hand Class Normalization
// ============================================================

console.log();
console.log('PHASE 2: Hand Class Normalization');
console.log('-'.repeat(70));

const handTestCases = [
  { input: 'AA', expected: 'AA' },
  { input: 'KK', expected: 'KK' },
  { input: 'AKs', expected: 'AKs' },
  { input: 'aks', expected: 'AKs' },
  { input: 'ako', expected: 'AKo' },
  { input: 'AKo', expected: 'AKo' },
  { input: 'aKo', expected: 'AKo' },
  { input: 'k3s', expected: 'K3s' },
  { input: '3ks', expected: 'K3s' },
  { input: 'K3o', expected: 'K3o' },
  { input: '3ko', expected: 'K3o' },
  { input: 'A2s', expected: 'A2s' },
  { input: 'A2o', expected: 'A2o' },
  { input: 'QJs', expected: 'QJs' },
  { input: 'JTs', expected: 'JTs' },
  { input: 'T9s', expected: 'T9s' },
  { input: '98s', expected: '98s' },
  { input: '22', expected: '22' },
  { input: 'kk', expected: 'KK' },
];

let handMatches = 0;
const handMismatches = [];

for (const test of handTestCases) {
  const result = provider._normalizeHand(test.input);
  if (result === test.expected) {
    handMatches++;
  } else {
    handMismatches.push({ input: test.input, expected: test.expected, got: result });
  }
}

console.log(`Hand Normalization: ${handMatches}/${handTestCases.length} matched`);
if (handMismatches.length > 0) {
  console.log('MISMATCHES:');
  handMismatches.forEach(m => {
    console.log(`  "${m.input}" → Expected: ${m.expected}, Got: ${m.got}`);
  });
}

// ============================================================
// PHASE 3: Lookup Consistency
// ============================================================

console.log();
console.log('PHASE 3: Lookup Consistency');
console.log('-'.repeat(70));

// Generate sample canonical contexts and verify lookups work
const testContexts = [
  { situation: 'RFI', heroPosition: 'UTG', heroStack: 30, handClass: 'AA' },
  { situation: 'RFI', heroPosition: 'UTG', heroStack: 30, handClass: 'AKs' },
  { situation: 'RFI', heroPosition: 'CO', heroStack: 25, handClass: 'K3s' },
  { situation: 'BB_DEFEND', heroPosition: 'BB', heroStack: 30, handClass: 'AA' },
  { situation: 'VS_OPEN', heroPosition: 'HJ', villainPosition: 'CO', heroStack: 30, handClass: 'QQ' },
  { situation: 'VS_OPEN', heroPosition: 'BTN', villainPosition: 'UTG', heroStack: 40, handClass: 'A2s' },
  { situation: 'VS_3BET', heroPosition: 'BTN', heroStack: 20, handClass: 'JJ' },
];

let lookupMatches = 0;
const lookupErrors = [];

for (const ctx of testContexts) {
  try {
    const result = provider.lookup(ctx);
    // Just verify it returns either a policy object or null
    if (result === null || (typeof result === 'object' && Object.keys(result).length > 0)) {
      lookupMatches++;
    } else {
      lookupErrors.push({ context: ctx, error: 'Invalid return type' });
    }
  } catch (e) {
    lookupErrors.push({ context: ctx, error: e.message });
  }
}

console.log(`Lookup Consistency: ${lookupMatches}/${testContexts.length} successful`);
if (lookupErrors.length > 0) {
  console.log('ERRORS:');
  lookupErrors.forEach(e => {
    console.log(`  ${JSON.stringify(e.context)} → ${e.error}`);
  });
}

// ============================================================
// PHASE 4: Missing Policy Behavior
// ============================================================

console.log();
console.log('PHASE 4: Missing Policy Behavior');
console.log('-'.repeat(70));

const missingTests = [
  { situation: 'UNKNOWN', heroPosition: 'UTG', heroStack: 30, handClass: 'AA' },
  { situation: 'RFI', heroPosition: 'UNKNOWN', heroStack: 30, handClass: 'AA' },
  { situation: 'RFI', heroPosition: 'UTG', heroStack: 30, handClass: 'UNKNOWN' },
  { situation: 'RFI', heroPosition: 'UTG', heroStack: 30, handClass: 'XX' },
];

let nullMatches = 0;
const nullErrors = [];

for (const test of missingTests) {
  const result = provider.lookup(test);
  if (result === null) {
    nullMatches++;
  } else {
    nullErrors.push({ context: test, returned: result });
  }
}

console.log(`Missing Policy Returns Null: ${nullMatches}/${missingTests.length}`);
if (nullErrors.length > 0) {
  console.log('ERRORS (expected null, got policy):');
  nullErrors.forEach(e => {
    console.log(`  ${JSON.stringify(e.context)}`);
  });
}

// ============================================================
// FINAL REPORT
// ============================================================

console.log();
console.log('='.repeat(70));
console.log('RUNTIME PARITY SUMMARY');
console.log('='.repeat(70));
console.log();

const allPass = stackMismatches.length === 0 &&
                handMismatches.length === 0 &&
                lookupErrors.length === 0 &&
                nullErrors.length === 0;

console.log(`Stack Normalization Parity:  ${stackMismatches.length === 0 ? '✓ PASS' : '✗ FAIL'} (${stackMatches}/${stackTestValues.length})`);
console.log(`Hand Normalization Parity:   ${handMismatches.length === 0 ? '✓ PASS' : '✗ FAIL'} (${handMatches}/${handTestCases.length})`);
console.log(`Lookup Consistency:          ${lookupErrors.length === 0 ? '✓ PASS' : '✗ FAIL'} (${lookupMatches}/${testContexts.length})`);
console.log(`Missing Policy Behavior:     ${nullErrors.length === 0 ? '✓ PASS' : '✗ FAIL'} (${nullMatches}/${missingTests.length})`);
console.log();
console.log('='.repeat(70));

if (allPass) {
  console.log('✓ RUNTIME PARITY TESTS PASSED');
  console.log('='.repeat(70));
  process.exit(0);
} else {
  console.log('✗ RUNTIME PARITY TESTS FAILED');
  console.log('='.repeat(70));
  process.exit(1);
}
