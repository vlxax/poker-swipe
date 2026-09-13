/**
 * Poker Brain trainer bridge — loads trainer knowledge and wraps PokerBrain (preflop).
 * Include after poker_brain scripts in index.html:
 *   <script type="module" src="trainer-knowledge/poker_brain_trainer_bridge.js"></script>
 */
import { initBrowserTrainerLookup, getBrowserTrainerLookup } from './browserLookup.js';
import { buildBrainTrainerResult, mergeBrainAndTrainer } from './adapters/brainAdapter.js';

let ready = false;

async function ensureReady() {
  if (ready && getBrowserTrainerLookup()) return getBrowserTrainerLookup();
  const lookup = await initBrowserTrainerLookup();
  ready = true;
  return lookup;
}

function patchPokerBrain() {
  const PB = window.PokerBrain;
  if (!PB || PB.__trainerPatched) return;
  const origAnalyze = PB.analyzeHand?.bind(PB);
  const origGrade = PB.gradeDecision?.bind(PB);
  const origNodeFor = PB.nodeFor?.bind(PB);

  PB.lookupTrainer = async function trainerLookup(spot, handClass) {
    const lookup = await ensureReady();
    const hc = handClass || PB.classOf?.(spot.hero || []);
    return buildBrainTrainerResult(lookup, spot, hc);
  };

  PB.analyzeHand = function analyzeHandWithTrainer(hand) {
    const base = origAnalyze ? origAnalyze(hand) : { match: 'NO_DECISION', confidence: 0, summary: '' };
    const lookup = getBrowserTrainerLookup();
    if (!lookup || !hand) return { ...base, trainerStatus: 'NO_TRAINER_DATA' };

    const heroActs = (hand.actions || []).filter((a) => a.actor === 'HERO');
    const last = heroActs.at(-1);
    const streetRaw = String(last?.street || hand.street || 'PREFLOP').toUpperCase();
    const streetNorm = streetRaw === 'ПРЕФЛОП' ? 'PREFLOP' : streetRaw;
    if (!last || streetNorm !== 'PREFLOP') {
      return { ...base, trainerStatus: 'NO_TRAINER_DATA', brain: base.result || null };
    }

    const boardN = 0;
    const spot = {
      id: 'USER_HAND',
      street: 'PREFLOP',
      pos: hand.heroSeat || 'HERO',
      hero: hand.hero || [],
      board: (hand.board || []).slice(0, boardN),
      stack: hand.effStack || 30,
      pot: last.potBefore || hand.pot || 0,
      ctx: hand.ctx || last.ctx || '',
      villainSeat: hand.villainSeat
    };
    const hc = PB.classOf?.(hand.hero || []);
    const trainer = buildBrainTrainerResult(lookup, spot, hc);
    const merged = mergeBrainAndTrainer({ brainResult: base.result, trainerResult: trainer });

    return {
      ...base,
      match: trainer.status === 'EXACT_TRAINER_MATCH' ? 'TRAINER' : base.match,
      trainerStatus: trainer.status,
      trainer: trainer.trainer,
      trainerMismatches: trainer.mismatches,
      trainerChartId: trainer.chartId,
      brain: merged.brain,
      primarySource: merged.primarySource,
      summary: merged.explanation || base.summary,
      trainerNote: merged.trainerNote || null
    };
  };

  PB.gradeDecision = function gradeDecisionWithTrainer(spot, action, size = null) {
    const brain = origGrade ? origGrade(spot, action, size) : null;
    const lookup = getBrowserTrainerLookup();
    const streetRaw = String(spot.street || 'PREFLOP').toUpperCase();
    const streetNorm = streetRaw === 'ПРЕФЛОП' ? 'PREFLOP' : streetRaw;
    if (!lookup || streetNorm !== 'PREFLOP') {
      return { ...brain, trainerStatus: 'NO_TRAINER_DATA', brainSource: brain?.source };
    }

    const hc = PB.classOf?.(spot.hero || []);
    const trainer = buildBrainTrainerResult(lookup, spot, hc);
    const merged = mergeBrainAndTrainer({ brainResult: brain, trainerResult: trainer });

    const out = {
      ...brain,
      trainerStatus: trainer.status,
      trainer: trainer.trainer,
      trainerMismatches: trainer.mismatches,
      trainerChartId: trainer.chartId,
      brainInference: brain ? { ...brain, source: brain.source } : null,
      primarySource: merged.primarySource,
      source: merged.primarySource === 'TRAINER' ? 'TRAINER' : brain?.source
    };

    if (trainer.status === 'EXACT_TRAINER_MATCH' && trainer.trainer?.gradingAllowed) {
      const expected = trainer.trainer.actionRaw;
      const norm = String(action || '').toUpperCase();
      const match = norm === expected || (expected === 'AI' && /RAISE|ALL/i.test(norm));
      out.grade = match ? 'g' : 'r';
      out.actionGrade = match ? 'g' : 'r';
      out.explanation = `Тренерская база · ${expected} · ${trainer.trainer.provenanceDebug || ''}`;
      out.confidence = 95;
    } else if (trainer.status === 'PARTIAL_TRAINER_MATCH') {
      out.explanation = `${brain?.explanation || ''} [PARTIAL trainer: ${(trainer.mismatches || []).join(', ')}]`.trim();
    } else if (trainer.status === 'TRAINER_DATA_NEEDS_CLARIFICATION') {
      out.explanation = `${brain?.explanation || ''} [Trainer: ${trainer.trainer?.actionRaw || '?'} NEEDS_CLARIFICATION]`.trim();
    }

    return out;
  };

  PB.nodeFor = function nodeForWithTrainer(spot) {
    const brainNode = origNodeFor ? origNodeFor(spot) : null;
    const lookup = getBrowserTrainerLookup();
    if (!lookup) return brainNode;
    const hc = PB.classOf?.(spot.hero || []);
    const trainer = buildBrainTrainerResult(lookup, spot, hc);
    return {
      ...(brainNode || {}),
      trainer,
      brainNode: brainNode ? { ...brainNode, source: brainNode.source } : null
    };
  };

  PB.__trainerPatched = true;
  window.TrainerKnowledge = { ready: () => ready, ensureReady, getLookup: getBrowserTrainerLookup };
}

ensureReady().then(() => {
  patchPokerBrain();
  document.addEventListener('DOMContentLoaded', patchPokerBrain);
  if (document.readyState !== 'loading') patchPokerBrain();
}).catch((e) => {
  console.warn('[TrainerKnowledge] init failed', e);
});
