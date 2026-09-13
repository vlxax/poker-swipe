// Dynamic skill target quotas (no spotSelector / weaknessTargeting imports).

import { SKILL_DIAGNOSES, diagnosisPriorityBoost } from './skillDiagnoses.js';

export function computeDynamicSkillTargets(dynamicProfile, count = 7) {
  if (!dynamicProfile?.tracks) return null;
  const ranked = Object.values(dynamicProfile.tracks)
    .filter((t) => t.score != null)
    .map((t) => ({
      ...t,
      priority: diagnosisPriorityBoost(t.diagnosis) + (t.score < 50 ? 2 : 0)
        + (t.diagnosis === SKILL_DIAGNOSES.DECAYING ? 1.5 : 0)
        + (t.diagnosis === SKILL_DIAGNOSES.IMPROVING
          && t.recentAccuracy != null && t.longTermAccuracy != null
          && t.recentAccuracy - t.longTermAccuracy >= 0.25 ? 1.8 : 0)
    }))
    .sort((a, b) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      return (a.score ?? 999) - (b.score ?? 999);
    });

  if (!ranked.length) return null;

  const targets = {};
  let remaining = count;
  const alloc = (skill, n) => {
    if (n <= 0 || remaining <= 0) return;
    const take = Math.min(n, remaining);
    targets[skill] = (targets[skill] || 0) + take;
    remaining -= take;
  };

  const hasImprovingGap = (t) =>
    t.recentAccuracy != null
    && t.longTermAccuracy != null
    && t.recentAccuracy - t.longTermAccuracy >= 0.25;

  const focus = ranked.filter((t) =>
    t.diagnosis === SKILL_DIAGNOSES.TRUE_WEAKNESS
    || t.diagnosis === SKILL_DIAGNOSES.DECAYING
    || t.diagnosis === SKILL_DIAGNOSES.TEMPORARY_MISTAKE
    || t.diagnosis === SKILL_DIAGNOSES.LEARNING
    || (t.diagnosis === SKILL_DIAGNOSES.IMPROVING && hasImprovingGap(t))
  ).slice(0, 3);

  const pool = focus.length ? focus : ranked.slice(0, 3);

  if (pool[0]) alloc(pool[0].skill, Math.max(2, Math.round(count * 0.38)));
  if (pool[1]) alloc(pool[1].skill, Math.max(1, Math.round(count * 0.24)));
  if (pool[2]) alloc(pool[2].skill, Math.max(1, Math.round(count * 0.14)));

  const mastered = ranked.find((t) => t.diagnosis === SKILL_DIAGNOSES.MASTERED);
  if (mastered && remaining > 0) alloc(mastered.skill, 1);

  let guard = 0;
  while (remaining > 0 && pool.length && guard < count) {
    alloc(pool[guard % pool.length].skill, 1);
    guard++;
  }

  return targets;
}
