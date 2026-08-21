// Persistent training store (requirements 18 + 20). localStorage-backed with an
// in-memory fallback so it works anywhere, versioned with graceful corrupt-data
// handling, and it dedupes candidates by their identity (the same analysed
// decision from the same hand must never be recorded twice).

import { candidateIdentity } from './candidateNormalizer.js';
import { createPersonalizationSeed } from './personalizationSeed.js';

const STORE_VERSION = 2;

// Migration from version 1 → 2: the old store already tolerated missing keys,
// so no destructive rewrite is needed. We simply record that we're on v2. If a
// future migration needs reshaping, branch here. Returns the effective version
// so callers can reflect it in their in-memory state immediately.
function migrateMeta(st, key) {
  const raw = st.getItem(key);
  let meta = null;
  try { meta = raw ? JSON.parse(raw) : null; } catch (_) { meta = null; }
  const version = meta && typeof meta.version === 'number' ? meta.version : 1;
  if (version < 2) {
    const next = { version: 2, migratedFrom: version, migratedAt: Date.now() };
    try { st.setItem(key, JSON.stringify(next)); } catch (_) { /* ignore */ }
    return next.version;
  }
  return version;
}

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
  const currentVersion = migrateMeta(st, metaKey);

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

  // ---- skill profile / assessment ------------------------------------------
  function saveSkillProfile(profile) {
    if (!profile) return;
    saveJSON('skillProfile', profile);
  }
  function loadSkillProfile() {
    return loadJSON('skillProfile', null);
  }
  function saveAssessment(result) {
    if (!result) return;
    saveJSON('assessment', { ...result, savedAt: now() });
  }
  function loadAssessment() {
    return loadJSON('assessment', null);
  }

  // ---- personalization seed ------------------------------------------------
  function loadPersonalizationSeed() {
    return loadJSON('personalizationSeed', null);
  }
  function savePersonalizationSeed(seed) {
    if (!seed) return;
    saveJSON('personalizationSeed', { seed: String(seed), savedAt: now() });
  }
  function getOrCreatePersonalizationSeed() {
    const existing = loadPersonalizationSeed();
    if (existing && existing.seed) return existing.seed;
    const seed = createPersonalizationSeed();
    savePersonalizationSeed(seed);
    return seed;
  }

  // ---- per-skill evidence (accumulated training + assessment) -------------
  function loadSkillEvidence() {
    return loadJSON('skillEvidence', {});
  }
  function saveSkillEvidence(evidence) {
    saveJSON('skillEvidence', evidence || {});
  }

  // ---- per-skill mastery / spaced repetition --------------------------------
  function loadSkillMastery() {
    return loadJSON('skillMastery', {});
  }
  function saveSkillMastery(mastery) {
    saveJSON('skillMastery', mastery || {});
  }

  // ---- analytics events (append-only, capped) ------------------------------
  function addAnalyticsEvent(event) {
    const events = loadJSON('analytics', []);
    events.push({ ...event, at: event.at != null ? event.at : now() });
    saveJSON('analytics', events.slice(-500));
  }
  function loadAnalyticsEvents() {
    return loadJSON('analytics', []);
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
    saveSkillProfile,
    loadSkillProfile,
    saveAssessment,
    loadAssessment,
    loadPersonalizationSeed,
    savePersonalizationSeed,
    getOrCreatePersonalizationSeed,
    loadSkillEvidence,
    saveSkillEvidence,
    loadSkillMastery,
    saveSkillMastery,
    addAnalyticsEvent,
    loadAnalyticsEvents,
    reset
  };
}

export { STORE_VERSION };