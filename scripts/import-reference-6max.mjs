#!/usr/bin/env node
/**
 * Import 6-max reference ranges from AHTOOOXA/poker-charts (greenline provider).
 * Writes canonical JSON under data/ranges/reference/6max/ and a browser pack module.
 *
 * Usage: node scripts/import-reference-6max.mjs [path-to-greenline.ts]
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DEFAULT_SRC = '/tmp/poker-charts/src/data/ranges/greenline.ts';
const OUT_DIR = join(ROOT, 'data/ranges/reference/6max');
const RANGES_DIR = join(OUT_DIR, 'ranges');
const PACK_OUT = join(ROOT, 'ranges-ui/referenceRangesPack.js');

const SOURCE_REPO = 'AHTOOOXA/poker-charts';
const SOURCE_PROVIDER = 'greenline';

const SKIP_SCENARIOS = new Set(['ISO']);

const SCENARIO_MAP = {
  RFI: 'rfi',
  'vs-open': 'vs_open',
  'vs-3bet': 'vs_3bet',
  'vs-4bet': 'vs_4bet'
};

function parseChartKey(key) {
  const parts = key.split('-');
  if (parts.length === 2) {
    return { heroPosition: parts[0], scenario: parts[1], villainPosition: null };
  }
  if (parts.length === 4 && parts[1] === 'vs' && parts[2] === 'open') {
    return { heroPosition: parts[0], scenario: 'vs-open', villainPosition: parts[3] };
  }
  if (parts.length === 4 && parts[1] === 'vs' && parts[2] === '3bet') {
    return { heroPosition: parts[0], scenario: 'vs-3bet', villainPosition: parts[3] };
  }
  if (parts.length === 4 && parts[1] === 'vs' && parts[2] === '4bet') {
    return { heroPosition: parts[0], scenario: 'vs-4bet', villainPosition: parts[3] };
  }
  throw new Error(`Unrecognized chart key: ${key}`);
}

function normalizeExternalCell(cell) {
  const actions = { fold: 0, call: 0, raise: 0, allin: 0 };
  let weight = 1;

  if (typeof cell === 'string') {
    actions[cell] = 1;
  } else if (Array.isArray(cell)) {
    const share = 1 / cell.length;
    for (const a of cell) actions[a] = (actions[a] || 0) + share;
  } else if (cell && typeof cell === 'object' && 'weight' in cell) {
    weight = Number(cell.weight) / 100;
    const inner = cell.actions || {};
    const total = Object.values(inner).reduce((s, v) => s + Number(v), 0) || 100;
    for (const [a, v] of Object.entries(inner)) {
      actions[a] = (Number(v) / total) * weight;
    }
    const used = Object.values(actions).reduce((s, v) => s + v, 0);
    if (used < weight) actions.fold = Math.max(0, weight - used + (actions.fold || 0));
    return toPolicy(actions);
  } else {
    throw new Error(`Unknown cell format: ${JSON.stringify(cell)}`);
  }

  return toPolicy(actions);
}

function toPolicy(actions) {
  const raise = (actions.raise || 0) + (actions.allin || 0);
  const call = actions.call || 0;
  const fold = actions.fold || 0;
  const sum = raise + call + fold;
  if (sum <= 0) return { FOLD: 1, CALL: 0, RAISE: 0 };
  return {
    FOLD: fold / sum,
    CALL: call / sum,
    RAISE: raise / sum
  };
}

function parseCharts(src) {
  const charts = {};
  const keyRe = /'([^']+)':\s*\{/g;
  let m;
  while ((m = keyRe.exec(src)) !== null) {
    const key = m[1];
    const start = m.index + m[0].length;
    let depth = 1;
    let i = start;
    while (i < src.length && depth > 0) {
      if (src[i] === '{') depth++;
      else if (src[i] === '}') depth--;
      i++;
    }
    const body = src.slice(start, i - 1);
    const hands = {};
    const handRe = /'([2-9TJQKA]{2}[so]?)':\s*(?:'([^']+)'|\[([^\]]+)\]|(\{[\s\S]*?\}))/g;
    let hm;
    while ((hm = handRe.exec(body)) !== null) {
      if (hm[2]) {
        hands[hm[1]] = hm[2];
      } else if (hm[3]) {
        const parts = hm[3].split(',').map((x) => x.trim().replace(/^'|'$/g, ''));
        hands[hm[1]] = parts;
      } else if (hm[4]) {
        const obj = hm[4];
        const weightMatch = /weight:\s*(\d+(?:\.\d+)?)/.exec(obj);
        const actions = {};
        const actRe = /(fold|call|raise|allin):\s*(\d+(?:\.\d+)?)/g;
        let am;
        while ((am = actRe.exec(obj)) !== null) actions[am[1]] = Number(am[2]);
        hands[hm[1]] = { weight: Number(weightMatch?.[1] || 100), actions };
      }
    }
    charts[key] = hands;
  }
  return charts;
}

function slugify(key) {
  return key.toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function buildRangeObject(key, hands) {
  const parsed = parseChartKey(key);
  if (SKIP_SCENARIOS.has(parsed.scenario)) return null;
  const situation = SCENARIO_MAP[parsed.scenario];
  if (!situation) return null;

  const range = {};
  for (const [hand, cell] of Object.entries(hands)) {
    range[hand] = normalizeExternalCell(cell);
  }

  return {
    id: slugify(key),
    format: '6max',
    heroPosition: parsed.heroPosition,
    villainPosition: parsed.villainPosition,
    situation,
    stackBB: null,
    range,
    source: SOURCE_REPO,
    sourceProvider: SOURCE_PROVIDER,
    sourceChartKey: key,
    sourceType: 'reference',
    verified: false,
    solverVerified: false
  };
}

function main() {
  const srcPath = process.argv[2] || DEFAULT_SRC;
  const src = readFileSync(srcPath, 'utf8');
  const charts = parseCharts(src);

  mkdirSync(RANGES_DIR, { recursive: true });

  const ranges = [];
  for (const [key, hands] of Object.entries(charts)) {
    const obj = buildRangeObject(key, hands);
    if (!obj) continue;
    ranges.push(obj);
    writeFileSync(join(RANGES_DIR, `${obj.id}.json`), `${JSON.stringify(obj, null, 2)}\n`);
  }

  ranges.sort((a, b) => a.id.localeCompare(b.id));

  const metadata = {
    format: '6max',
    source: SOURCE_REPO,
    sourceProvider: SOURCE_PROVIDER,
    sourceFile: 'src/data/ranges/greenline.ts',
    sourceDescription: 'Extracted from GreenCharts2024_01.pdf (Greenline Poker)',
    importedAt: new Date().toISOString(),
    sourceType: 'reference',
    verified: false,
    solverVerified: false,
    stackSpecific: false,
    sizingSpecific: false,
    frequencySupport: true,
    positions: ['UTG', 'MP', 'CO', 'BTN', 'SB', 'BB'],
    excludedScenarios: ['ISO'],
    userLabel: 'Базовая стратегия',
    disclaimer: 'Справочный префлоп-диапазон. Не является solver-верифицированным решением для конкретной структуры турнира.'
  };

  const index = {
    ...metadata,
    rangeCount: ranges.length,
    ranges: ranges.map((r) => ({
      id: r.id,
      heroPosition: r.heroPosition,
      villainPosition: r.villainPosition,
      situation: r.situation,
      sourceChartKey: r.sourceChartKey,
      file: `ranges/${r.id}.json`
    }))
  };

  writeFileSync(join(OUT_DIR, 'metadata.json'), `${JSON.stringify(metadata, null, 2)}\n`);
  writeFileSync(join(OUT_DIR, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);

  writeFileSync(PACK_OUT, `// AUTO-GENERATED by scripts/import-reference-6max.mjs — do not edit manually
export const REFERENCE_6MAX_METADATA = ${JSON.stringify(metadata, null, 2)};

export const REFERENCE_6MAX_RANGES = ${JSON.stringify(ranges, null, 2)};
`);

  const bySit = {};
  for (const r of ranges) {
    bySit[r.situation] = (bySit[r.situation] || 0) + 1;
  }

  console.log(`Imported ${ranges.length} reference ranges from ${SOURCE_PROVIDER}`);
  console.log('By situation:', bySit);
  console.log(`Wrote ${RANGES_DIR}/*.json, index.json, metadata.json, referenceRangesPack.js`);
}

main();
