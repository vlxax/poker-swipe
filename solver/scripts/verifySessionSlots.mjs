// Verify 10-task session slot personalization for opposite profiles.
import { getTaskPool, getTaskById } from '../src/training/taskLibraryBridge.js';
import { buildDailyPlan } from '../src/training/planner.js';
import { buildSkillProfile } from '../src/training/skillProfile.js';

const POOL = getTaskPool();

function profileA() {
  return buildSkillProfile({
    leakProfiles: [
      { concept: 'bluff_catch', attempts: Array(6).fill({ evLossBb: 0.8, at: Date.now() - 3600000 }) },
      { concept: 'value_bet', attempts: Array(6).fill({ evLossBb: 0.7, at: Date.now() - 3600000 }) },
      { concept: 'icm_pressure', attempts: Array(6).fill({ evLossBb: 0.9, at: Date.now() - 3600000 }) },
      { concept: 'open_range', attempts: Array(6).fill({ evLossBb: 0.02, at: Date.now() - 3600000 }) }
    ],
    assessment: {
      results: [
        { skillTag: 'preflop', concept: 'open_range', correct: true, evLossBb: 0, at: 1 },
        { skillTag: 'river', concept: 'bluff_catch', correct: false, evLossBb: 0.5, at: 2 },
        { skillTag: 'icm', concept: 'icm_pressure', correct: false, evLossBb: 0.6, at: 3 },
        { skillTag: 'postflop', concept: 'cbet_frequency', correct: true, evLossBb: 0.05, at: 4 }
      ]
    }
  });
}

function profileB() {
  return buildSkillProfile({
    leakProfiles: [
      { concept: 'bluff_catch', attempts: Array(8).fill({ evLossBb: 1.2, at: Date.now() - 3600000 }) },
      { concept: 'icm_pressure', attempts: Array(6).fill({ evLossBb: 0.05, at: Date.now() - 3600000 }) }
    ],
    assessment: {
      results: [
        { skillTag: 'icm', correct: true, evLossBb: 0, at: 1 },
        { skillTag: 'river', correct: false, evLossBb: 0.75, at: 2 },
        { skillTag: 'bluffCatch', correct: false, evLossBb: 0.8, at: 3 }
      ]
    }
  });
}

const SLOT_LABEL = {
  primary_weakness: 'primary weakness',
  secondary_weakness: 'secondary weakness',
  maintenance_medium: 'maintenance',
  maintenance_strong: 'strong-skill maintenance',
  exploration: 'exploration'
};

function whySelected(slotKind, task, profile) {
  const skills = Object.values(profile.skills || {})
    .filter((s) => s.score != null)
    .sort((a, b) => a.score - b.score);
  const weakest = skills.slice(0, 2).map((s) => s.skill);
  const strongest = skills.filter((s) => s.score >= 82).map((s) => s.skill);
  const tags = task.skillTags || [];

  if (slotKind === 'primary_weakness') {
    const hit = tags.filter((t) => weakest.includes(t));
    return `targets primary weak skills (${hit.join(', ') || weakest.join(', ')})`;
  }
  if (slotKind === 'secondary_weakness') {
    return `extends weakness practice; river/postflop adjacent concepts`;
  }
  if (slotKind === 'maintenance_medium') {
    return `medium-strength maintenance; avoids strong-skill filler (${strongest.join(', ') || 'none'})`;
  }
  if (slotKind === 'maintenance_strong') {
    const top = skills[skills.length - 1];
    return `one allowed strong-skill maintenance (${top?.skill || 'strongest'})`;
  }
  if (slotKind === 'exploration') {
    return `profile-aware exploration near weak/medium skills`;
  }
  return slotKind;
}

function printPlan(label, profile, rng) {
  const plan = buildDailyPlan({
    pool: POOL,
    skillProfile: profile,
    count: 10,
    rng,
    history: [],
    progressByConcept: {}
  });

  console.log(`\n=== ${label} ===`);
  console.log(`Skills: ${Object.entries(profile.skills).map(([k, v]) => `${k}=${v.score}`).join(', ')}`);

  plan.spotIds.forEach((id, i) => {
    const t = getTaskById(id);
    const slot = (plan.slotKinds || [])[i] || 'unknown';
    console.log(`${i + 1}. ${id}`);
    console.log(`   category: ${SLOT_LABEL[slot] || slot}`);
    console.log(`   concept: ${t?.concept}`);
    console.log(`   street: ${t?.street}`);
    console.log(`   stack: ${t?.heroStack ?? t?.stackDepth ?? '—'}`);
    console.log(`   why: ${whySelected(slot, t, profile)}`);
  });

  return new Set(plan.spotIds);
}

const setA = printPlan('Profile A (weak ICM, strong postflop/river)', profileA(), () => 0.42);
const setB = printPlan('Profile B (strong ICM, weak river/bluff-catch)', profileB(), () => 0.17);

const overlap = [...setA].filter((id) => setB.has(id)).length;
const overlapPct = Math.round((overlap / 10) * 100);
console.log(`\n=== Overlap ===`);
console.log(`Shared taskIds: ${overlap}/10 (${overlapPct}%)`);
