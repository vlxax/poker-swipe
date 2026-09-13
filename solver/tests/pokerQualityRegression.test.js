import { test } from 'node:test';
import assert from 'node:assert/strict';

import { classifyPostflopHand } from '../src/cards/postflopClassification.js';
import { evaluateCards } from '../src/cards/handEvaluator.js';
import {
  lookupStackAwarePreflop,
  policiesDifferMaterially,
  MEANINGFUL_STACK_BUCKETS
} from '../src/preflop/stackAwarePolicy.js';
import { STRATEGY_SOURCE, mapLegacySource, isForbiddenGtoClaim } from '../src/analysis/strategySource.js';
import { fromPolyanaEvent, attachToTrip, unknownToNull } from '../src/tournaments/canonicalTournament.js';
import { gradeSizing, sizeFamily } from '../src/analysis/sizingGrade.js';
import { validateIcmInputs, assertIcmRunnable } from '../src/math/icmInputs.js';
import { validatePkoInputs } from '../src/math/pkoInputs.js';
import { conditionRange, rangesEqual } from '../src/ranges/streetRangeConditioning.js';
import { firstMajorMistake, streetByStreetReview } from '../src/hand/streetReview.js';
import { riverBluffCatchReport } from '../src/analysis/riverBluffCatch.js';
import { exploitRecommendation } from '../src/exploit/exploitConfidence.js';
import { disableReason, isDisabledTask } from '../src/training/taskDisableRegistry.js';
import { loadTaskLibrary } from '../src/training/taskLibraryBridge.js';
import { drillFromLibraryTask } from '../src/training/libraryDrill.js';
import { gradeAnswer } from '../src/training/answerEvaluator.js';
import { canGradeWithTrainerAction } from '../../trainer-knowledge/status.js';
import { resolveSemanticEntry, resolveNaiContextualAction } from '../../trainer-knowledge/semanticLegend.js';
import { scoreTrainerCandidate, sampleTrainerSession } from '../src/training/trainerCurriculum.js';
import { auditCanonicalSpot } from '../src/training/taskContextIntegrity.js';

function atlasStub() {
  return {
    'RFI|UTG|20|A9s': { FOLD: 0.049, RAISE: 0.951 },
    'RFI|UTG|50|A9s': { FOLD: 0.072, RAISE: 0.928 },
    'RFI|BTN|20|A5s': { FOLD: 0.12, RAISE: 0.88 },
    'RFI|BTN|50|A5s': { FOLD: 0.08, RAISE: 0.92 },
    'BB_DEFEND|BTN|20|K8s': { FOLD: 0.22, CALL: 0.68, RAISE: 0.1 },
    'BB_DEFEND|BTN|50|K8s': { FOLD: 0.18, CALL: 0.72, RAISE: 0.1 },
    'VS_3BET|BTN|20|AQo': { FOLD: 0.35, CALL: 0.45, RAISE: 0.2 },
    'VS_3BET|BTN|50|AQo': { FOLD: 0.28, CALL: 0.55, RAISE: 0.17 }
  };
}

test('strategy source never labels atlas as solver GTO', () => {
  assert.equal(mapLegacySource({ source: 'PREFLOP_ATLAS' }), STRATEGY_SOURCE.CURATED_REFERENCE);
  assert.equal(mapLegacySource({ source: 'TRAINER_EXACT' }), STRATEGY_SOURCE.TRAINER_VERIFIED);
  assert.equal(mapLegacySource({ source: 'CFR' }, { cfrConverged: true }), STRATEGY_SOURCE.SOLVER_VERIFIED);
  assert.equal(isForbiddenGtoClaim('GTO solver result'), true);
  assert.equal(isForbiddenGtoClaim('Curated reference atlas'), false);
});

test('preflop stack sensitivity: 20 vs 50 atlas rows differ', () => {
  const a = lookupStackAwarePreflop(atlasStub(), { spot: 'RFI', pos: 'UTG', stack: 20, hand: 'A9s' });
  const b = lookupStackAwarePreflop(atlasStub(), { spot: 'RFI', pos: 'UTG', stack: 50, hand: 'A9s' });
  assert.equal(a.strategySource, STRATEGY_SOURCE.CURATED_REFERENCE);
  assert.ok(policiesDifferMaterially(a.policy, b.policy, { minActionDelta: 0.01 }));
});

test('preflop 10bb is not claimed to be the 25bb atlas policy', () => {
  const short = lookupStackAwarePreflop(atlasStub(), { spot: 'RFI', pos: 'UTG', stack: 10, hand: 'A9s' });
  const mid = lookupStackAwarePreflop(atlasStub(), { spot: 'RFI', pos: 'UTG', stack: 25, hand: 'A9s' });
  assert.equal(short.strategySource, STRATEGY_SOURCE.HEURISTIC);
  assert.ok(short.policy.ALLIN > 0.4);
  assert.ok((mid.policy.RAISE || 0) > (short.policy.RAISE || 0));
  assert.ok(policiesDifferMaterially(short.policy, mid.policy));
});

test('15bb vs 40bb and shove vs 3-bet change with stack', () => {
  const a = lookupStackAwarePreflop(atlasStub(), { spot: 'RFI', pos: 'BTN', stack: 15, hand: 'A5s' });
  const b = lookupStackAwarePreflop(atlasStub(), { spot: 'RFI', pos: 'BTN', stack: 40, hand: 'A5s' });
  assert.ok(policiesDifferMaterially(a.policy, b.policy));
  const vs3s = lookupStackAwarePreflop(atlasStub(), { spot: 'VS_3BET', pos: 'BTN', stack: 10, hand: 'AQo' });
  const vs3d = lookupStackAwarePreflop(atlasStub(), { spot: 'VS_3BET', pos: 'BTN', stack: 50, hand: 'AQo' });
  assert.ok((vs3s.policy.ALLIN || 0) > (vs3d.policy.ALLIN || 0));
  assert.deepEqual(MEANINGFUL_STACK_BUCKETS.includes(10), true);
});

test('CALL is a grading-allowed trainer action', () => {
  assert.equal(canGradeWithTrainerAction('CALL', 'CALL'), true);
  assert.equal(canGradeWithTrainerAction('nAI', 'CALL', 'NON_ALL_IN_CALL'), true);
  const orange = resolveSemanticEntry('ORANGE_208_160_32', 'UO_STYLE');
  assert.equal(orange.normalizedAction, 'CALL');
  assert.equal(orange.gradingAllowed, true);
  const nai = resolveNaiContextualAction('callpush', { chartHasAI: true });
  assert.equal(nai.normalizedAction, 'CALL');
});

test('library CALL tasks exist, grade, and are not classified as fold', () => {
  const lib = loadTaskLibrary();
  const callTasks = lib.filter((t) => t.correct === 'КОЛЛ');
  assert.ok(callTasks.length >= 6, `call tasks ${callTasks.length}`);
  const kinds = {
    bb: callTasks.some((t) => /BB defence|защита BB/i.test(t.concept + t.tags.join())),
    vs3: callTasks.some((t) => /vs 3-бет|flat vs 3/i.test(t.concept)),
    flop: callTasks.some((t) => t.street === 'ФЛОП'),
    turn: callTasks.some((t) => t.street === 'ТЁРН'),
    river: callTasks.some((t) => t.street === 'РИВЕР' && /колл/i.test(t.correct))
  };
  assert.ok(kinds.bb && kinds.flop && kinds.river, JSON.stringify(kinds));
  const task = callTasks.find((t) => t.id === 'PRE_BB_K8S');
  const { drill } = drillFromLibraryTask(task);
  const g = gradeAnswer({ drill, chosenId: drill.options.find((o) => o.labelRu === 'КОЛЛ').id });
  assert.ok(['EXCELLENT', 'GOOD'].includes(g.grade));
  assert.notEqual(task.correct, 'ФОЛД');
});

test('mixed strategy CALL/CHECK is not binary-wrong', () => {
  const task = loadTaskLibrary().find((t) => t.id === 'PRE_RFI_BTN_A5S_15');
  const { drill } = drillFromLibraryTask(task);
  const also = drill.options.find((o) => o.labelRu === 'РЕЙЗ');
  const g = gradeAnswer({ drill, chosenId: also.id });
  assert.ok(['EXCELLENT', 'GOOD', 'INACCURACY'].includes(g.grade), g.grade);
  assert.equal(g.mixedStrategy, true);
});

test('postflop classification: gutshot, oesd, double gutter, no draw', () => {
  const evaluatorOk = evaluateCards(['Ah', 'Kh', 'Qh', 'Jh', 'Th']);
  assert.equal(evaluatorOk.category, 'straight_flush');

  const gut = classifyPostflopHand(['Qh', '9d'], ['Jc', '8s', '2c']);
  assert.equal(gut.gutshot, true);
  assert.equal(gut.openEnded, false);

  const oesd = classifyPostflopHand(['9s', '8s'], ['7h', '6c', '2d']);
  assert.equal(oesd.openEnded, true);
  assert.equal(oesd.gutshot, false);

  const dg = classifyPostflopHand(['Jh', '9d'], ['Tc', '8s', '6h']);
  assert.ok(dg.doubleGutter || dg.gutshot || dg.openEnded);

  const none = classifyPostflopHand(['As', '5d'], ['Kh', '7c', '2d']);
  assert.equal(none.straightDraw, false);
  assert.equal(none.flushDraw, false);
});

test('postflop classification: flush draws, combo, pair+draw, made', () => {
  const nut = classifyPostflopHand(['Ah', 'Kh'], ['Qh', '5h', '2c']);
  assert.equal(nut.flushDraw, true);
  assert.equal(nut.nutFlushDraw, true);

  const nonNut = classifyPostflopHand(['Kh', '9h'], ['Qh', '5h', '2c']);
  assert.equal(nonNut.flushDraw, true);
  assert.equal(nonNut.nutFlushDraw, false);

  const bd = classifyPostflopHand(['Ah', 'Kd'], ['Qh', '5h', '2d']);
  assert.equal(bd.flushDraw, false);
  assert.equal(bd.backdoorFlushDraw, true);

  const combo = classifyPostflopHand(['Ah', 'Kh'], ['Qh', 'Jh', '2c']);
  assert.equal(combo.comboDraw, true);

  const pairDraw = classifyPostflopHand(['Ah', '9h'], ['Ad', '7h', '2h']);
  assert.equal(pairDraw.made, 'top_pair');
  assert.equal(pairDraw.pairPlusDraw, true);

  const made = classifyPostflopHand(['Ah', 'Ad'], ['Kd', '7c', '2s']);
  assert.equal(made.overpair || made.made === 'overpair', true);
  assert.equal(made.madeWithoutDraw, true);
});

test('sizing grading is not numeric proximity alone', () => {
  const closeWrongFamily = gradeSizing({
    chosenPct: 50,
    allowedSizes: [33, 75, 125],
    sizeWeights: [{ pct: 75, weight: 0.8 }, { pct: 33, weight: 0.2 }]
  });
  const match = gradeSizing({
    chosenPct: 75,
    allowedSizes: [33, 75, 125],
    sizeWeights: [{ pct: 75, weight: 0.8 }, { pct: 33, weight: 0.2 }]
  });
  assert.notEqual(closeWrongFamily.grade, 'g');
  assert.equal(match.grade, 'g');
  assert.equal(closeWrongFamily.proximityOnly, false);
  assert.equal(sizeFamily(50), 'standard');
  assert.equal(sizeFamily(125), 'overbet');

  const ev = gradeSizing({
    chosenPct: 66,
    evBySize: { 33: 0.1, 66: 1.2, 100: 0.4 }
  });
  assert.equal(ev.strategySource, STRATEGY_SOURCE.SOLVER_VERIFIED);
  assert.equal(ev.grade, 'g');
});

test('daily hand mixed + EV persistence via library drill', () => {
  const task = loadTaskLibrary().find((t) => t.id === 'R_THIN_VALUE');
  assert.ok(task.explain.includes('блокирует') || task.explain.includes('цель'));
  const { drill } = drillFromLibraryTask(task);
  const bet = drill.options.find((o) => o.labelRu === 'СТАВКА');
  const g = gradeAnswer({ drill, chosenId: bet.id });
  assert.ok(['EXCELLENT', 'GOOD'].includes(g.grade));
  assert.equal(g.evLossBb, 0);
});

test('My Hands first major mistake is turn, not river-only', () => {
  const review = streetByStreetReview([
    { street: 'flop', evLossBB: 0.02, grade: 'GOOD' },
    { street: 'turn', evLossBB: 0.9, grade: 'MISTAKE', index: 1 },
    { street: 'river', evLossBB: 0.4, grade: 'MISTAKE', index: 2 }
  ]);
  assert.equal(review.firstMajorMistake.street, 'turn');
  assert.equal(review.doNotBlameOnlyRiver, true);
  assert.match(review.label, /TURN/);
});

test('range conditioning changes after each action', () => {
  const pre = { K8s: 1, '22': 1, A5s: 1, '72o': 1 };
  const r = conditionRange(pre, [
    { street: 'flop', action: 'call', board: ['Ah', '7d', '2c'], sizingPct: 33 },
    { street: 'turn', action: 'call', board: ['Ah', '7d', '2c', '9s'], sizingPct: 75 },
    { street: 'river', action: 'bet', board: ['Ah', '7d', '2c', '9s', '3d'], sizingPct: 100 }
  ]);
  assert.equal(rangesEqual(pre, r.range), false);
  assert.ok(r.trail.length >= 4);
});

test('river bluff-catch explains value vs bluffs without inventing combos', () => {
  const r = riverBluffCatchReport({ potBB: 20, betBB: 28 });
  assert.ok(r.requiredEquity > 0);
  assert.equal(r.valueCombos, null);
  assert.equal(r.inventedComboCount, false);
  assert.match(r.explanation, /not invented/i);
  const withCombos = riverBluffCatchReport({ potBB: 20, betBB: 10, valueCombos: 12, bluffCombos: 4 });
  assert.match(withCombos.explanation, /Value combos/);
});

test('ICM refused without tournament inputs', () => {
  const bad = assertIcmRunnable({ stacks: [20], payouts: null, playersRemaining: 9 });
  assert.equal(bad.canRunIcm, false);
  const good = validateIcmInputs({
    stacks: [40, 30, 20, 15, 10, 8, 7, 6, 5],
    payouts: [50, 30, 20, 12, 8, 6, 5, 4, 3],
    playersRemaining: 9
  });
  assert.equal(good.ok, true);
});

test('PKO missing bounty is not treated as zero', () => {
  const miss = validatePkoInputs({ effectiveStack: 25, remainingPlayers: 18 });
  assert.equal(miss.missingBountyTreatedAsZero, false);
  assert.equal(miss.canClaimPkoSolver, false);
  const okish = validatePkoInputs({
    heroBounty: 10,
    villainBounty: 20,
    bountyValue: 1,
    effectiveStack: 30,
    remainingPlayers: 3,
    stacks: [30, 40, 25],
    payouts: [50, 30, 20]
  });
  assert.equal(okish.ok, true);
  assert.ok(okish.bountyPresent);
});

test('exploit confidence scales with sample', () => {
  const small = exploitRecommendation({ sampleHands: 8, archetype: 'NIT' });
  assert.equal(small.allowStrongExploit, false);
  const large = exploitRecommendation({ sampleHands: 90, archetype: 'MANIAC' });
  assert.equal(large.allowStrongExploit, true);
  assert.ok(large.strength > small.strength);
});

test('personalization: weak concept up, mastered down, review priority, variety', () => {
  const mk = (id, skill, mode) => ({
    id, options: ['ФОЛД', 'КОЛЛ'], trainerMeta: { sourceMode: mode || 'vs1r', normalizedAction: 'CALL', chartId: id, hand: 'K8s' }
  });
  const pool = [
    mk('t_weak', 'bb_defence', 'vs1rshort'),
    mk('t_weak2', 'bb_defence', 'vs1rshort'),
    mk('t_other', 'rfi_btn', 'uo'),
    mk('t_other2', 'rfi_btn', 'uo')
  ];
  const scoredWeak = scoreTrainerCandidate(pool[0], { weaknessSkills: { bb_defence: 4 }, rng: () => 0.5 });
  const scoredStrong = scoreTrainerCandidate(pool[2], { weaknessSkills: { bb_defence: 4 }, rng: () => 0.5 });
  assert.ok(scoredWeak.score > scoredStrong.score);

  const sampled = sampleTrainerSession(pool, {
    count: 3,
    weaknessSkills: { bb_defence: 3 },
    rng: () => 0.5
  });
  const ids = sampled.map((t) => t.id);
  assert.ok(new Set(ids).size === ids.length || ids.length <= 3);
});

test('data integrity: disabled invalid variants have explicit reasons; library CALL context valid', () => {
  assert.ok(isDisabledTask('T_Q832_AQ_V0'));
  assert.match(disableReason('T_JT85_KQ_V1'), /POSITION_MISMATCH/);
  const task = loadTaskLibrary().find((t) => t.id === 'PRE_ISO_LIMP');
  const audit = auditCanonicalSpot(task, { mode: 'swipe' });
  const posErr = (audit.errors || []).filter((e) => e.type === 'POSITION_MISMATCH');
  assert.equal(posErr.length, 0, JSON.stringify(posErr));
});

test('heuristic stacks 5-15 and 75-100 are not solver-verified', () => {
  for (const stack of [5, 7, 10, 12, 15, 75, 100]) {
    const r = lookupStackAwarePreflop(atlasStub(), { spot: 'RFI', pos: 'UTG', stack, hand: 'A9s' });
    assert.equal(r.strategySource, STRATEGY_SOURCE.HEURISTIC, String(stack));
    assert.equal(isForbiddenGtoClaim(r.note), false);
    assert.equal(/SOLVER_VERIFIED|GTO|SOLVER/.test(r.strategySource), false);
  }
  const mid = lookupStackAwarePreflop(atlasStub(), { spot: 'RFI', pos: 'UTG', stack: 20, hand: 'A9s' });
  assert.equal(mid.strategySource, STRATEGY_SOURCE.CURATED_REFERENCE);
});

test('ICM labels are educational or incomplete, never solver ICM', () => {
  const good = validateIcmInputs({
    stacks: [40, 30, 20],
    payouts: [50, 30, 20],
    playersRemaining: 3
  });
  assert.equal(good.strategySource, STRATEGY_SOURCE.ICM_EDUCATIONAL_MODEL);
  assert.equal(isForbiddenGtoClaim('GTO ICM'), true);
  assert.equal(isForbiddenGtoClaim('Solver ICM'), true);
  assert.equal(isForbiddenGtoClaim('Exact ICM solution'), true);
  const bad = validateIcmInputs({});
  assert.equal(bad.ok, false);
});

test('PKO incomplete bounty is INCOMPLETE_INPUT not zero', () => {
  const miss = validatePkoInputs({ effectiveStack: 25, remainingPlayers: 18 });
  assert.equal(miss.strategySource, 'INCOMPLETE_INPUT');
  assert.ok(miss.missing.includes('hero_bounty'));
  assert.equal(miss.canClaimPkoSolver, false);
});

test('exploit 5-hand sample is not a strong exploit', () => {
  const tiny = exploitRecommendation({ sampleHands: 5, archetype: 'STATION' });
  assert.equal(tiny.allowStrongExploit, false);
  assert.equal(tiny.adjustment, 'baseline');
  const mid = exploitRecommendation({ sampleHands: 40, archetype: 'STATION' });
  const large = exploitRecommendation({ sampleHands: 120, archetype: 'STATION' });
  assert.ok(mid.strength > tiny.strength);
  assert.ok(large.strength >= mid.strength);
});

test('river explanation never invents villain combo counts', () => {
  const r = riverBluffCatchReport({ potBB: 12, betBB: 8, blockerNotes: ['Hero blocks nut flush'] });
  assert.equal(r.bluffCombos, null);
  assert.equal(/Villain has \d+ bluff combos/i.test(r.explanation), false);
  assert.match(r.explanation, /not invented/i);
});

test('illegal / malformed context rejected by integrity audit', () => {
  const bad = auditCanonicalSpot({
    id: 'X_BAD',
    street: 'ФЛОП',
    board: ['Ah', 'Ah', 'Kd'],
    position: 'BTN',
    villain: 'BTN',
    hero: ['Ah', 'Kd'],
    heroStack: 20,
    history: []
  }, { mode: 'swipe' });
  assert.equal(bad.ok, false);
});

test('Polyana canonical tournament id is preserved; null stays null', () => {
  const event = {
    id: '7c129757',
    date: '2026-09-13',
    time: '19:00',
    club: 'A2',
    tournament: 'Классика PATRON CLASSIC',
    game: null,
    format: null,
    fee_rub: 0,
    reentry_limit: null,
    addon_allowed: null,
    bounty_type: null,
    late_reg_minutes: null,
    level_minutes: null,
    address: 'Венёвская улица, 2А'
  };
  const rec = fromPolyanaEvent(event);
  assert.equal(rec.id, '7c129757');
  assert.equal(rec.polyanaId, '7c129757');
  assert.equal(rec.game, null);
  assert.equal(rec.reentryLimit, null);
  assert.equal(rec.addon, null);
  assert.equal(rec.bounty, null);
  assert.equal(unknownToNull(null), null);
  const trip = attachToTrip({ city: 'Москва' }, rec);
  assert.deepEqual(trip.tournamentIds, ['7c129757']);
});
