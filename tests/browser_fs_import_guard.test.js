/**
 * Browser production entry points must not import Node fs / Strategy Map disk cache.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'fs';
import { dirname, join, extname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function walk(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, acc);
    else if (extname(p) === '.js') acc.push(p);
  }
  return acc;
}

function importsOf(file) {
  const src = readFileSync(file, 'utf8');
  const out = [];
  const re = /from\s+['"]([^'"]+)['"]/g;
  let m;
  while ((m = re.exec(src))) out.push(m[1]);
  return out;
}

describe('browser production import graph has no Node fs Strategy Map path', () => {
  it('ranges-ui, training-ui, and browser trainer lookup never import fs or strategyMapCache', () => {
    const roots = [
      join(ROOT, 'ranges-ui'),
      join(ROOT, 'training-ui'),
      join(ROOT, 'trainer-knowledge', 'browserLookup.js'),
      join(ROOT, 'trainer-knowledge', 'poker_brain_trainer_bridge.js'),
      join(ROOT, 'trainer-knowledge', 'adapters', 'rangesAdapter.js'),
      join(ROOT, 'trainer-knowledge', 'adapters', 'brainAdapter.js'),
      join(ROOT, 'range-learning', 'attemptAdapter.js'),
      join(ROOT, 'range-learning', 'persistence.js'),
      join(ROOT, 'training-ui', 'gradingGateway.js')
    ];
    const files = [];
    for (const r of roots) {
      const st = statSync(r);
      if (st.isDirectory()) walk(r, files);
      else files.push(r);
    }
    const banned = [];
    for (const file of files) {
      for (const spec of importsOf(file)) {
        if (spec === 'fs' || spec === 'node:fs' || spec.endsWith('strategyMapCache.js')
          || spec.endsWith('strategyMapRuntime.js') || spec.endsWith('lookup.js')
          || spec.endsWith('range-learning/index.js') || spec.endsWith('trainerInventory.js')) {
          banned.push(`${file.replace(ROOT + '/', '')} → ${spec}`);
        }
      }
    }
    assert.deepEqual(banned, []);
  });

  it('index.html module scripts are browser-safe entry points only', () => {
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
    const mods = [...html.matchAll(/<script type="module" src="([^"]+)"/g)].map((m) => m[1]);
    assert.ok(mods.includes('ranges-ui/main.js'));
    assert.ok(mods.includes('trainer-knowledge/poker_brain_trainer_bridge.js'));
    assert.ok(!mods.some((s) => s.includes('strategyMapCache') || s.includes('lookup.js')));
  });
});
