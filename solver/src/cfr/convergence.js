// Convergence tracking: samples the average strategy over the whole information
// set map every `sampleEvery` iterations and records the L1 strategy delta.
// Does not log every iteration.

export class ConvergenceTracker {
  constructor({ sampleEvery = 100, maxSamples = 50 } = {}) {
    this.sampleEvery = sampleEvery;
    this.maxSamples = maxSamples;
    this.history = [];
    this._prevSnapshot = null;
  }

  _snapshot(infos) {
    const out = [];
    for (const [key, store] of infos.sets.entries()) {
      for (const [combo, ssum] of Object.entries(store.strategySum || {})) {
        out.push([key, combo, ssum]);
      }
    }
    return out;
  }

  _delta(snapA, snapB) {
    const mapB = new Map();
    for (const [key, combo, ssum] of snapB) mapB.set(`${key}|${combo}`, ssum);
    let d = 0;
    for (const [key, combo, ssumA] of snapA) {
      const b = mapB.get(`${key}|${combo}`);
      if (!b) { for (const v of Object.values(ssumA)) d += Math.abs(v); continue; }
      const keys = new Set([...Object.keys(ssumA), ...Object.keys(b)]);
      for (const k of keys) d += Math.abs((ssumA[k] || 0) - (b[k] || 0));
    }
    return d;
  }

  maybeRecord(iteration, infos) {
    if (this.sampleEvery <= 0) return;
    if (iteration % this.sampleEvery !== 0) return;
    const snap = this._snapshot(infos);
    let delta = null;
    if (this._prevSnapshot) delta = this._delta(this._prevSnapshot, snap);
    this._prevSnapshot = snap;
    this.history.push({ iteration, delta });
    if (this.history.length > this.maxSamples) this.history.shift();
  }

  finalStatus() {
    const last = this.history[this.history.length - 1];
    const delta = last && last.delta != null ? last.delta : null;
    let status = 'early';
    if (delta != null) {
      if (delta < 0.001) status = 'converged';
      else if (delta < 0.02) status = 'approximate';
    }
    return { status, delta, samples: this.history.length };
  }
}