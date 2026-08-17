import { buildGameTree } from '../tree/treeBuilder.js';
import { SolverError } from '../api/errors.js';
import { CFRTrainer, comboKey } from './cfrTrainer.js';
import { ConvergenceTracker } from './convergence.js';
import { computeExploitability, rootActionEV } from './exploitability.js';
import { aggregateStrategy, normalizeReach } from '../ranges/rangePropagation.js';
import { averageStrategy } from './strategyAccumulator.js';

const ALGORITHMS = ['cfr', 'cfr_plus'];

export function solveCFR(input = {}, options = {}) {
  const start = Date.now();
  const tree = buildGameTree(input);
  const cfg = tree.cfg;

  const algorithm = String(options.algorithm || 'cfr').toLowerCase();
  if (!ALGORITHMS.includes(algorithm)) {
    throw new SolverError('INVALID_CONFIG', `algorithm must be one of: ${ALGORITHMS.join(', ')}`);
  }

  let iterations = Number(options.iterations || 1000);
  if (!Number.isFinite(iterations) || iterations <= 0) iterations = 1000;
  iterations = Math.min(iterations, cfg.maxIterations);

  const seed = options.seed != null ? Number(options.seed) : 12345;
  // Determinism is guaranteed by the enumerative traversal (no sampling);
  // seed is accepted for API compatibility and future MCCFR sampling.

  const trainer = new CFRTrainer(tree, {
    algorithm,
    linearAveraging: !!options.linearAveraging
  });

  const convergence = new ConvergenceTracker({
    sampleEvery: options.sampleEvery || Math.max(1, Math.floor(iterations / 20))
  });

  for (let t = 1; t <= iterations; t++) {
    trainer.iterate();
    convergence.maybeRecord(t, trainer.infos);
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
  const convStatus = convergence.finalStatus();

  // bestAction + heroAction based on action EV.
  const ids = Object.keys(actionEV);
  let bestId = ids.length ? ids[0] : null;
  for (const id of ids) if (actionEV[id] > actionEV[bestId]) bestId = id;
  const heroActionId = input.heroAction ? String(input.heroAction.type === 'bet' ? `bet_${Math.round((input.heroAction.sizePot || 0) * 100)}` : input.heroAction.type) : null;
  const heroEV = heroActionId != null ? actionEV[heroActionId] : null;
  const bestEV = bestId != null ? actionEV[bestId] : null;
  const evLossBB = heroEV != null && bestEV != null ? bestEV - heroEV : null;

  return {
    algorithm,
    iterations,
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
      chanceMode: 'enumerated',
      rangeAbstraction: true,
      linearAveraging: !!options.linearAveraging,
      seed
    },
    _trainer: trainer,
    _tree: tree
  };
}