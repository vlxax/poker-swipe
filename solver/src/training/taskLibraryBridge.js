// Bridge to the task-context library: load tasks, audit metadata coverage, and
// expose a selector pool. Keeps solver imports isolated from DOM code.

import { TASKS, buildLibrary } from '../../../task-context/library.js';
import { poolFromLibrary } from './planner.js';

let _cachedPool = null;
let _cachedTasks = null;

export function loadTaskLibrary() {
  if (!_cachedTasks) _cachedTasks = buildLibrary();
  return _cachedTasks;
}

export function getTaskPool() {
  if (!_cachedPool) _cachedPool = poolFromLibrary(loadTaskLibrary());
  return _cachedPool;
}

/** Training/diagnostic pool: MTT-family formats only (no cash). */
export function getMttTaskPool() {
  const tasks = loadTaskLibrary().filter((t) => {
    const fmt = String(t.format || 'MTT').toUpperCase();
    return fmt === 'MTT' || fmt === 'PKO' || fmt === 'SNG';
  });
  return poolFromLibrary(tasks);
}

export function getTaskById(id) {
  const tasks = loadTaskLibrary();
  return tasks.find((t) => t.id === id) || null;
}

export function resetTaskLibraryCache() {
  _cachedPool = null;
  _cachedTasks = null;
}

// Audit how many tasks expose usable personalization metadata.
export function auditTaskMetadata(tasks = loadTaskLibrary()) {
  const pool = poolFromLibrary(tasks);
  let withSkillTags = 0;
  let withStreet = 0;
  let withDifficulty = 0;
  let withIcm = 0;
  let withPosition = 0;
  let withDecisionType = 0;
  let withExploit = 0;
  let fullyUsable = 0;

  for (const s of pool) {
    const hasSkill = (s.skillTags || []).length > 0;
    const hasStreet = !!s.street;
    const hasDiff = s.difficulty != null;
    const hasIcm = (s.icmPressure || 0) > 0;
    const hasPos = !!(s.positions && s.positions.hero);
    const hasDec = !!s.decisionType;
    const hasExploit = s.theoryOrExploit === 'exploit';

    if (hasSkill) withSkillTags++;
    if (hasStreet) withStreet++;
    if (hasDiff) withDifficulty++;
    if (hasIcm) withIcm++;
    if (hasPos) withPosition++;
    if (hasDec) withDecisionType++;
    if (hasExploit) withExploit++;
    if (hasSkill && hasStreet && hasDiff) fullyUsable++;
  }

  return {
    total: pool.length,
    withSkillTags,
    withStreet,
    withDifficulty,
    withIcm,
    withPosition,
    withDecisionType,
    withExploit,
    fullyUsable
  };
}

export function hasUsablePlayerProfile(store) {
  if (!store) return false;
  const skill = typeof store.loadSkillProfile === 'function' ? store.loadSkillProfile() : null;
  if (skill && skill.overall != null) return true;
  const leaks = typeof store.listProfiles === 'function' ? store.listProfiles() : [];
  return leaks.some((p) => p && p.sampleSize > 0);
}
