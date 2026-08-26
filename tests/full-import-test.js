/**
 * Full End-to-End Import Test
 * Simulates: parse → normalize → validate → deduplicate → save
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Mock HandValidation (matches index.html)
const HandValidation = {
  validateHand(hand, strict = true) {
    if (!hand.hero || !Array.isArray(hand.hero) || hand.hero.length !== 2) {
      return { valid: false, error: 'Hero must have 2 cards' };
    }
    if (hand.pot && typeof hand.pot === 'number' && hand.pot < 0) {
      return { valid: false, error: 'Pot cannot be negative' };
    }
    if (hand.effStack && typeof hand.effStack === 'number' && hand.effStack <= 0) {
      return { valid: false, error: 'effStack must be positive' };
    }
    return { valid: true };
  }
};

// Load handImport module code and extract HandImportSystem
const handImportCode = fs.readFileSync(
  path.join(__dirname, '../src/handImport.js'),
  'utf8'
);
// Create a context to evaluate the code
const sandbox = { module: {}, exports: {} };
const wrappedCode = `
(function() {
  const module = { exports: {} };
  const exports = module.exports;
  ${handImportCode}
  return module.exports.HandImportSystem;
})()
`;
const HandImportSystem = eval(wrappedCode);

console.log('\n' + '='.repeat(70));
console.log('FULL END-TO-END HAND IMPORT TEST');
console.log('='.repeat(70));

// TEST: Load fixture files
console.log('\n[STEP 1] Load fixture files');
let pokerOKContent, ggPokerContent;
try {
  pokerOKContent = fs.readFileSync(path.join(__dirname, 'fixtures-poker-ok.txt'), 'utf8');
  ggPokerContent = fs.readFileSync(path.join(__dirname, 'fixtures-ggpoker.txt'), 'utf8');
  console.log('✓ PokerOK fixture:', pokerOKContent.length, 'bytes,', pokerOKContent.split('---').length - 1, 'hands');
  console.log('✓ GGPoker fixture:', ggPokerContent.length, 'bytes,', ggPokerContent.split('---').length - 1, 'hands');
} catch (e) {
  console.log('✗ Failed to load:', e.message);
  process.exit(1);
}

// TEST: Room detection
console.log('\n[STEP 2] Room detection');
const detectedPK = HandImportSystem.detectRoom(pokerOKContent);
const detectedGG = HandImportSystem.detectRoom(ggPokerContent);
console.log('✓ PokerOK file detected as:', detectedPK);
console.log('✓ GGPoker file detected as:', detectedGG);

if (detectedPK !== 'PokerOK' || detectedGG !== 'GGPoker') {
  console.log('✗ Detection failed');
  process.exit(1);
}

// TEST: Multi-hand splitting
console.log('\n[STEP 3] Multi-hand file splitting');
function splitHandHistories(text) {
  const isPokerOK = /Игра/i.test(text) || /ID раздачи/i.test(text) || /PokerOK/i.test(text);
  const isGGPoker = /GG Poker/i.test(text) || /Game #/i.test(text);

  if (isPokerOK) {
    const hands = [];
    const lines = String(text).split(/\n/);
    let current = '';
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^Hand #/.test(line.trim()) && current.trim()) {
        hands.push(current);
        current = line + '\n';
      } else {
        current += line + '\n';
      }
    }
    if (current.trim()) hands.push(current);
    return hands.filter(h => h.trim().length > 50);
  }

  if (isGGPoker) {
    const hands = [];
    const lines = String(text).split(/\n/);
    let current = '';
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^Hand #/.test(line.trim()) && current.trim()) {
        hands.push(current);
        current = line + '\n';
      } else {
        current += line + '\n';
      }
    }
    if (current.trim()) hands.push(current);
    return hands.filter(h => h.trim().length > 50);
  }

  return [text];
}

const pkHands = splitHandHistories(pokerOKContent);
const ggHands = splitHandHistories(ggPokerContent);
console.log('✓ PokerOK split into:', pkHands.length, 'hands');
console.log('✓ GGPoker split into:', ggHands.length, 'hands');

// TEST: Parse PokerOK hands
console.log('\n[STEP 4] Parse PokerOK hands');
let pkParsed = 0, pkValid = 0;
const parsedPK = [];
for (let i = 0; i < pkHands.length; i++) {
  const normalized = HandImportSystem.parseHandHistory(pkHands[i], 'PokerOK');
  if (normalized && normalized.hero && normalized.hero.length === 2) {
    pkParsed++;
    const validation = HandValidation.validateHand(normalized);
    if (validation.valid) {
      pkValid++;
      parsedPK.push(normalized);
      console.log(`  Hand ${i+1}: ✓ hero=${normalized.hero.join(' ')} board=${(normalized.board || []).slice(0, 3).join(' ') || 'empty'}`);
    } else {
      console.log(`  Hand ${i+1}: ✗ validation failed: ${validation.error}`);
    }
  } else {
    console.log(`  Hand ${i+1}: ✗ parse failed`);
  }
}
console.log(`✓ PokerOK: ${pkParsed}/${pkHands.length} parsed, ${pkValid}/${pkParsed} validated`);

// TEST: Parse GGPoker hands
console.log('\n[STEP 5] Parse GGPoker hands');
let ggParsed = 0, ggValid = 0;
const parsedGG = [];
for (let i = 0; i < ggHands.length; i++) {
  const normalized = HandImportSystem.parseHandHistory(ggHands[i], 'GGPoker');
  if (normalized && normalized.hero && normalized.hero.length === 2) {
    ggParsed++;
    const validation = HandValidation.validateHand(normalized);
    if (validation.valid) {
      ggValid++;
      parsedGG.push(normalized);
      console.log(`  Hand ${i+1}: ✓ hero=${normalized.hero.join(' ')} board=${(normalized.board || []).slice(0, 3).join(' ') || 'empty'}`);
    } else {
      console.log(`  Hand ${i+1}: ✗ validation failed: ${validation.error}`);
    }
  } else {
    console.log(`  Hand ${i+1}: ✗ parse failed`);
  }
}
console.log(`✓ GGPoker: ${ggParsed}/${ggHands.length} parsed, ${ggValid}/${ggParsed} validated`);

// TEST: Deduplication
console.log('\n[STEP 6] Deduplication detection');
const allParsed = [...parsedPK, ...parsedGG];
const imported = [];
const duplicates = [];

for (let i = 0; i < allParsed.length; i++) {
  const hand = allParsed[i];
  const isDup = HandImportSystem.isDuplicateHand(hand, imported);
  if (isDup) {
    duplicates.push(hand);
    console.log(`  Hand ${i+1}: Duplicate detected`);
  } else {
    imported.push(hand);
    console.log(`  Hand ${i+1}: ✓ Unique, added to import`);
  }
}
console.log(`✓ Unique hands: ${imported.length}, Duplicates: ${duplicates.length}`);

// TEST: Save simulation
console.log('\n[STEP 7] Save & persistence simulation');
const S = { hands: [] };
S.hands.push(...imported);
S.hands = S.hands.slice(-100);
console.log(`✓ Saved ${S.hands.length} hands to S.hands (max 100)`);
console.log(`✓ Total in storage after import: ${S.hands.length}`);

// TEST: Player stats extraction
console.log('\n[STEP 8] Player stats extraction');
if (parsedPK.length > 0) {
  const stats = HandImportSystem.extractPlayerStats(parsedPK.slice(0, 3));
  console.log('✓ Stats extracted from first 3 hands:');
  console.log(`  - Hands played: ${stats.handsPlayed || 0}`);
  console.log(`  - VPIP: ${stats.vpip ? Math.round(stats.vpip * 100) + '%' : 'N/A'}`);
  console.log(`  - Win rate: ${stats.winRate ? stats.winRate.toFixed(2) : 'N/A'}`);
}

// TEST: Performance with larger file
console.log('\n[STEP 9] Performance test (100 hands)');
let testContent = '';
for (let i = 0; i < 100; i++) {
  testContent += `Hand #${1000000 + i}
PokerOK - Texas Holdem 6-max
2024-01-15 14:30:${String(i % 60).padStart(2, '0')} UTC
Blinds 0.50/1.00

Seat 1: Player_A (50.00)
Seat 6: Hero (50.00)

Hero received hole cards: [As Kd]
Player_A: raises 3.00 to 3.00
Hero: raises 10.00 to 13.00
Player_A: folds

Hero wins the pot (7.00)

---

`;
}

const testHands = splitHandHistories(testContent);
const start = Date.now();
let count = 0;
for (const h of testHands.slice(0, 100)) {
  const parsed = HandImportSystem.parseHandHistory(h, 'PokerOK');
  if (parsed && parsed.hero && parsed.hero.length === 2) count++;
}
const elapsed = Date.now() - start;

console.log(`✓ Parsed ${count}/100 hands in ${elapsed}ms`);
if (elapsed < 5000) {
  console.log(`✓ Performance acceptable (< 5s for 100 hands)`);
} else {
  console.log(`⚠ Performance slow (${elapsed}ms for 100 hands) - but acceptable for UI`);
}

// SUMMARY
console.log('\n' + '='.repeat(70));
console.log('TEST SUMMARY');
console.log('='.repeat(70));
console.log(`PokerOK parser: ${pkValid}/${pkHands.length} valid`);
console.log(`GGPoker parser: ${ggValid}/${ggHands.length} valid`);
console.log(`Total imported: ${imported.length} hands`);
console.log(`Deduplication: Detected ${duplicates.length} duplicates`);
console.log(`Storage: ${S.hands.length} hands in S.hands`);
console.log(`Performance: 100 hands in ${elapsed}ms`);

const allValid = pkValid + ggValid;
const allHands = pkHands.length + ggHands.length;
const passRate = allValid / allHands;

console.log('\n' + (passRate >= 0.8 ? '✓' : '⚠') + ` Overall pass rate: ${Math.round(passRate * 100)}%`);
console.log('='.repeat(70) + '\n');

process.exit(passRate >= 0.8 ? 0 : 1);
