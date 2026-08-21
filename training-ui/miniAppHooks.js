// Patches home-section mini-apps to use the shared Phase 2 personalization engine.

import { createMiniAppBridge } from './miniAppBridge.js';

export function installMiniAppHooks(store, { appWindow = null } = {}) {
  const root = appWindow || (typeof window !== 'undefined' ? window : globalThis.window);
  const bridge = createMiniAppBridge(store);
  const state = { xrayIndex: null };

  function legacyPools() {
    return {
      sizing: typeof root.SIZING !== 'undefined' ? root.SIZING : [],
      reviews: typeof root.REVIEWS !== 'undefined' ? root.REVIEWS : [],
      swipe: typeof root.SWIPE !== 'undefined' ? root.SWIPE : [],
      xray: typeof root.XR !== 'undefined' ? root.XR : []
    };
  }

  function assignGlobal(name, value) {
    const desc = Object.getOwnPropertyDescriptor(root, name);
    if (desc && typeof desc.set === 'function') {
      root[name] = value;
      return true;
    }
    root[name] = value;
    return true;
  }

  function indexOfItem(pool, item) {
    if (!item || !pool || !pool.length) return -1;
    const byId = pool.findIndex((x) => x && x.id === item.id);
    return byId >= 0 ? byId : 0;
  }

  function wrap(name, fn) {
    if (typeof root[name] !== 'function') return;
    const orig = root[name];
    assignGlobal(name, (...args) => fn(orig, ...args));
  }

  wrap('recordEvent', (orig, event) => {
    const ev = orig(event);
    try {
      bridge.recordFromLegacyEvent(ev, legacyPools());
    } catch (e) { /* never interrupt legacy UI */ }
    return ev;
  });

  wrap('newSwipeSession', (orig) => {
    if (bridge.hasProfile()) {
      const legacy = legacyPools();
      const session = bridge.prepareSwipeSession(10, legacy.swipe);
      if (session && session.items.length) {
        assignGlobal('swSession', session.items);
        assignGlobal('swIndex', 0);
        assignGlobal('swSessionGrades', []);
        return;
      }
    }
    return orig();
  });

  wrap('renderSizing', (orig) => {
    if (bridge.hasProfile()) {
      const idx = pickSizingIndex();
      if (idx != null) assignGlobal('sz', idx);
    }
    return orig();
  });

  wrap('renderReview', (orig) => {
    if (bridge.hasProfile()) {
      const idx = pickReviewIndex();
      if (idx != null) assignGlobal('rv', idx);
    }
    return orig();
  });

  wrap('reviewReveal', (orig) => orig());

  wrap('reviewRepair', (orig, pointOk, reasonOk) => orig(pointOk, reasonOk));

  wrap('renderXray', (orig) => {
    let savedRuns = null;
    if (bridge.hasProfile()) {
      state.xrayIndex = pickXrayIndex();
      if (state.xrayIndex != null) {
        savedRuns = root.S.xray.runs;
        root.S.xray.runs = state.xrayIndex;
      }
    } else {
      state.xrayIndex = null;
    }
    try {
      return orig();
    } finally {
      if (savedRuns != null) root.S.xray.runs = savedRuns;
    }
  });

  wrap('xrBegin', (orig, st) => {
    const picked = bridge.hasProfile()
      ? (state.xrayIndex != null ? state.xrayIndex : pickXrayIndex())
      : null;
    const result = orig(st);
    if (picked != null && root.XR && root.XR[picked]) {
      assignGlobal('xrI', picked);
      state.xrayIndex = picked;
      const ref = root.XR[picked].ref[st === 0 ? 0 : st - 1];
      assignGlobal('xrCurrent', new Set(ref));
      assignGlobal('xrCandidate', new Set(root.xrCurrent));
    }
    return result;
  });

  wrap('xrReport', (orig) => {
    const idx = typeof root.xrI === 'number' ? root.xrI : state.xrayIndex;
    const prevRecord = root.recordEvent;
    assignGlobal('recordEvent', (e) => prevRecord({ ...e, spotId: e.spotId || (idx != null ? `XR_${idx}` : null) }));
    try {
      return orig();
    } finally {
      assignGlobal('recordEvent', prevRecord);
    }
  });

  wrap('quickAdvance', (orig) => {
    const quick = root.quick;
    quick.index++;
    if (quick.index >= quick.flow.length) {
      quick.index--;
      return orig();
    }

    const next = quick.flow[quick.index];
    if (next === 'memory') {
      if (bridge.hasProfile()) {
        const item = bridge.prepareMemorySpot(legacyPools().swipe);
        if (item) {
          assignGlobal('memorySpotId', item.id);
          assignGlobal('swSession', [item]);
          assignGlobal('swIndex', 0);
          assignGlobal('swSessionGrades', []);
          root.show('swipe');
          return;
        }
      }
      quick.index--;
      return orig();
    }

    if (next === 'review') {
      if (bridge.hasProfile()) {
        const idx = pickReviewIndex();
        if (idx != null) assignGlobal('rv', idx);
      } else {
        assignGlobal('rv', (root.rv + 1) % root.REVIEWS.length);
      }
      root.show('review');
      return;
    }

    if (next === 'xray') {
      if (bridge.hasProfile()) state.xrayIndex = pickXrayIndex();
      root.show('xray');
      setTimeout(() => root.xrBegin(2), 0);
      return;
    }

    root.show(next);
  });

  function pickSizingIndex() {
    const legacy = legacyPools();
    const item = bridge.prepareSizingSpot(legacy.sizing);
    return item ? indexOfItem(legacy.sizing, item) : null;
  }

  function pickReviewIndex() {
    const legacy = legacyPools();
    const item = bridge.prepareReviewSpot(legacy.reviews);
    return item ? indexOfItem(legacy.reviews, item) : null;
  }

  function pickXrayIndex() {
    const legacy = legacyPools();
    const idx = bridge.prepareXrayIndex(legacy.xray);
    return idx != null ? idx : null;
  }

  return { bridge, state };
}
