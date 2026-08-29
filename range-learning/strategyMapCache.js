/**
 * Persisted Strategy Map structural index.
 * Keyed by dataset version. Does not store range hands (source of truth stays shards).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { compactFingerprint } from '../strategy-map/fingerprint.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
export const CACHE_SCHEMA = 'strategy-map-index-v1';
export const ADAPTER_VERSION = '1';
export const DEFAULT_CACHE_PATH = join(ROOT, 'data/trainer/built/strategy-map-index-cache.json');

export function computeDatasetVersion({ builtAt, chartCount, extra = '' } = {}) {
  return `${CACHE_SCHEMA}:${ADAPTER_VERSION}:${builtAt || 'unknown'}:${chartCount || 0}:${extra}`;
}

export function serializeStructuralIndex({ version, fingerprints, metadata, stats = {} }) {
  const compact = {};
  for (const [id, fp] of fingerprints.entries ? fingerprints.entries() : Object.entries(fingerprints)) {
    compact[id] = fp.handData ? compactFingerprint(fp) : fp;
  }
  const metaOut = metadata instanceof Map ? Object.fromEntries(metadata) : { ...metadata };
  return {
    schema: CACHE_SCHEMA,
    adapterVersion: ADAPTER_VERSION,
    version,
    builtAt: Date.now(),
    stats,
    fingerprints: compact,
    metadata: metaOut
  };
}

export function writeStructuralCache(payload, path = DEFAULT_CACHE_PATH) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(payload));
  return path;
}

export function readStructuralCache(path = DEFAULT_CACHE_PATH) {
  if (!existsSync(path)) return null;
  try {
    const payload = JSON.parse(readFileSync(path, 'utf8'));
    if (payload.schema !== CACHE_SCHEMA) return { ok: false, reason: 'schema_mismatch', payload: null };
    return { ok: true, payload };
  } catch (e) {
    return { ok: false, reason: 'corrupt', payload: null };
  }
}

export function cacheMatchesVersion(payload, version) {
  return !!payload && payload.version === version && payload.adapterVersion === ADAPTER_VERSION;
}
