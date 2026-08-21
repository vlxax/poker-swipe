// Patches home-section mini-apps to use the shared Phase 2 personalization engine.

import { createMiniAppBridge } from './miniAppBridge.js';

function legacyPools() {
  return {
    sizing: typeof window.SIZING !== 'undefined' ? window.SIZING : [],
    reviews: typeof window.REVIEWS !== 'undefined' ? window.REVIEWS : [],
    swipe: typeof window.SWIPE !== 'undefined' ? window.SWIPE : [],
    xray: typeof window.XR !== 'undefined' ? window.XR : []
  };
}

function indexOfItem(pool, item) {
  if (!item || !pool || !pool.length) return -1;
  const byId = pool.findIndex((x) => x && x.id === item.id);
  return byId >= 0 ? byId : 0;
}

export function installMiniAppHooks(store) {
  const bridge = createMiniAppBridge(store);
  const state = { xrayIndex: null };

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

  function wrap(name, fn) {
    if (typeof window[name] !== 'function') return;
    const orig = window[name];
    window[name] = function (...args) {
      return fn(orig, ...args);
    };
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
        window.swSession = session.items;
        window.swIndex = 0;
        window.swSessionGrades = [];
        return;
      }
    }
    return orig();
  });

  wrap('renderSizing', (orig) => {
    if (bridge.hasProfile()) {
      const idx = pickSizingIndex();
      if (idx != null) window.sz = idx;
    }
    return orig();
  });

  wrap('renderReview', (orig) => {
    if (bridge.hasProfile()) {
      const idx = pickReviewIndex();
      if (idx != null) window.rv = idx;
    }
    return orig();
  });

  wrap('reviewReveal', (orig) => {
    if (bridge.hasProfile()) {
      const idx = pickReviewIndex();
      if (idx != null) window.rv = idx;
    }
    return orig();
  });

  wrap('reviewRepair', (orig, pointOk, reasonOk) => {
    if (bridge.hasProfile()) {
      const idx = pickReviewIndex();
      if (idx != null) window.rv = idx;
    }
    return orig(pointOk, reasonOk);
  });

  wrap('renderXray', (orig) => {
    state.xrayIndex = bridge.hasProfile() ? pickXrayIndex() : null;
    return orig();
  });

  wrap('xrBegin', (orig, st) => {
    if (bridge.hasProfile()) {
      if (state.xrayIndex == null) state.xrayIndex = pickXrayIndex();
      if (state.xrayIndex != null) window.xrI = state.xrayIndex;
    }
    return orig(st);
  });

  wrap('xrReport', (orig) => {
    const idx = typeof window.xrI === 'number' ? window.xrI : state.xrayIndex;
    const prevRecord = window.recordEvent;
    window.recordEvent = function (e) {
      return prevRecord({ ...e, spotId: e.spotId || (idx != null ? `XR_${idx}` : null) });
    };
    try {
      return orig();
    } finally {
      window.recordEvent = prevRecord;
    }
  });

  wrap('quickAdvance', (orig) => {
    const quick = window.quick;
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
          window.memorySpotId = item.id;
          window.swSession = [item];
          window.swIndex = 0;
          window.swSessionGrades = [];
          window.show('swipe');
          return;
        }
      }
      quick.index--;
      return orig();
    }

    if (next === 'review') {
      if (bridge.hasProfile()) {
        const idx = pickReviewIndex();
        if (idx != null) window.rv = idx;
      } else {
        window.rv = (window.rv + 1) % window.REVIEWS.length;
      }
      window.show('review');
      return;
    }

    if (next === 'xray') {
      if (bridge.hasProfile()) state.xrayIndex = pickXrayIndex();
      window.show('xray');
      setTimeout(() => window.xrBegin(2), 0);
      return;
    }

    window.show(next);
  });

  return { bridge, state };
}
