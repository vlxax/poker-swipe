#!/usr/bin/env node
/**
 * Node.js Test Runner for P0 Fixes
 * Run with: node tests/run_p0_tests_node.js
 */

import '../src/handValidation.js';
import { P0RegressionTests } from './test_p0_fixes.js';

const HandValidation = globalThis.HandValidation;

// Make HandValidation globally available (like in browser)
global.HandValidation = HandValidation;

// Run tests
console.log('🧪 Starting P0 Regression Tests (Node.js)...\n');
const tester = new P0RegressionTests();
const results = tester.run();

console.log('\n========== FINAL VERDICT ==========');
console.log(`Total tests: ${results.total}`);
console.log(`Passed: ${results.passed} ✅`);
console.log(`Failed: ${results.failed} ❌`);
console.log(`Pass rate: ${Math.round(results.passed / results.total * 100)}%`);

if (results.failed === 0) {
  console.log('\n🎉 ALL P0 FIXES VALIDATED!');
  process.exit(0);
} else {
  console.log('\n⚠️  SOME TESTS FAILED');
  process.exit(1);
}
