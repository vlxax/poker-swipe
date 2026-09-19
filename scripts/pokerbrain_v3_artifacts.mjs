#!/usr/bin/env node
/**
 * PokerBrain V3 diagnostic artifacts (no strategy changes).
 */
import { writeFileSync, mkdirSync, readFileSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { TASKS } from '../task-context/library.js';
import { buildCanonicalSpot } from '../task-context/canonicalSpot.js';
import { analyze, adapters, grade } from '../poker-brain/index.js';
import { classifyDailyShadow } from '../poker-brain/integrations/dailyShadow.js';
import { canUnifiedBrainOwnDaily, summarizeDailyMigrationGate } from '../poker-brain/integrations/dailyMigrationGate.js';
import { loadPokerBrainPackFromStrategyFile } from '../trainer-knowledge/conflictDetector.js';
import { lookupReferencePolicy } from '../ranges-ui/referenceRanges.js';
import { lookupTrainerHandAction } from '../trainer-knowledge/lookup.js';
import { choiceToActionType } from '../solver/src/training/libraryDrill.js';
import { POKER_DOMAINS, resolvePokerDomain } from '../poker-brain/routing/resolvePokerDomain.js';

const ART = '/opt/cursor/artifacts';
mkdirSync(ART, { recursive: true });

const pack = loadPokerBrainPackFromStrategyFile();
const classOfStub = (cards) => {
  if (!Array.isArray(cards) || cards.length < 2) return null;
  const r = (c) => c[0];
  const s = (c) => c[1];
  const ranks = [r(cards[0]), r(cards[1])].sort((a, b) => '23456789TJQKA'.indexOf(a) - '23456789TJQKA'.indexOf(b));
  if (ranks[0] === ranks[1]) return `${ranks[0]}${ranks[1]}`;
  const suited = s(cards[0]) === s(cards[1]);
  return `${ranks[1]}${ranks[0]}${suited ? 's' : 'o'}`;
};

const deps = {
  pack,
  classOf: classOfStub,
  referenceLookupPolicy: lookupReferencePolicy,
  trainerLookupHandAction: lookupTrainerHandAction
};

function triageConflict({ task, brain, classification }) {
  if (classification !== 'POLICY_CONFLICT' && classification !== 'CONFLICT') return null;
  const ctx = adapters.daily({ drill: task, spot: { ...task, _canonical: buildCanonicalSpot({ ...task, _library: true }) } });
  const domain = brain.domain;
  const compat = brain.contextCompatibility;
  let bucket = 'SAME_CONTEXT_POLICY_CONFLICT';
  if (compat?.ignoredMaterialFields?.length) bucket = 'CONTEXT_MISMATCH';
  else if (!brain.provenance?.primarySource) bucket = 'BRAIN_SOURCE_TOO_WEAK';
  else if (brain.flags?.includes('PARTIAL_CONTEXT_MATCH')) bucket = 'CONTEXT_MISMATCH';
  else if (brain.conflicts?.length) bucket = 'SAME_CONTEXT_POLICY_CONFLICT';
  return {
    taskId: task.id,
    domain,
    DecisionContext: { street: ctx.street, hero: ctx.hero, effectiveStackBB: ctx.effectiveStackBB, preflopTree: ctx.preflopTree },
    libraryCorrect: task.correct,
    libraryAlsoOk: task.alsoOk,
    brainRecommendation: brain.recommendation,
    brainPolicy: brain.recommendation?.frequencies,
    brainPrimarySource: brain.provenance?.primarySource,
    supportingSources: brain.provenance?.supportingSources,
    contextMatch: compat,
    ignoredMaterialFields: compat?.ignoredMaterialFields,
    missingMaterialFields: compat?.missingMaterialFields,
    classification: bucket,
    reason: classification
  };
}

const v3 = {
  TOTAL_TASKS: 0,
  BRAIN_ANALYZABLE: 0,
  EXACT_MATCH: 0,
  DOMINANT_ACTION_MATCH: 0,
  ACCEPTABLE_ACTION_OVERLAP: 0,
  POLICY_CONFLICT: 0,
  NOT_COMPARABLE: 0,
  NO_BRAIN_EVIDENCE: 0,
  conflicts: [],
  migrationGate: []
};

for (const task of TASKS) {
  v3.TOTAL_TASKS += 1;
  const canonical = buildCanonicalSpot({ ...task, _library: true });
  const ctx = adapters.daily({ drill: task, spot: { ...task, _canonical: canonical } });
  const brain = analyze({ context: ctx }, deps);
  if (brain.provenance?.primarySource) v3.BRAIN_ANALYZABLE += 1;
  const gate = canUnifiedBrainOwnDaily(ctx, brain);
  v3.migrationGate.push({ taskId: task.id, gate });

  const { classification } = classifyDailyShadow({
    libraryVerdict: { expectedAction: task.correct, alsoOk: task.alsoOk },
    brainDecision: brain,
    drill: task
  });
  v3[classification] = (v3[classification] || 0) + 1;
  const tri = triageConflict({ task, brain, classification });
  if (tri) v3.conflicts.push(tri);
}

const migrationSummary = summarizeDailyMigrationGate(v3.migrationGate.map((m) => ({ gate: m.gate })));

writeFileSync(join(ART, 'daily_brain_shadow_report_v3.json'), JSON.stringify({ ...v3, migrationSummary }, null, 2));
writeFileSync(join(ART, 'daily_brain_conflict_triage.json'), JSON.stringify({ conflicts: v3.conflicts, total: v3.conflicts.length }, null, 2));

const fixtures = [
  { name: 'rfi_btn_30', swipe: { scenario: { street: 'PREFLOP', pos: 'BTN', hero: ['As', 'Ks'], stack: 30, ctx: 'unopened, first in' } } },
  { name: 'rfi_btn_30_hands', myhands: { hand: { street: 'PREFLOP', heroSeat: 'BTN', effectiveStack: 30, hero: ['As', 'Ks'], actions: [], ctx: 'unopened' } } },
  { name: 'rfi_btn_30_ranges', ranges: { sel: { situation: 'rfi', position: 'BTN', stack: '30' }, scenario: { pos: 'BTN', stack: 30, hero: ['As', 'Ks'], ctx: 'first in' } } }
];

const cross = { fixtures: [] };
for (const f of fixtures) {
  const ctx = adapters[f.swipe ? 'swipe' : f.myhands ? 'myhands' : 'ranges'](f.swipe || f.myhands || f.ranges);
  const domain = resolvePokerDomain(ctx);
  const brain = analyze({ context: ctx }, deps);
  cross.fixtures.push({
    name: f.name,
    domain,
    effectiveStackBB: ctx.effectiveStackBB,
    primarySource: brain.provenance?.primarySource,
    key: brain.explanation?.technical
  });
}
cross.pass = cross.fixtures.every((x) => x.domain === cross.fixtures[0].domain);
writeFileSync(join(ART, 'pokerbrain_cross_feature_consistency.json'), JSON.stringify(cross, null, 2));

const ownership = {
  CANONICAL_RUNTIME_OWNER: 'poker-brain/ (analyze, grade)',
  layers: [
    { path: 'poker-brain/', role: 'CANONICAL', notes: 'Unified orchestrator' },
    { path: 'poker_brain.js', role: 'LEGACY_WRAPPER', notes: 'nodeFor/gradeDecision delegate via install' },
    { path: 'training-ui/gradingGateway.js', role: 'ROUTER', notes: 'Daily=library; brain modes=unified' },
    { path: 'solver/src/training/answerEvaluator.js', role: 'LOCAL_TRUTH', notes: 'Daily library grades' }
  ],
  ONE_CANONICAL_BRAIN_OWNER: true
};
writeFileSync(join(ART, 'pokerbrain_runtime_ownership.json'), JSON.stringify(ownership, null, 2));

const queue = v3.conflicts.map((c) => ({
  taskId: c.taskId,
  domain: c.domain,
  status: c.classification === 'CONTEXT_MISMATCH' ? 'NEEDS_CONTEXT' : 'NEEDS_SOLVER_VALIDATION',
  sources: [c.brainPrimarySource, ...(c.supportingSources || [])],
  reason: c.reason,
  resolveWith: 'External solver validation or richer context in library task'
}));
writeFileSync(join(ART, 'pokerbrain_strategy_validation_queue.json'), JSON.stringify({ count: queue.length, items: queue }, null, 2));

let duplicatePack = { DUPLICATE_PACK_RUNTIME: false, notes: [] };
const inline = existsSync(join(dirname(fileURLToPath(import.meta.url)), '../index.html'));
if (inline) {
  const html = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../index.html'), 'utf8');
  const hasInline = html.includes('window.POKER_BRAIN_PACK=');
  duplicatePack = {
    DUPLICATE_PACK_RUNTIME: hasInline,
    loads: hasInline ? ['index.html inline', 'strategy_pack_v17.js via tests'] : ['strategy_pack_v17.js'],
    policyIdentical: 'assumed_identical_inline_copy',
    notes: ['Browser uses inline pack; Node tests load strategy_pack_v17.js file']
  };
}
writeFileSync(join(ART, 'pokerbrain_pack_runtime_audit.json'), JSON.stringify(duplicatePack, null, 2));

console.log('V3 shadow:', {
  TOTAL: v3.TOTAL_TASKS,
  ANALYZABLE: v3.BRAIN_ANALYZABLE,
  CONFLICT: v3.POLICY_CONFLICT,
  migration: migrationSummary
});
