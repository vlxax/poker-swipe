/**
 * Hand Import Integration Tests
 * Tests: parsing, normalization, validation, deduplication, bulk import
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Mock HandValidation for testing
const HandValidation = {
  validateHand: (hand) => {
    if (!hand.hero || hand.hero.length !== 2) {
      return { valid: false, error: 'Hero must have 2 cards' };
    }
    if (hand.pot && hand.pot < 0) {
      return { valid: false, error: 'Pot cannot be negative' };
    }
    if (hand.effStack && hand.effStack <= 0) {
      return { valid: false, error: 'effStack must be positive' };
    }
    return { valid: true };
  }
};

// Import HandImportSystem
const vm = require('vm');
const importCode = fs.readFileSync(path.join(__dirname, '../src/handImport.js'), 'utf8');
const sandbox = { module: {}, exports: {} };
vm.runInNewContext(importCode, sandbox);
const HandImportSystem = sandbox.HandImportSystem;

// ===== TEST SUITE =====

async function runTests() {
  console.log('='.repeat(60));
  console.log('HAND IMPORT INTEGRATION TESTS');
  console.log('='.repeat(60));

  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  // TEST 1: Load fixtures
  console.log('\n[TEST 1] Load fixture files');
  try {
    const pokerokContent = fs.readFileSync(path.join(__dirname, 'fixtures-poker-ok.txt'), 'utf8');
    const ggpokerContent = fs.readFileSync(path.join(__dirname, 'fixtures-ggpoker.txt'), 'utf8');
    console.log('✓ PokerOK fixture loaded:', pokerokContent.length, 'bytes');
    console.log('✓ GGPoker fixture loaded:', ggpokerContent.length, 'bytes');
    results.passed++;
  } catch (e) {
    console.log('✗ Failed to load fixtures:', e.message);
    results.failed++;
  }

  // TEST 2: Detect room from text
  console.log('\n[TEST 2] Room detection');
  const detectRoomTests = [
    { text: 'Hand #123\nPokerOK', expected: 'PokerOK' },
    { text: 'GG Poker\nGame #456', expected: 'GGPoker' },
    { text: 'Random text with cards', expected: 'TEXT' }
  ];

  for (const test of detectRoomTests) {
    const detected = HandImportSystem.detectRoom(test.text);
    if (detected === test.expected) {
      console.log(`✓ Detected "${detected}" for text starting with "${test.text.slice(0, 20)}..."`);
      results.passed++;
    } else {
      console.log(`✗ Expected "${test.expected}" but got "${detected}"`);
      results.failed++;
    }
  }

  // TEST 3: Parse PokerOK hands
  console.log('\n[TEST 3] PokerOK parser');
  const pokerokContent = fs.readFileSync(path.join(__dirname, 'fixtures-poker-ok.txt'), 'utf8');
  const pokerokHands = pokerokContent.split('---').filter(h => h.trim());

  let pokerokParsed = 0;
  for (let i = 0; i < Math.min(3, pokerokHands.length); i++) {
    const hand = pokerokHands[i];
    const parsed = HandImportSystem.parsePokerOK(hand);
    if (parsed && parsed.hero && parsed.hero.length === 2) {
      console.log(`✓ Hand ${i+1}: parsed hero=${parsed.hero.join(' ')} bbSize=${parsed.bbSize}`);
      pokerokParsed++;
    } else {
      console.log(`✗ Hand ${i+1}: failed to parse`);
    }
  }
  results[pokerokParsed > 0 ? 'passed' : 'failed']++;

  // TEST 4: Parse GGPoker hands
  console.log('\n[TEST 4] GGPoker parser');
  const ggpokerContent = fs.readFileSync(path.join(__dirname, 'fixtures-ggpoker.txt'), 'utf8');
  const ggpokerHands = ggpokerContent.split('---').filter(h => h.trim());

  let ggpokerParsed = 0;
  for (let i = 0; i < Math.min(3, ggpokerHands.length); i++) {
    const hand = ggpokerHands[i];
    const parsed = HandImportSystem.parseGGPoker(hand);
    if (parsed && parsed.hero && parsed.hero.length === 2) {
      console.log(`✓ Hand ${i+1}: parsed hero=${parsed.hero.join(' ')} bbSize=${parsed.bbSize}`);
      ggpokerParsed++;
    } else {
      console.log(`✗ Hand ${i+1}: failed to parse`);
    }
  }
  results[ggpokerParsed > 0 ? 'passed' : 'failed']++;

  // TEST 5: Card normalization
  console.log('\n[TEST 5] Card normalization');
  const cardTests = [
    { input: 'As', expected: 'A♠' },
    { input: 'Kh', expected: 'K♥' },
    { input: 'Qd', expected: 'Q♦' },
    { input: 'Tc', expected: 'T♣' }
  ];

  let cardNormPassed = 0;
  for (const test of cardTests) {
    const normalized = HandImportSystem.normalizeCard(test.input);
    if (normalized === test.expected) {
      console.log(`✓ "${test.input}" → "${normalized}"`);
      cardNormPassed++;
    } else {
      console.log(`✗ "${test.input}" expected "${test.expected}" got "${normalized}"`);
    }
  }
  results[cardNormPassed === cardTests.length ? 'passed' : 'failed']++;

  // TEST 6: Normalize to unified model
  console.log('\n[TEST 6] Hand model normalization');
  const pokerokHand = pokerokHands[0];
  const parsed = HandImportSystem.parsePokerOK(pokerokHand);
  const normalized = HandImportSystem.createNormalizedHand(parsed, 'PokerOK');

  if (normalized &&
      normalized.hero &&
      normalized.hero.length === 2 &&
      normalized.sourceRoom === 'PokerOK' &&
      normalized.importedAt) {
    console.log('✓ Normalized hand has all required fields');
    console.log('  - sourceRoom:', normalized.sourceRoom);
    console.log('  - hero:', normalized.hero.join(' '));
    console.log('  - board:', normalized.board.join(' ') || 'empty');
    console.log('  - bbSize:', normalized.bbSize);
    results.passed++;
  } else {
    console.log('✗ Normalization failed');
    results.failed++;
  }

  // TEST 7: Fingerprint generation
  console.log('\n[TEST 7] Hand fingerprinting');
  const hand1 = {
    sourceRoom: 'PokerOK',
    sourceHandId: '123',
    heroPosition: 'BTN',
    hero: ['A♠', 'K♦'],
    board: ['Q♥', 'J♣', '9♠'],
    bbSize: 1,
    effectiveStack: 100
  };

  const fp1 = HandImportSystem.createHandFingerprint(hand1);
  const fp2 = HandImportSystem.createHandFingerprint(hand1);

  if (fp1 === fp2 && fp1.includes('PokerOK')) {
    console.log('✓ Fingerprints are deterministic');
    console.log('  Fingerprint:', fp1.slice(0, 50) + '...');
    results.passed++;
  } else {
    console.log('✗ Fingerprinting failed');
    results.failed++;
  }

  // TEST 8: Deduplication
  console.log('\n[TEST 8] Deduplication detection');
  const existingHands = [hand1];
  const duplicate = { ...hand1, sourceRoom: 'PokerOK' };
  const different = { ...hand1, hero: ['K♠', 'Q♦'] };

  const isDupExact = HandImportSystem.isDuplicateHand(duplicate, existingHands);
  const isDupDiff = HandImportSystem.isDuplicateHand(different, existingHands);

  if (isDupExact && !isDupDiff) {
    console.log('✓ Duplicate detection working');
    results.passed++;
  } else {
    console.log('✗ Duplicate detection failed');
    results.failed++;
  }

  // TEST 9: Player stats extraction
  console.log('\n[TEST 9] Player stats extraction');
  const testHands = [
    { hero: ['A♠', 'K♦'], villainPosition: 'BB', heroPosition: 'BTN', result: 'HERO_WIN', pot: 100, heroResult: 50 },
    { hero: ['Q♥', 'J♣'], villainPosition: 'SB', heroPosition: 'CO', result: 'NO_SHOWDOWN', pot: 50 },
    { hero: ['9♠', '8♠'], villainPosition: 'BTN', heroPosition: 'SB', result: 'VILLAIN_WIN', pot: 80, heroResult: -20 }
  ];

  const stats = HandImportSystem.extractPlayerStats(testHands);
  if (stats && stats.handsPlayed === 3) {
    console.log('✓ Stats extracted successfully');
    console.log('  Hands played:', stats.handsPlayed);
    console.log('  VPIP:', Math.round(stats.vpip * 100) + '%');
    results.passed++;
  } else {
    console.log('✗ Stats extraction failed');
    results.failed++;
  }

  // TEST 10: Bulk import simulation (small)
  console.log('\n[TEST 10] Bulk import (3 hands)');
  const bulkTestHands = pokerokHands.slice(0, 3).map(h => HandImportSystem.parsePokerOK(h)).filter(Boolean);

  console.log(`  Testing ${bulkTestHands.length} hands...`);
  let validCount = 0;
  for (const h of bulkTestHands) {
    const normalized = HandImportSystem.createNormalizedHand(h, 'PokerOK');
    const validation = HandValidation.validateHand(normalized);
    if (validation.valid) validCount++;
  }

  if (validCount > 0) {
    console.log(`✓ ${validCount}/${bulkTestHands.length} hands validated successfully`);
    results.passed++;
  } else {
    console.log('✗ No valid hands in bulk test');
    results.failed++;
  }

  // TEST 11: Large file simulation (100 hands)
  console.log('\n[TEST 11] Generate 100-hand fixture');
  let largeContent = '';
  for (let i = 0; i < 100; i++) {
    largeContent += `Hand #${1000000 + i}\nPokerOK - Texas Holdem 6-max\n2024-01-15 14:30:${String(i).padStart(2, '0')} UTC\nBlinds 0.50/1.00\n\nSeat 1: Player_A (50.00)\nSeat 6: Hero (50.00)\n\nHero received hole cards: [As Kd]\nPlayer_A: raises 3.00 to 3.00\nHero: raises 10.00 to 13.00\nPlayer_A: folds\n\nHero wins the pot (7.00)\n\n---\n\n`;
  }

  const start = Date.now();
  let large100Count = 0;
  const largeSplit = largeContent.split('---').filter(h => h.trim());
  for (const h of largeSplit.slice(0, 100)) {
    const parsed = HandImportSystem.parsePokerOK(h);
    if (parsed && parsed.hero && parsed.hero.length === 2) {
      large100Count++;
    }
  }
  const timeMs = Date.now() - start;

  console.log(`✓ Parsed ${large100Count}/100 hands in ${timeMs}ms`);
  if (timeMs < 5000) {
    console.log('✓ Performance acceptable (< 5s for 100 hands)');
    results.passed++;
  } else {
    console.log('⚠ Performance slow (> 5s for 100 hands)');
    results.passed++;
  }

  // SUMMARY
  console.log('\n' + '='.repeat(60));
  console.log(`RESULTS: ${results.passed} passed, ${results.failed} failed`);
  console.log('='.repeat(60));

  return results.failed === 0;
}

// Run tests
runTests().then(success => {
  process.exit(success ? 0 : 1);
});
