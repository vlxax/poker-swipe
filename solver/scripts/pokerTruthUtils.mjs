#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { loadPokerBrainPackFromStrategyFile } from '../../trainer-knowledge/conflictDetector.js';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const INDEX_HTML = path.join(ROOT, 'index.html');
export const STRATEGY_PACK = path.join(ROOT, 'strategy_pack_v17.js');

export function readIndexHtml() {
  return fs.readFileSync(INDEX_HTML, 'utf8');
}

/** Extract `window.VAR = {...}` JSON object (strategy pack inline). */
export function extractWindowJsonAssignment(html, varName = 'POKER_BRAIN_PACK') {
  const needle = `window.${varName}=`;
  const start = html.indexOf(needle);
  if (start < 0) return null;
  let i = start + needle.length;
  while (i < html.length && html[i] !== '{') i++;
  if (html[i] !== '{') return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let j = i; j < html.length; j++) {
    const c = html[j];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') {
      inStr = true;
      continue;
    }
    if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return JSON.parse(html.slice(i, j + 1));
    }
  }
  return null;
}

export function loadCanonicalBrainPack() {
  return loadPokerBrainPackFromStrategyFile();
}

export function loadInlineBrainPackFromIndex() {
  return extractWindowJsonAssignment(readIndexHtml());
}

const SKIP_KEYS = new Set(['generated']);

/** Deep semantic diff for poker pack payloads (not raw text). */
export function semanticPackDiff(canonical, inline, basePath = '') {
  const diffs = [];
  if (canonical === inline) return diffs;
  if (canonical == null || inline == null) {
    diffs.push({ section: basePath || 'root', key: '(root)', canonical, inline });
    return diffs;
  }
  const tc = typeof canonical;
  const ti = typeof inline;
  if (tc !== ti) {
    diffs.push({ section: basePath || 'root', key: '(type)', canonical: tc, inline: ti });
    return diffs;
  }
  if (tc !== 'object') {
    if (canonical !== inline) {
      diffs.push({ section: basePath || 'root', key: '(value)', canonical, inline });
    }
    return diffs;
  }
  if (Array.isArray(canonical) || Array.isArray(inline)) {
    if (!Array.isArray(canonical) || !Array.isArray(inline)) {
      diffs.push({ section: basePath, key: '(array)', canonical: 'array', inline: typeof inline });
      return diffs;
    }
    if (canonical.length !== inline.length) {
      diffs.push({
        section: basePath,
        key: 'length',
        canonical: canonical.length,
        inline: inline.length
      });
    }
    const n = Math.max(canonical.length, inline.length);
    for (let i = 0; i < n; i++) {
      diffs.push(...semanticPackDiff(canonical[i], inline[i], `${basePath}[${i}]`));
    }
    return diffs;
  }
  const keys = new Set([...Object.keys(canonical), ...Object.keys(inline)]);
  for (const key of keys) {
    if (SKIP_KEYS.has(key)) continue;
    const p = basePath ? `${basePath}.${key}` : key;
    if (!(key in canonical)) {
      diffs.push({ section: basePath || 'root', key, canonical: undefined, inline: inline[key] });
      continue;
    }
    if (!(key in inline)) {
      diffs.push({ section: basePath || 'root', key, canonical: canonical[key], inline: undefined });
      continue;
    }
    diffs.push(...semanticPackDiff(canonical[key], inline[key], p));
  }
  return diffs;
}

/** Run `const NAME = ...` from index.html in a minimal sandbox. */
export function extractIndexConst(constName) {
  const html = readIndexHtml();
  const marker = `const ${constName}=`;
  const start = html.indexOf(marker);
  if (start < 0) return null;
  let i = start + marker.length;
  while (i < html.length && /\s/.test(html[i])) i++;
  const open = html[i];
  if (open !== '[' && open !== '{') return null;
  const close = open === '[' ? ']' : '}';
  let depth = 0;
  let inStr = false;
  let esc = false;
  let quote = null;
  for (let j = i; j < html.length; j++) {
    const c = html[j];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === quote) inStr = false;
      continue;
    }
    if (c === '"' || c === "'") {
      inStr = true;
      quote = c;
      continue;
    }
    if (c === open) depth++;
    else if (c === close) {
      depth--;
      if (depth === 0) {
        const expr = html.slice(i, j + 1);
        const sandbox = {
          clone: (x) => JSON.parse(JSON.stringify(x))
        };
        vm.createContext(sandbox);
        vm.runInContext(`result = ${expr}`, sandbox);
        return sandbox.result;
      }
    }
  }
  return null;
}

export function normalizeFnBody(src) {
  return String(src || '')
    .replace(/\s+/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
}

export function extractLegacyPush18FromIndex() {
  const html = readIndexHtml();
  const m = html.match(/function push18\(h,pos,bb,stage,mode\)\{[^}]+\}/);
  return m ? m[0] : null;
}

export function gradeBucketFromPreferred(spot, action) {
  if (spot.preferred?.includes?.(action) || spot.preferred === action) return 'optimal';
  if (spot.live?.includes?.(action)) return 'acceptable';
  return 'bad';
}

export function brainGradeBucket(grade) {
  if (grade === 'g') return 'optimal';
  if (grade === 'y') return 'acceptable';
  if (grade === 'r') return 'bad';
  return 'unknown';
}

export function bucketsConflict(a, b) {
  if (a === 'unknown' || b === 'unknown') return null;
  const pass = new Set(['optimal', 'acceptable']);
  const fail = new Set(['bad']);
  if (a === b) return false;
  if (pass.has(a) && pass.has(b)) return false;
  if (fail.has(a) && fail.has(b)) return false;
  return true;
}
