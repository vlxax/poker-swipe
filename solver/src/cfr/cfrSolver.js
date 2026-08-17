import { buildGameTree } from '../tree/treeBuilder.js';
import { SolverError } from '../api/errors.js';
import { CFRTrainer, comboKey } from './cfrTrainer.js';
import { ConvergenceTracker } from './convergence.js';
import { AdaptiveConvergence, buildAdaptiveConfig, DEFAULT_ADAPTIVE_CONFIG } from './adaptiveConvergence.js';
import { computeExploitability, rootActionEV } from './exploitability.js';
import { aggregateStrategy, normalizeReach } from '../ranges/rangePropagation.js';
import { averageStrategy } from './strategyAccumulator.js';

const ALGORITHMS = ['cfr', 'cfr_plus'];

// Solve the game tree by CFR (vanilla or CFR+). When `iterations` is the string
// "adaptive" (or `options.adaptive` is true) the solver uses automated convergence
// detection and stops as soon as several consecutive checkpoints are stable,
// bounded by min/maxIterations and time/node limits. Otherwise it runs a fixed
// number of iterations (legacy behavior, preserved for compatibility).
export function solveCFR(input = {}, options = {}) {
  const start = Date.now();
  const tree = buildGameTree(input);
  const cfg = tree.cfg;

  const algorithm = String(options.algorithm || 'cfr').toLowerCase();
  if (!ALGORITHMS.includes(algorithm)) {
    throw new SolverError('INVALID_CONFIG', `algorithm must be one of: ${ALGORITHMS.join(', ')}`);
  }

  const adaptive = options.adaptive || String(options.iterations).toLowerCase() === 'adaptive';
  const seed = options.seed != null ? Number(options.seed) : 12345;
  const maxSolveMs = options.maxSolveMs != null ? Number(options.maxSolveMs) : 0;
  const signal = options.signal || options.abortSignal || null;
  if (signal && typeof signal.aborted !== 'boolean') {
    throw new SolverError('INVALID_CONFIG', 'signal must be an AbortSignal-like object');
  }

  const trainer = new CFRTrainer(tree, {
    algorithm,
    linearAveraging: !!options.linearAveraging
  });

  const adaptiveCfg = adaptive ? buildAdaptiveConfig(options, cfg) : null;

  let iterations = Number(options.iterations || 1000);
  if (!Number.isFinite(iterations) || iterations <= 0) iterations = 1000;
  if (adaptive) iterations = adaptiveCfg.maxIterations;

  const convergence = adaptive
    ? new AdaptiveConvergence(adaptiveCfg)
    : new ConvergenceTracker({
        sampleEvery: options.sampleEvery || Math.max(1, Math.floor(iterations / 20))
      });

  let iterationsRun = 0;
  let stopReason = 'max_iterations';
  for (let t = 1; t <= iterations; t++) {
    trainer.iterate();
    iterationsRun = t;

    if (signal && signal.aborted) {
      throw new SolverError('CANCELLED', 'solve was aborted via signal');
    }
    if (maxSolveMs > 0 && Date.now() - start > maxSolveMs) {
      stopReason = 'time_limit';
      break;
    }

    if (adaptive) {
      if (t % adaptiveCfg.checkEvery === 0 && t >= adaptiveCfg.minIterations) {
        const st = convergence.checkpoint(t, { trainer, tree });
        if (st.converged) {
          stopReason = 'converged';
          break;
        }
      }
    } else {
      convergence.maybeRecord(t, trainer.infos);
    }
  }

  const exploit = computeExploitability(tree, trainer);
  const actionEV = rootActionEV(tree, trainer);
  const root = tree.root;

  // Per-combo strategy and reach weights at the root for the root actor.
  const actor = root.playerToAct;
  const actorCombos = actor === 'hero' ? tree.heroCombos : tree.villainCombos;
  const comboStrategies = {};
  const weightMap = {};
  for (const c of actorCombos) {
    const key = comboKey(c.cards);
    comboStrategies[key] = averageStrategy(
      (trainer.infos.get(`node:${root.id}`, root.actions.map((a) => a.id)).strategySum)[key] || {},
      root.actions.map((a) => a.id)
    );
    weightMap[key] = c.weight;
  }

  const aggregate = aggregateStrategy(weightMap, comboStrategies);
  const convStatus = adaptive
    ? convergence.finalize({ iterationsRun, stopReason })
    : convergence.finalStatus({ iterationsRun, stopReason });

  // bestAction + heroAction based on action EV.
  const ids = Object.keys(actionEV);
  let bestId = ids.length ? ids[0] : null;
  for (const id of ids) if (actionEV[id] > actionEV[bestId]) bestId = id;
  const heroActionId = input.heroAction ? String(input.heroAction.type === 'bet' ? `bet_${Math.round((input.heroAction.sizePot || 0) * 100)}` : input.heroAction.type) : null;
  const heroEV = heroActionId != null ? actionEV[heroActionId] : null;
  const bestEV = bestId != null ? actionEV[bestId] : null;
  const evLossBB = heroEV != null && bestEV != null ? bestEV - heroEV : null;

  const chanceCapped = Number.isFinite(cfg.maxChanceBranches) && cfg.maxChanceBranches < Infinity;

  return {
    algorithm,
    iterations: iterationsRun,
    adaptive: adaptive || null,
    game: {
      street: tree.game.street,
      board: tree.game.board,
      potBB: tree.game.potBB,
      effectiveStackBB: tree.game.effectiveStackBB,
      heroPosition: tree.game.heroPosition,
      villainPosition: tree.game.villainPosition,
      firstToAct: cfg.firstToAct
    },
    rootStrategy: comboStrategies,
    aggregateStrategy: aggregate,
    actionEV,
    bestAction: bestId,
    heroAction: heroActionId,
    heroEV,
    bestEV,
    evLossBB,
    exploitability: exploit,
    convergence: convStatus,
    tree: tree.summary(),
    meta: {
      durationMs: Date.now() - start,
      analysisMethod: algorithm === 'cfr_plus' ? 'cfr_plus' : 'cfr',
      exactGame: true,
      treeAbstraction: true,
      betAbstraction: true,
      chanceMode: chanceCapped ? 'capped' : 'enumerated',
      rangeAbstraction: true,
      maxChanceBranches: chanceCapped ? cfg.maxChanceBranches : null,
      linearAveraging: !!options.linearAveraging,
      adaptive,
      iterationsRun,
      minIterations: adaptive ? adaptiveCfg.minIterations : null,
      rangeDeltaTarget: adaptive ? adaptiveCfg.rangeDeltaTarget : null,
      stopReason,
      seed
    },
    _trainer: trainer,
    _tree: tree
  };
}