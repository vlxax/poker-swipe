// End-to-end demo of the personalised, solver-driven training pipeline.
//
// It reviews a real "My Hands" hand with the CFR solver, normalizes the
// resulting training candidate, records it into a persistent-style store
// (showing dedup), ranks the leak profile ("Ты" top-leak connection), plans a
// daily session, generates validated drills using the REAL solver as the
// `solve` function, grades a drill answer against the solver's EV, and records
// the attempt into concept progress. Every number printed is real solver output
// — nothing is fabricated or mocked.
//
// The CFR solve is bounded the same way the product bounds it
// (maxChanceBranches: 1, fixed low iterations) so the demo runs in seconds.
//
//   node scripts/demoPersonalizedTraining.js   (from solver/)

import { analyzeHand } from '../src/hand/handAnalyzer.js';
import { buildReviewModel } from '../src/integration/reviewModel.js';
import { createTrainingStore } from '../src/training/trainingStore.js';
import { normalizeCandidate } from '../src/training/candidateNormalizer.js';
import {
  recordCandidate, getTopLeaks, getDailyPersonalizedTraining, buildPersonalizedSessionAsync, recordTrainingResult
} from '../src/training/personalizedTraining.js';
import { gradeAnswer } from '../src/training/answerEvaluator.js';
import { leakLabelRu } from '../src/training/concepts.js';

// Bounded, deterministic solver options. CFR cost scales with the range-class
// count, so the demo uses a tiny 2×2 range set (2 classes per side) with a low
// iteration count — enough to produce a real, validated drill in a few seconds
// per spot while staying honest about the abstraction.
const RANGES = { hero: { AA: 1, KK: 1 }, villain: { QQ: 1, JJ: 1 } };
const SOLVE_OPTS = { iterations: 8, adaptive: false, maxChanceBranches: 1, seed: 12345 };
const solve = (input, opts = {}) => analyzeHand(input, { ...SOLVE_OPTS, ...opts });

// ---- 1. A real hand Hero "misplays": bets too small on the turn (sizing). ----
const hand = {
  heroSeat: 'BTN', villainSeat: 'BB',
  hero: ['A♠', 'K♦'], villain: ['Q♥', 'Q♣'],
  board: ['A♥', 'K♣', '2♦', '8♠', '3♥'],
  effStack: 100, format: 'MTT',
  actions: [
    { actor: 'HERO', street: 'PREFLOP', action: 'RAISE', size: 2.5, pct: 55 },
    { actor: 'VILLAIN', street: 'PREFLOP', action: 'CALL', call: 1.5, required: 1.5, potAfter: 5.5 },
    { actor: 'HERO', street: 'FLOP', action: 'BET', pct: 62 },
    { actor: 'VILLAIN', street: 'FLOP', action: 'CALL', call: 3.4, required: 3.4, potAfter: 12.3 },
    { actor: 'HERO', street: 'TURN', action: 'BET', pct: 25 },
    { actor: 'VILLAIN', street: 'TURN', action: 'CALL', call: 3, required: 3, potAfter: 18.3 },
    { actor: 'HERO', street: 'RIVER', action: 'CHECK' }
  ]
};

const line = (s = '') => console.log(`\n${s}`);

line('=== PokerSwipe · personalized solver-driven training (end-to-end demo) ===');

// ---- 2. Review the hand with the real solver. ----
line('1) Reviewing the hand with the CFR solver…');
const model = buildReviewModel(hand, {
  iterations: SOLVE_OPTS.iterations,
  maxChanceBranches: SOLVE_OPTS.maxChanceBranches,
  seed: SOLVE_OPTS.seed,
  ranges: RANGES
});
console.log(`   status: ${model.status} · decisions: ${model.decisions.length} solved / ${model.overall.solvedDecisions} · total EV loss: ${model.overall.totalEvLossBB} BB`);

// ---- 3. Normalize the training candidate. ----
const candidate = normalizeCandidate({
  reviewModel: model,
  sourceHandId: 'demo-hand-001',
  sourceCandidateId: 'demo-cand-001'
});
console.log(`   candidate → street: ${candidate.street} · concept: ${candidate.concept} (${leakLabelRu(candidate.concept)}) · EV loss: ${candidate.sourceEvLossBb} BB`);

// ---- 4. Record into the store (showing dedup on the second call). ----
line('2) Recording candidate into the training store (dedup by hand+decision)…');
const store = createTrainingStore();
const first = recordCandidate(store, candidate);
const second = recordCandidate(store, candidate);
console.log(`   recorded: ${first.recorded} · deduped on re-record: ${second.deduped === true || second.reason === 'duplicate'}`);

// ---- 5. Top-leak connection ("Ты"). ----
line('3) "Ты" top-leak connection…');
for (const t of getTopLeaks(store)) {
  console.log(`   • ${t.concept} (${t.label}) · priority ${t.priority} · ${t.evidence}`);
}

// ---- 6. Daily plan. ----
line('4) Daily personalized plan…');
const plan = getDailyPersonalizedTraining({ store, count: 7 });
console.log(`   personalized: ${plan.personalized} · primaryConcept: ${plan.primaryConcept} · drills: ${plan.plan.drills.length}`);
for (const d of plan.plan.drills) console.log(`   - ${d.concept} (${leakLabelRu(d.concept)}) · street ${d.street}`);

// ---- 7. Generate validated drills with the real solver. ----
line('5) Generating validated drills with the real solver…');
const session = await buildPersonalizedSessionAsync({
  store, count: 2, solve, config: { ranges: () => RANGES, maxAttempts: 3, rng: Math.random }
});
console.log(`   filled: ${session.filled} drill(s) in ${session.elapsedMs}ms`);
if (session.failures.length) console.log(`   skipped/unfillable: ${session.failures.map((f) => `${f.concept} (${f.reason})`).join(', ')}`);

for (const drill of session.drills) {
  console.log(`\n   drill [${drill.concept}] · difficulty ${drill.difficulty}/5`);
  console.log(`     board: ${drill.scenario.board.join(' ')} · pot ${drill.scenario.potBb} BB`);
  for (const o of drill.options) console.log(`       ${o.id} → ${o.labelRu}`);
  console.log(`     recommended: ${JSON.stringify(drill.solution.recommendedAction)} @ ${drill.solution.recommendedFrequency} · bestEV ${drill.solution.bestEV}`);

  // ---- 8. Grade the solver's own recommended answer, then a mistake. ----
  const recId = drill.solution.recommendedAction
    ? drill.options.find((o) => o.action && o.action.type === drill.solution.recommendedAction.type)?.id
    : null;
  const good = recId ? gradeAnswer({ drill, chosenId: recId }) : null;
  if (good) console.log(`     grade (recommended line): ${good.grade} · EV loss ${good.evLossBb} BB`);
  const wrong = drill.options.find((o) => o.id !== recId);
  if (wrong) {
    const bad = gradeAnswer({ drill, chosenId: wrong.id });
    console.log(`     grade (alt line): ${bad.grade} · EV loss ${bad.evLossBb} BB`);
    recordTrainingResult(store, { drill, grade: bad.grade, evLossBb: bad.evLossBb });
  }
}

// ---- 9. Concept progress after recording attempts. ----
line('6) Concept progress…');
const drilledConcepts = [...new Set(session.drills.map((d) => d.concept))];
for (const concept of drilledConcepts) {
  const p = store.loadProgress(concept);
  if (p) {
    console.log(`   ${concept} · attempts ${p.attempts} · optimalRate ${p.optimalRate} · mastery ${p.masteryScore != null ? p.masteryScore.toFixed(1) : 'n/a'} · trend ${p.trend}`);
  }
}

line('\nDone. All numbers are produced by the real CFR solver; nothing was fabricated.');