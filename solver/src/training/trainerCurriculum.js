// Curriculum sampling — training frequency ≠ raw data frequency.

import { trainerSkillsForTask } from './trainerSkillTaxonomy.js';

const ACTION_FAMILY = {
  FOLD: 'fold',
  CALL: 'call',
  RAISE: 'raise',
  'ALL-IN': 'allin',
  OTHER: 'other'
};

function actionFamily(task) {
  const act = task?.trainerMeta?.normalizedAction || task?.trainerMeta?.actionRaw;
  if (act === 'FOLD' || act === 'UNSELECTED') return ACTION_FAMILY.FOLD;
  if (act === 'CALL') return ACTION_FAMILY.CALL;
  if (act === 'ALL_IN' || task?.trainerMeta?.actionRaw === 'AI') return ACTION_FAMILY['ALL-IN'];
  if (act === 'RAISE' || task?.trainerMeta?.actionRaw === 'RAISE') return ACTION_FAMILY.RAISE;
  return ACTION_FAMILY.OTHER;
}

const DEFAULT_MODE_WEIGHTS = {
  uo: 1.2,
  vs1r: 1.0,
  vs1rshort: 1.1,
  vs3bet: 1.0,
  callpush: 0.9,
  vssqueeze: 0.8,
  vs4bet: 0.7,
  sbvsbb: 0.8,
  huante: 0.6,
  vs1r1c: 0.7,
  vs2r: 0.6,
  vslimp: 0.5
};

const ACTION_WEIGHTS = {
  fold: 0.35,
  call: 1.0,
  raise: 1.2,
  allin: 1.1,
  other: 0.8
};

/**
 * Score candidate for session inclusion. Higher = more likely selected.
 */
export function scoreTrainerCandidate(task, {
  weaknessSkills = {},
  recentFingerprints = new Set(),
  recentActionFamilies = [],
  rng = Math.random
} = {}) {
  const mode = task.trainerMeta?.sourceMode || 'unknown';
  const fam = actionFamily(task);
  let score = (DEFAULT_MODE_WEIGHTS[mode] || 0.5) * (ACTION_WEIGHTS[fam] || 0.5);

  const skills = trainerSkillsForTask(task);
  for (const sk of skills) {
    const w = weaknessSkills[sk];
    if (w != null && w > 0) score *= (1 + w * 2);
  }

  const fp = task.trainerMeta?.chartId && task.trainerMeta?.hand
    ? `${task.trainerMeta.chartId}:${task.trainerMeta.hand}`
    : task.id;
  if (recentFingerprints.has(fp)) score *= 0.05;

  const recentFolds = recentActionFamilies.filter((f) => f === 'fold').length;
  if (fam === 'fold' && recentFolds >= 3) score *= 0.2;

  score *= 0.85 + rng() * 0.3;
  return { score, fingerprint: fp, actionFamily: fam, skills };
}

export function sampleTrainerSession(candidates, {
  count = 10,
  weaknessSkills = {},
  recentFingerprints = new Set(),
  recentActionFamilies = [],
  rng = Math.random
} = {}) {
  const pool = [...candidates];
  const selected = [];
  const used = new Set(recentFingerprints);
  const actionLog = [...recentActionFamilies];

  while (selected.length < count && pool.length) {
    const scored = pool.map((task) => ({
      task,
      ...scoreTrainerCandidate(task, {
        weaknessSkills,
        recentFingerprints: used,
        recentActionFamilies: actionLog,
        rng
      })
    })).sort((a, b) => b.score - a.score);

    const top = scored.slice(0, Math.min(8, scored.length));
    const pick = top[Math.floor(rng() * top.length)];
    if (!pick) break;

    selected.push(pick.task);
    used.add(pick.fingerprint);
    actionLog.push(pick.actionFamily);
    const idx = pool.findIndex((t) => t.id === pick.task.id);
    if (idx >= 0) pool.splice(idx, 1);
  }

  return selected;
}

export function summarizeActionDistribution(candidates) {
  const counts = { FOLD: 0, CALL: 0, RAISE: 0, 'ALL-IN': 0, OTHER: 0 };
  for (const t of candidates) {
    const fam = actionFamily(t);
    if (fam === 'fold') counts.FOLD++;
    else if (fam === 'call') counts.CALL++;
    else if (fam === 'raise') counts.RAISE++;
    else if (fam === 'allin') counts['ALL-IN']++;
    else counts.OTHER++;
  }
  return counts;
}
