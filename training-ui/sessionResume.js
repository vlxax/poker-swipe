// Versioned local persistence for in-progress personalised daily training.
// Stores only session UX state — no solver internals, credentials, or grading logic.
//
// Multi-tab: last write wins; there is no cross-tab lock. Training in two tabs
// may overwrite the same resume blob — acceptable limitation without sync refactor.

export const RESUME_SCHEMA_VERSION = 1;
export const RESUME_STORAGE_KEY = 'pokerSwipe_dailyResume_v1';
export const RESUME_SESSION_TYPE = 'daily_personalized';

const MAX_DRILLS = 24;

function safeParse(raw) {
  if (raw == null || raw === '') return null;
  try {
    return JSON.parse(raw);
  } catch (_) {
    return null;
  }
}

/** @returns {{ ok: boolean, reason?: string }} */
export function validateResumeSnapshot(data) {
  if (!data || typeof data !== 'object') return { ok: false, reason: 'missing' };
  if (data.version !== RESUME_SCHEMA_VERSION) return { ok: false, reason: 'version' };
  if (data.type !== RESUME_SESSION_TYPE) return { ok: false, reason: 'type' };
  if (!Array.isArray(data.drills) || !data.drills.length || data.drills.length > MAX_DRILLS) {
    return { ok: false, reason: 'drills' };
  }
  for (const d of data.drills) {
    if (!d || typeof d !== 'object' || !d.drillId) return { ok: false, reason: 'drill_shape' };
  }
  const total = data.drills.length;
  const index = data.index;
  if (!Number.isInteger(index) || index < 0 || index >= total) {
    return { ok: false, reason: 'index' };
  }
  const state = data.state;
  if (state !== 'ready' && state !== 'limited') return { ok: false, reason: 'state' };
  const results = data.results;
  if (results != null && !Array.isArray(results)) return { ok: false, reason: 'results' };
  if (Array.isArray(results) && results.length > index + 1) {
    return { ok: false, reason: 'results_len' };
  }
  if (data.showingFeedback && !data.lastAnswer) return { ok: false, reason: 'feedback' };
  return { ok: true };
}

/**
 * Build a persistable snapshot from controller fields. Returns null if unsafe / nothing to save.
 */
export function buildResumeSnapshot(ctl, { now = Date.now } = {}) {
  if (!ctl || ctl.mode !== 'drill') return null;
  if (ctl.answering) return null;
  if (ctl.state !== 'ready' && ctl.state !== 'limited') return null;
  const drills = ctl.drills;
  if (!drills || !drills.length) return null;

  const taskStates = {};
  if (ctl.taskStates && typeof ctl.taskStates === 'object') {
    for (const [k, v] of Object.entries(ctl.taskStates)) {
      if (!v || v.optionId == null) continue;
      taskStates[k] = {
        optionId: v.optionId,
        lastAnswer: v.lastAnswer ? { ...v.lastAnswer } : null,
        showingFeedback: !!v.showingFeedback
      };
    }
  }

  return {
    version: RESUME_SCHEMA_VERSION,
    type: RESUME_SESSION_TYPE,
    updatedAt: now(),
    state: ctl.state,
    index: ctl.index,
    showingFeedback: !!ctl.showingFeedback,
    lastAnswer: ctl.lastAnswer ? { ...ctl.lastAnswer } : null,
    results: (ctl.results || []).map((r) => ({ ...r })),
    taskStates,
    drills: drills.map((d) => structuredCloneSafe(d)),
    session: ctl.session
      ? {
        sessionId: ctl.session.sessionId,
        primaryConcept: ctl.session.primaryConcept,
        personalized: ctl.session.personalized,
        plan: ctl.session.plan
          ? { total: ctl.session.plan.total || drills.length, filled: drills.length }
          : { total: drills.length, filled: drills.length }
      }
      : { plan: { total: drills.length, filled: drills.length } }
  };
}

function structuredCloneSafe(obj) {
  try {
    if (typeof structuredClone === 'function') return structuredClone(obj);
  } catch (_) { /* fall through */ }
  return JSON.parse(JSON.stringify(obj));
}

export function loadResume(storage) {
  if (!storage) return null;
  let raw;
  try {
    raw = storage.getItem(RESUME_STORAGE_KEY);
  } catch (_) {
    return null;
  }
  const data = safeParse(raw);
  if (!data) {
    if (raw != null) clearResume(storage);
    return null;
  }
  const v = validateResumeSnapshot(data);
  if (!v.ok) {
    clearResume(storage);
    return null;
  }
  return data;
}

export function saveResume(storage, snapshot) {
  if (!storage || !snapshot) return false;
  const v = validateResumeSnapshot(snapshot);
  if (!v.ok) return false;
  try {
    storage.setItem(RESUME_STORAGE_KEY, JSON.stringify(snapshot));
    return true;
  } catch (_) {
    return false;
  }
}

export function clearResume(storage) {
  if (!storage) return;
  try {
    storage.removeItem(RESUME_STORAGE_KEY);
  } catch (_) { /* ignore */ }
}

export function resumeCardViewModel(snapshot, { now = Date.now } = {}) {
  const v = validateResumeSnapshot(snapshot);
  if (!v.ok) return null;
  const total = snapshot.drills.length;
  const answered = (snapshot.results || []).length;
  const at = snapshot.index + 1;
  const ts = snapshot.updatedAt;
  let activityLabel = '';
  if (ts) {
    const mins = Math.round((now() - ts) / 60000);
    if (mins < 2) activityLabel = 'только что';
    else if (mins < 60) activityLabel = `${mins} мин назад`;
    else if (mins < 1440) activityLabel = `${Math.round(mins / 60)} ч назад`;
    else activityLabel = `${Math.round(mins / 1440)} дн назад`;
  }
  return {
    title: 'ПРОДОЛЖИТЬ ТРЕНИРОВКУ',
    sessionLabel: 'Персональная тренировка',
    progressText: `${at} / ${total}`,
    answeredText: answered ? `Отвечено: ${answered}` : 'Ещё без ответов',
    activityLabel,
    continueCta: 'ПРОДОЛЖИТЬ',
    newCta: 'НАЧАТЬ ЗАНОВО'
  };
}
