// Trainer-native candidate pool — browser-safe (no Node fs imports).

import { sampleTrainerSession } from './trainerCurriculum.js';
import { weaknessWeightsForSession } from './trainerPersonalization.js';
import { dueSpacedReviews } from './trainerSpacedReview.js';

let _cache = null;

export function setTrainerCandidateIndex(data) {
  _cache = data;
  if (typeof globalThis !== 'undefined' && globalThis.window) {
    globalThis.window.__trainerCandidateIndex = data;
  }
}

export function loadTrainerCandidateIndexSync() {
  if (_cache) return _cache;
  if (typeof globalThis !== 'undefined' && globalThis.window?.__trainerCandidateIndex) {
    _cache = globalThis.window.__trainerCandidateIndex;
    return _cache;
  }
  return { candidates: [], candidateCount: 0 };
}

export async function loadTrainerCandidateIndex(url = 'data/trainer/built/trainer-candidate-index.json') {
  if (_cache) return _cache;
  if (typeof fetch === 'undefined') return loadTrainerCandidateIndexSync();
  try {
    const res = await fetch(url);
    if (!res.ok) return { candidates: [], candidateCount: 0 };
    const data = await res.json();
    setTrainerCandidateIndex(data);
    return data;
  } catch {
    return { candidates: [], candidateCount: 0 };
  }
}

export function getTrainerPreflopCandidates() {
  const idx = loadTrainerCandidateIndexSync();
  return (idx.candidates || []).map((t) => ({ ...t, _trainerNative: true }));
}

export function buildTrainerSwipeSession(store, {
  count = 10,
  now = Date.now(),
  rng = Math.random,
  candidates = null
} = {}) {
  const pool = candidates || getTrainerPreflopCandidates();
  if (!pool.length) return { items: [], plan: null };

  const weaknessSkills = store ? weaknessWeightsForSession(store) : {};
  const recent = (store?.loadHistory?.() || []).slice(-20);
  const recentFingerprints = new Set(
    recent.map((h) => h.contentFingerprint).filter(Boolean)
  );

  const due = store ? dueSpacedReviews(store, { now, limit: 2 }) : [];
  const dueIds = new Set(due.map((d) => d.taskId));
  const dueTasks = pool.filter((t) => dueIds.has(t.id));

  const remaining = count - dueTasks.length;
  const sampled = sampleTrainerSession(pool.filter((t) => !dueIds.has(t.id)), {
    count: Math.max(0, remaining),
    weaknessSkills,
    recentFingerprints,
    rng
  });

  const items = [...dueTasks, ...sampled].slice(0, count);
  return {
    items,
    plan: {
      sessionId: `trainer_${now}`,
      source: 'trainer_native',
      spotIds: items.map((t) => t.id),
      filled: items.length,
      personalized: Object.keys(weaknessSkills).length > 0
    }
  };
}
