// Tiny, storage-agnostic cache for hand reviews. Keys are derived from a stable
// hand content key plus the analyzer version and the solver options that affect
// output (seed, chance cap, adaptive, iterations). Any storage-like object with
// getItem/setItem/removeItem can be injected (e.g. localStorage in the browser);
// without one it falls back to an in-memory Map, so the module is safe to run in
// Node tests.

const DEFAULT_VERSION = 'solver-core';

export function createHandCache({ storage = null, maxEntries = 50, version = DEFAULT_VERSION } = {}) {
  const mem = new Map();
  // Registry of keys this cache has written to external storage, so clear() can
  // remove exactly our own entries regardless of the (hashed) key format.
  const owned = new Set();

  const memGet = (k) => (mem.has(k) ? mem.get(k) : null);
  const memSet = (k, v) => {
    mem.set(k, v);
    if (mem.size > maxEntries) {
      const oldest = mem.keys().next().value;
      mem.delete(oldest);
    }
  };
  const memDel = (k) => mem.delete(k);
  const memClear = () => mem.clear();

  const keyFor = (contentKey, solverOpts = {}) =>
    stableHash(`${version}|${contentKey}|${JSON.stringify(solverOpts)}`);

  return {
    keyFor,
    get(contentKey, solverOpts) {
      const k = keyFor(contentKey, solverOpts);
      if (storage) {
        try {
          const raw = storage.getItem(k);
          return raw != null ? JSON.parse(raw) : null;
        } catch {
          return null;
        }
      }
      return memGet(k);
    },
    set(contentKey, solverOpts, value) {
      const k = keyFor(contentKey, solverOpts);
      if (storage) {
        try {
          storage.setItem(k, JSON.stringify(value));
          owned.add(k);
          return;
        } catch {
          /* quota exceeded etc. — fall back to memory */
        }
      }
      memSet(k, value);
    },
    has(contentKey, solverOpts) {
      return this.get(contentKey, solverOpts) != null;
    },
    remove(contentKey, solverOpts) {
      const k = keyFor(contentKey, solverOpts);
      if (storage) {
        try {
          storage.removeItem(k);
          owned.delete(k);
          return;
        } catch {
          /* ignore */
        }
      }
      memDel(k);
    },
    clear() {
      if (storage) {
        try {
          for (const k of owned) storage.removeItem(k);
        } catch {
          /* ignore */
        }
        owned.clear();
      }
      memClear();
    }
  };
}

// Stable, order-independent cache key helper (re-exported for convenience).
export function stableHash(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}