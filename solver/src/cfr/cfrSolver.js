import { buildGameTree } from '../tree/treeBuilder.js';
import { SolverError } from '../api/errors.js';
import { CFRTrainer, comboKey } from './cfrTrainer.js';
import { ConvergenceTracker } from './convergence.js';
import { AdaptiveConvergence, buildAdaptiveConfig, DEFAULT_ADAPTIVE_CONFIG } from './adaptiveConvergence.js';
import { computeExploitability, rootActionEV } from './exploitability.js';
import { aggregateStrategy, normalizeReach } from '../ranges/rangePropagation.js';
import { averageStrategy } from './strategyAccumulator.js';
import { buildBetSizingModel } from '../abstraction/betSizingModel.js';

const ALGORITHMS = ['cfr', 'cfr_plus'];

// Map the caller's heroAction into the tree's action-id space. Postflop, a bet
// maps to bet_<sizePot*100>; everything else uses its type. Preflop, an open
// raise maps to open_<raiseToBB> (root actions are absolute raise-to amounts).
function heroActionIdFor(action, preflop) {
  if (!action) return null;
  if (preflop) {
    if (action.type === 'raise' || action.type === 'bet') {
      const bb = action.amountBB ?? action.sizeBB;
      if (Number.isFinite(Number(bb))) return `open_${Math.round(Number(bb) * 10) / 10}`;
    }
    return String(action.type);
  }
  return String(action.type === 'bet' ? `bet_${Math.round((action.sizePot || 0) * 100)}` : action.type);
}

// Bet-sizing abstraction reported for a solved tree. Postflop uses fraction-of-pot
// sizes (with geometric sizing when applicable); preflop uses absolute raise-to BB.
function computeBetSizingAbstraction(tree, cfg, options) {
  const street = tree.game.street;
  if (street === 'preflop') {
    const requestedSizes = (cfg.betSizes && cfg.betSizes.preflop) || [];
    return {
      model: 'absolute_raise_to_bb',
      requestedSizes,
      usedSizes: requestedSizes,
      prunedSizes: [],
      geometricSizeUsed: null
    };
  }
  const maxPerNode = options.maxBetSizesPerNode != null ? options.maxBetSizesPerNode : 4;
  const tolerance = options.sizeMergeTolerance != null ? options.sizeMergeTolerance : 0.05;
  const sizes = (cfg.betSizes && cfg.betSizes[street]) || [];
  return buildBetSizingModel({
    street,
    pot: tree.game.potBB,
    stack: tree.game.effectiveStackBB,
    requestedBetSizes: sizes,
    maxBetSizesPerNode: maxPerNode,
    sizeMergeTolerance: tolerance
  });
}

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
  const preflop = tree.game.street === 'preflop';
  const ids = Object.keys(actionEV);
  let bestId = ids.length ? ids[0] : null;
  for (const id of ids) if (actionEV[id] > actionEV[bestId]) bestId = id;
  const heroActionId = heroActionIdFor(input.heroAction, preflop);
  const heroEV = heroActionId != null ? actionEV[heroActionId] : null;
  const bestEV = bestId != null ? actionEV[bestId] : null;
  const evLossBB = heroEV != null && bestEV != null ? bestEV - heroEV : null;

  const chanceCapped = Number.isFinite(cfg.maxChanceBranches) && cfg.maxChanceBranches < Infinity;
  const betSizingAbstraction = computeBetSizingAbstraction(tree, cfg, options);

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
      firstToAct: cfg.firstToAct,
      ...(preflop ? { blinds: tree.game.blinds } : {})
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
    betSizingAbstraction,
    meta: {
      durationMs: Date.now() - start,
      analysisMethod: algorithm === 'cfr_plus' ? 'cfr_plus' : 'cfr',
      exactGame: true,
      treeAbstraction: true,
      betAbstraction: true,
      chanceMode: chanceCapped ? 'capped' : 'enumerated',
      rangeAbstraction: 'combo',
      maxChanceBranches: chanceCapped ? cfg.maxChanceBranches : null,
      linearAveraging: !!options.linearAveraging,
      adaptive,
      iterationsRun,
      minIterations: adaptive ? adaptiveCfg.minIterations : null,
      rangeDeltaTarget: adaptive ? adaptiveCfg.rangeDeltaTarget : null,
      stopReason,
      seed,
      preflopAbstraction: preflop,
      flopTransitionMode: preflop ? (chanceCapped ? 'capped_chance' : 'chance') : null
    },
    _trainer: trainer,
    _tree: tree
  };
}

// Convenience wrapper for preflop solves. Validates the spot and delegates to the
// shared CFR engine (which builds and solves the preflop tree). Returns the same
// shape as solveCFR plus preflop-specific meta.
export function solvePreflop(input = {}, options = {}) {
  const street = String(input.street || 'preflop').toLowerCase();
  if (street !== 'preflop') {
    throw new SolverError('INVALID_CONFIG', `solvePreflop requires street: 'preflop', got: ${input.street}`);
  }
  return solveCFR({ ...input, street: 'preflop' }, options);
}