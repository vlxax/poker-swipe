// Personalization writeback for trainer-backed preflop training.

import { trainerSkillsForTask, trainerSkillLabelRu } from './trainerSkillTaxonomy.js';
import {
  createSpacedReviewEntry,
  recordSpacedReviewOutcome,
  trainerMistakeFingerprint,
  upsertSpacedReview
} from './trainerSpacedReview.js';

export function buildTrainerWeaknessProfile(history = [], { minMistakes = 2 } = {}) {
  const skills = {};
  for (const h of history) {
    if (h.grade !== 'MISTAKE' && h.grade !== 'r') continue;
    const tags = h.trainerSkills || h.skillTags || [];
    for (const sk of tags) {
      if (!sk.startsWith('rfi_') && !sk.startsWith('bb_') && !sk.startsWith('vs_')
        && !sk.startsWith('call_') && !sk.startsWith('sb_') && !sk.startsWith('hu_')
        && !sk.startsWith('short_') && sk !== 'squeeze' && sk !== 'vs_squeeze' && sk !== 'vs_limp') {
        continue;
      }
      skills[sk] = (skills[sk] || 0) + 1;
    }
  }
  const weakness = {};
  for (const [sk, n] of Object.entries(skills)) {
    if (n >= minMistakes) weakness[sk] = n;
  }
  return weakness;
}

export function recordTrainerOutcome(store, {
  task,
  grade,
  gradingSource,
  trainerMeta,
  now = Date.now()
} = {}) {
  const skills = trainerSkillsForTask(task);
  const hist = store.loadHistory() || [];
  hist.push({
    at: now,
    concept: task.concept,
    grade,
    skillTags: skills,
    trainerSkills: skills,
    spotId: task.id,
    gradingSource: gradingSource || trainerMeta?.gradingSource || 'UNKNOWN',
    trainerMeta: trainerMeta || task.trainerMeta || null,
    contentFingerprint: trainerMistakeFingerprint(task) || task.id
  });
  store.saveHistory(hist);

  const isMistake = grade === 'MISTAKE' || grade === 'r';
  const fp = trainerMistakeFingerprint(task);
  if (fp && isMistake) {
    const existing = (store.loadSpacedReviews?.() || []).find((e) => e.fingerprint === fp);
    const entry = existing || createSpacedReviewEntry({
      fingerprint: fp,
      taskId: task.id,
      skills,
      now
    });
    upsertSpacedReview(store, recordSpacedReviewOutcome(entry, { correct: false, now }));
  } else if (fp && !isMistake) {
    const existing = (store.loadSpacedReviews?.() || []).find((e) => e.fingerprint === fp);
    if (existing) {
      upsertSpacedReview(store, recordSpacedReviewOutcome(existing, { correct: true, now }));
    }
  }

  const weakness = buildTrainerWeaknessProfile(hist);
  return { skills, weakness, trainerSkillLabels: skills.map(trainerSkillLabelRu) };
}

export function weaknessWeightsForSession(store, { history = null } = {}) {
  const hist = history || store.loadHistory() || [];
  const raw = buildTrainerWeaknessProfile(hist, { minMistakes: 1 });
  const weights = {};
  for (const [sk, n] of Object.entries(raw)) {
    weights[sk] = Math.min(2, n * 0.35);
  }
  return weights;
}
