// Adaptive convergence detection for the CFR solver. Every `checkEvery`
// iterations (once past `minIterations`) we sample several independent signals
// and only declare convergence when several consecutive checkpoints are all
// stable. Convergence is never declared on a single metric.
//
// Signals tracked (at minimum):
//   - exploitability (per-player BB)
//   - aggregate/root strategy delta (normalized L1)
//   - per-action frequency delta (root action EV delta)
//   - action EV delta
//   - regret stability (mean absolute regret trajectory)
//   - range/reach stability (range equilibration delta)
import { SolverError } from '../api/errors.js';
import { computeExploitability, rootActionEV } from './exploitability.js';
import { computeReachSnapshot, rangeEquilibrationDelta, rangeEquilibrationStable } from '../analysis/rangeEquilibration.js';

export const DEFAULT_ADAPTIVE_CONFIG = {
  minIterations: 200,
  maxIterations: 10000,
  checkEvery: 100,
  exploitabilityTargetBB: 0.02,
  strategyDeltaTarget: 0.005,
  evDeltaTargetBB: 0.01,
  rangeDeltaTarget: 0.01,
  stableChecksRequired: 3
};

export function buildAdaptiveConfig(options = {}, cfg = {}) {
  const num = (v, dflt) => (v != null && Number.isFinite(Number(v)) ? Number(v) : dflt);
  const c = {
    minIterations: num(options.minIterations, DEFAULT_ADAPTIVE_CONFIG.minIterations),
    maxIterations: num(options.maxIterations, Math.min(DEFAULT_ADAPTIVE_CONFIG.maxIterations, cfg.maxIterations || DEFAULT_ADAPTIVE_CONFIG.maxIterations)),
    checkEvery: num(options.checkEvery, DEFAULT_ADAPTIVE_CONFIG.checkEvery),
    exploitabilityTargetBB: num(options.exploitabilityTargetBB, DEFAULT_ADAPTIVE_CONFIG.exploitabilityTargetBB),
    strategyDeltaTarget: num(options.strategyDeltaTarget, DEFAULT_ADAPTIVE_CONFIG.strategyDeltaTarget),
    evDeltaTargetBB: num(options.evDeltaTargetBB, DEFAULT_ADAPTIVE_CONFIG.evDeltaTargetBB),
    rangeDeltaTarget: num(options.rangeDeltaTarget, DEFAULT_ADAPTIVE_CONFIG.rangeDeltaTarget),
    stableChecksRequired: num(options.stableChecksRequired, DEFAULT_ADAPTIVE_CONFIG.stableChecksRequired)
  };

  if (!Number.isInteger(c.checkEvery) || c.checkEvery <= 0) {
    throw new SolverError('INVALID_CONFIG', 'checkEvery must be a positive integer');
  }
  if (!Number.isInteger(c.stableChecksRequired) || c.stableChecksRequired <= 0) {
    throw new SolverError('INVALID_CONFIG', 'stableChecksRequired must be a positive integer');
  }
  if (c.maxIterations < c.minIterations) {
    throw new SolverError('INVALID_CONFIG', 'maxIterations must be >= minIterations');
  }
  if (c.minIterations < 0 || c.maxIterations <= 0) {
    throw new SolverError('INVALID_CONFIG', 'iteration counts must be positive');
  }
  return c;
}

export class AdaptiveConvergence {
  constructor(config = {}) {
    this.cfg = config;
    this.history = [];
    this.stableChecks = 0;
    this._prev = null;
  }

  // One checkpoint: sample all signals, decide stability, and report whether the
  // required number of consecutive stable checks has been reached.
  checkpoint(iteration, { trainer, tree }) {
    const snap = this._snapshot(trainer, tree);
    const prev = this._prev;
    const metrics = {
      iteration,
      strategyDelta: prev ? this._strategyDelta(prev.strategy, snap.strategy) : null,
      evDeltaBB: prev ? l1Delta(prev.actionEV, snap.actionEV) : null,
      meanAbsRegret: snap.meanAbsRegret,
      regretDelta: prev ? Math.abs(snap.meanAbsRegret - prev.meanAbsRegret) : null,
      exploitabilityBB: snap.exploitabilityBB,
      range: prev ? rangeEquilibrationDelta(prev.range, snap.range) : null
    };
    metrics.stable = this._isStable(metrics);

    this.history.push(metrics);
    this._prev = snap;
    if (metrics.stable) this.stableChecks += 1;
    else this.stableChecks = 0;

    return { converged: this.stableChecks >= this.cfg.stableChecksRequired, stableChecks: this.stableChecks };
  }

  finalize({ iterationsRun, stopReason }) {
    const last = this.history[this.history.length - 1];
    const converged = stopReason === 'converged';
    let status = 'early';
    if (converged) status = 'converged';
    else if (last && last.strategyDelta != null && last.strategyDelta < 0.02) status = 'approximate';

    return {
      converged,
      iterationsRun,
      stopReason,
      status,
      delta: last ? last.strategyDelta : null,
      samples: this.history.length,
      exploitabilityBB: last ? last.exploitabilityBB : null,
      exploitabilityHistory: this.history
        .filter((h) => h.exploitabilityBB != null)
        .map((h) => ({ iteration: h.iteration, exploitabilityBB: h.exploitabilityBB })),
      strategyDelta: last ? last.strategyDelta : null,
      evDeltaBB: last ? last.evDeltaBB : null,
      regretDelta: last ? last.regretDelta : null,
      meanAbsRegret: last ? last.meanAbsRegret : null,
      stableChecks: this.stableChecks,
      lastRangeDelta: last ? last.range : null
    };
  }

  _snapshot(trainer, tree) {
    const strategy = [];
    for (const [key, store] of trainer.infos.sets.entries()) {
      for (const [combo, ssum] of Object.entries(store.strategySum || {})) {
        const ids = Object.keys(ssum);
        const total = ids.reduce((s, a) => s + (ssum[a] || 0), 0);
        if (total <= 0) continue;
        const freq = {};
        for (const a of ids) freq[a] = (ssum[a] || 0) / total;
        strategy.push({ key, combo, freq });
      }
    }
    return {
      strategy,
      actionEV: rootActionEV(tree, trainer),
      meanAbsRegret: meanAbsRegret(trainer),
      exploitabilityBB: computeExploitability(tree, trainer).exploitabilityPerPlayerBB,
      range: computeReachSnapshot(tree, trainer)
    };
  }

  _strategyDelta(prev, curr) {
    const mapB = new Map();
    for (const e of curr) mapB.set(`${e.key}|${e.combo}`, e.freq);
    let d = 0;
    let n = 0;
    for (const e of prev) {
      const fb = mapB.get(`${e.key}|${e.combo}`) || {};
      const keys = new Set([...Object.keys(e.freq), ...Object.keys(fb)]);
      let sd = 0;
      for (const k of keys) sd += Math.abs((e.freq[k] || 0) - (fb[k] || 0));
      d += sd;
      n++;
    }
    return n ? d / n : 0;
  }

  // Require several independent metrics to be stable together; never one alone.
  _isStable(metrics) {
    const c = this.cfg;
    if (metrics.strategyDelta == null || metrics.evDeltaBB == null) return false;
    if (metrics.strategyDelta > c.strategyDeltaTarget) return false;
    if (metrics.evDeltaBB > c.evDeltaTargetBB) return false;
    if (metrics.exploitabilityBB == null || metrics.exploitabilityBB > c.exploitabilityTargetBB) return false;
    if (!rangeEquilibrationStable(metrics.range, c.rangeDeltaTarget)) return false;
    return true;
  }
}

function meanAbsRegret(trainer) {
  let sum = 0;
  let n = 0;
  for (const [, store] of trainer.infos.sets.entries()) {
    for (const regs of Object.values(store.regrets || {})) {
      for (const r of Object.values(regs)) {
        sum += Math.abs(r);
        n++;
      }
    }
  }
  return n ? sum / n : 0;
}

function l1Delta(a, b) {
  const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
  let d = 0;
  for (const k of keys) d += Math.abs((a[k] || 0) - (b[k] || 0));
  return d;
}