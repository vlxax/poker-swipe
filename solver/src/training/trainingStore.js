// Persistent training store (requirements 18 + 20). localStorage-backed with an
// in-memory fallback so it works anywhere, versioned with graceful corrupt-data
// handling, and it dedupes candidates by their identity (the same analysed
// decision from the same hand must never be recorded twice).

import { candidateIdentity } from './candidateNormalizer.js';

const STORE_VERSION = 1;

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    key: (i) => [...map.keys()][i] || null,
    get length() { return map.size; }
  };
}

export function createTrainingStore({
  storage = null,
  prefix = 'pokerSwipe_train_',
  version = STORE_VERSION,
  now = Date.now
} = {}) {
  const st = storage || memoryStorage();

  const key = (k) => prefix + k;
  const metaKey = key('meta');

  function loadJSON(k, fallback) {
    try {
      const raw = st.getItem(key(k));
      if (raw == null) return fallback;
      const parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch (err) {
      // Corrupt data: drop it and start fresh for this key (requirement 20).
      try { st.removeItem(key(k)); } catch (_) { /* ignore */ }
      return fallback;
    }
  }
  function saveJSON(k, value) {
    try { st.setItem(key(k), JSON.stringify(value)); } catch (_) { /* quota / serialization */ }
  }
  function removeKey(k) {
    try { st.removeItem(key(k)); } catch (_) { /* ignore */ }
  }

  // ---- version / migration ---------------------------------------------------
  const meta = loadJSON('meta', { version });
  const currentVersion = meta && typeof meta.version === 'number' ? meta.version : version;

  // ---- candidates (dedup by identity) ---------------------------------------
  function saveCandidate(candidate) {
    if (!candidate) return false;
    const identity = candidateIdentity(candidate);
    saveJSON(`candidate:${identity}`, { identity, candidate, savedAt: now() });
    return true;
  }
  function hasCandidate(candidate) {
    if (!candidate) return false;
    return st.getItem(key(`candidate:${candidateIdentity(candidate)}`)) != null;
  }
  function loadCandidate(identity) {
    const rec = loadJSON(`candidate:${identity}`, null);
    return rec ? rec.candidate : null;
  }
  function listCandidates() {
    // Candidates are stored wrapped ({ identity, candidate, savedAt }); expose the
    // candidate objects themselves so callers can read `.concept` directly.
    return listPrefixed('candidate:').map((r) => (r && r.candidate ? r.candidate : r)).filter(Boolean);
  }

  // ---- leak profiles ---------------------------------------------------------
  function saveProfile(profile) {
    if (!profile || !profile.concept) return;
    saveJSON(`profile:${profile.concept}`, profile);
  }
  function loadProfile(concept) {
    return loadJSON(`profile:${concept}`, null);
  }
  function listProfiles() {
    return listPrefixed('profile:');
  }

  // ---- concept progress ------------------------------------------------------
  function saveProgress(progress) {
    if (!progress || !progress.concept) return;
    saveJSON(`progress:${progress.concept}`, progress);
  }
  function loadProgress(concept) {
    return loadJSON(`progress:${concept}`, null);
  }
  function listProgress() {
    return listPrefixed('progress:');
  }

  // ---- training history ------------------------------------------------------
  function loadHistory() {
    return loadJSON('history', []);
  }
  function addHistoryEntry(entry) {
    const h = loadHistory();
    h.push({ ...entry, at: entry.at != null ? entry.at : now() });
    saveJSON('history', h.slice(-200));
  }
  function saveHistory(h) {
    saveJSON('history', (h || []).slice(-200));
  }

  // ---- misc ------------------------------------------------------------------
  function listPrefixed(prefixKey) {
    const out = [];
    if (typeof st.key !== 'function') return out;
    for (let i = 0; i < st.length; i++) {
      const k = st.key(i);
      if (!k || !k.startsWith(prefix + prefixKey)) continue;
      const val = loadJSON(k.slice(prefix.length), null);
      if (val != null) out.push(val);
    }
    return out;
  }

  function reset() {
    if (typeof st.key !== 'function') return;
    const toRemove = [];
    for (let i = 0; i < st.length; i++) {
      const k = st.key(i);
      if (k && k.startsWith(prefix)) toRemove.push(k);
    }
    for (const k of toRemove) { try { st.removeItem(k); } catch (_) { /* ignore */ } }
  }

  return {
    version: currentVersion,
    key,
    saveCandidate,
    hasCandidate,
    loadCandidate,
    listCandidates,
    saveProfile,
    loadProfile,
    listProfiles,
    saveProgress,
    loadProgress,
    listProgress,
    loadHistory,
    addHistoryEntry,
    saveHistory,
    reset
  };
}

export { STORE_VERSION };