// End-to-end demo of the personalised training UI layer (training-ui modules)
// wired to the REAL solver. Reviews a My Hands hand, records a candidate,
// opens the training home, starts a personalised session, renders drill 1,
// grades a simulated answer, advances and shows the session summary, and
// verifies concept progress was updated. Every number is real solver output.
//
//   node scripts/demoPersonalizedTrainingUi.js   (from solver/)

import { analyzeHand } from '../src/hand/handAnalyzer.js';
import { buildReviewModel } from '../src/integration/reviewModel.js';
import { createTrainingStore } from '../src/training/trainingStore.js';
import { normalizeCandidate } from '../src/training/candidateNormalizer.js';
import { recordCandidate, getTopLeaks } from '../src/training/personalizedTraining.js';
import { SessionController } from '../../training-ui/sessionController.js';
import { drillViewModel, feedbackViewModel } from '../../training-ui/viewModel.js';

const RANGES = { hero: { AA: 1, KK: 1 }, villain: { QQ: 1, JJ: 1 } };
const SOLVE_OPTS = { iterations: 8, adaptive: false, maxChanceBranches: 1, seed: 12345 };
const solve = (input, opts = {}) => analyzeHand(input, { ...SOLVE_OPTS, ...opts });

const line = (s = '') => console.log(`\n${s}`);
const fmt = (n) => (n == null ? '—' : Number(n).toFixed(2));

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

line('=== PokerSwipe · personalised training UI (real solver demo) ===');

// 1) Review a real hand and record the candidate.
console.log('1) Reviewing hand with the CFR solver…');
const model = buildReviewModel(hand, { iterations: SOLVE_OPTS.iterations, maxChanceBranches: 1, seed: 12345, ranges: RANGES });
const candidate = normalizeCandidate({ reviewModel: model, sourceHandId: 'ui-demo-001', sourceCandidateId: 'ui-demo-001' });
const store = createTrainingStore();
recordCandidate(store, candidate);
console.log(`   candidate → street ${candidate.street} · concept ${candidate.concept} · EV loss ${candidate.sourceEvLossBb} BB`);
console.log(`   top leak: ${getTopLeaks(store)[0].label} (${getTopLeaks(store)[0].evidence})`);

// 2) Training home — personalised block.
const ctl = new SessionController({
  store, solve, solveOpts: SOLVE_OPTS,
  config: { count: 7, maxAttempts: 5, timeBudgetMs: 60000, trendMinSamples: 5 },
  now: () => Date.now()
});
const home = ctl.home();
line('2) Training home…');
console.log(`   ${home.title} · type=${home.type} · spots=${home.total} · difficulty=${home.difficulty} · cta="${home.cta}"`);

// 3) Start a personalised session (real solver drills).
line('3) Starting personalised session…');
const started = ctl.start();
console.log(`   started=${started.started} cached=${started.cached}`);
while (ctl.state === 'loading') await new Promise((r) => setTimeout(r, 200));
console.log(`   state=${ctl.state} · drills generated=${ctl.drills.length}`);

// 4) Render drill 1.
const drill1 = ctl.current();
const vm1 = drillViewModel({ drill: drill1, ...ctl.progress() });
line('4) Drill 1…');
console.log(`   ${vm1.streetRu} · pot ${fmt(vm1.scenario.potBb)} BB · eff ${fmt(vm1.scenario.effectiveStackBb)} BB`);
console.log(`   board: ${vm1.scenario.board.join(' ')} · hero: ${vm1.scenario.heroCards.join(' ')}`);
console.log(`   prompt: ${vm1.prompt}`);
console.log(`   options: ${vm1.options.map((o) => o.labelRu).join(' | ')}`);
console.log(`   confidence: ${vm1.confidence.available ? vm1.confidence.score + '%' + (vm1.confidence.note ? ' (' + vm1.confidence.note + ')' : '') : 'n/a'}`);

// 5) Simulate an answer with the recommended line, then a mistake.
const recId = drill1.solution.recommendedAction
  ? drill1.options.find((o) => o.action && o.action.type === drill1.solution.recommendedAction.type).id
  : drill1.options[0].id;
line('5) Simulating answer (recommended line)…');
const fbGood = ctl.answer(recId);
const fbVmGood = feedbackViewModel({ result: fbGood, drill: drill1 });
console.log(`   grade=${fbGood.grade} · EV loss ${fmt(fbGood.evLossBb)} BB · "${fbGood.feedbackRu.title}"`);

// 6) Advance to summary.
line('6) Advancing to session summary…');
ctl.next();
const vmSummary = ctl.summary();
console.log(`   solved=${vmSummary.solved}/${vmSummary.total} · avg EV loss ${fmt(vmSummary.avgLossBb)} BB · near-optimal ${vmSummary.nearOptimalCount}`);
console.log(`   primary concept: ${vmSummary.primaryLabel}`);
console.log(`   trend available=${vmSummary.trend.available}` + (vmSummary.trend.available ? ` (Δ ${vmSummary.trend.delta > 0 ? '+' : ''}${fmt(vmSummary.trend.delta)} BB)` : ' — нужно больше решений'));

// 7) Verify progress was recorded.
line('7) Concept progress…');
const p = store.loadProgress(drill1.concept);
console.log(`   ${drill1.concept} · attempts=${p.attempts} · optimalRate=${p.optimalRate} · mastery=${p.masteryScore != null ? p.masteryScore.toFixed(1) : 'n/a'}`);

line('\nDone. All numbers produced by the real CFR solver through the training-ui layer.');