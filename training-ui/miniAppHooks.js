// Patches home-section mini-apps to use the shared Phase 2 personalization engine.

import { createMiniAppBridge } from './miniAppBridge.js';

export function installMiniAppHooks(store, { appWindow = null } = {}) {
  const root = appWindow || (typeof window !== 'undefined' ? window : globalThis.window);
  const bridge = createMiniAppBridge(store);
  const state = {
    xraySpot: null, reviewSpot: null, sizingSpot: null,
    xrayPinned: null, reviewPinned: null, sizingPinned: null
  };

  function legacyPools() {
    return {
      sizing: typeof root.SIZING !== 'undefined' ? root.SIZING : [],
      reviews: typeof root.REVIEWS !== 'undefined' ? root.REVIEWS : [],
      swipe: typeof root.SWIPE !== 'undefined' ? root.SWIPE : [],
      xray: typeof root.XR !== 'undefined' ? root.XR : []
    };
  }

  function assignGlobal(name, value) {
    root[name] = value;
    return true;
  }

  function wrap(name, fn) {
    if (typeof root[name] !== 'function') return;
    const orig = root[name];
    assignGlobal(name, (...args) => fn(orig, ...args));
  }

  /** Legacy SIZING/REVIEWS/XR are read-only getters — mutate slot instead of replacing array. */
  function resolveInjectIndex(arr, spot) {
    if (!arr || !arr.length) return 0;
    const byId = arr.findIndex((x) => x && spot?.id && x.id === spot.id);
    return byId >= 0 ? byId : 0;
  }

  function withInjectedSpot(arrayName, indexName, spot, renderFn, { index = null } = {}) {
    const arr = root[arrayName];
    if (!arr || !arr.length || !spot) return renderFn();
    const idx = index != null ? index % arr.length : resolveInjectIndex(arr, spot);
    const savedSpot = arr[idx];
    const savedIndex = root[indexName];
    arr[idx] = spot;
    assignGlobal(indexName, idx);
    try {
      return renderFn();
    } finally {
      arr[idx] = savedSpot;
      if (savedIndex != null) assignGlobal(indexName, savedIndex);
    }
  }

  function xrayInjectIndex() {
    const arr = root.XR;
    const runs = root.S?.xray?.runs || 0;
    return arr && arr.length ? runs % arr.length : 0;
  }

  function pinXraySpot(spot) {
    const arr = root.XR;
    if (!arr || !arr.length || !spot) return;
    const idx = xrayInjectIndex();
    if (state.xrayPinned == null) {
      state.xrayPinned = { index: idx, saved: arr[idx] };
    }
    arr[idx] = spot;
    assignGlobal('xrI', idx);
  }

  function unpinXraySpot() {
    if (state.xrayPinned == null) return;
    const { index, saved } = state.xrayPinned;
    if (root.XR && index != null) root.XR[index] = saved;
    state.xrayPinned = null;
  }

  function pinReviewSpot(spot) {
    const arr = root.REVIEWS;
    if (!arr || !arr.length || !spot) return;
    unpinReviewSpot();
    const idx = resolveInjectIndex(arr, spot);
    state.reviewPinned = { index: idx, saved: arr[idx] };
    arr[idx] = spot;
    assignGlobal('rv', idx);
  }

  function unpinReviewSpot() {
    if (state.reviewPinned == null) return;
    const { index, saved } = state.reviewPinned;
    if (root.REVIEWS && index != null) root.REVIEWS[index] = saved;
    state.reviewPinned = null;
  }

  function pinSizingSpot(spot) {
    const arr = root.SIZING;
    if (!arr || !arr.length || !spot) return;
    unpinSizingSpot();
    const idx = resolveInjectIndex(arr, spot);
    state.sizingPinned = { index: idx, saved: arr[idx] };
    arr[idx] = spot;
    assignGlobal('sz', idx);
  }

  function unpinSizingSpot() {
    if (state.sizingPinned == null) return;
    const { index, saved } = state.sizingPinned;
    if (root.SIZING && index != null) root.SIZING[index] = saved;
    state.sizingPinned = null;
  }

  wrap('recordEvent', (orig, event) => {
    const ev = orig(event);
    try {
      bridge.recordFromLegacyEvent(ev, legacyPools());
    } catch (e) { /* never interrupt legacy UI */ }
    return ev;
  });

  wrap('newSwipeSession', (orig) => {
    const legacy = legacyPools();
    const session = bridge.prepareSwipeSession(10, legacy.swipe);
    if (session && session.items.length) {
      assignGlobal('swSession', session.items);
      assignGlobal('swIndex', 0);
      assignGlobal('swSessionGrades', []);
      return;
    }
    return orig();
  });

  wrap('renderSizing', (orig) => {
    const spot = bridge.prepareSizingSpot(legacyPools().sizing);
    if (spot && spot._library) {
      state.sizingSpot = spot;
      pinSizingSpot(spot);
      return orig();
    }
    unpinSizingSpot();
    state.sizingSpot = null;
    return orig();
  });

  wrap('renderReview', (orig) => {
    const spot = bridge.prepareReviewSpot(legacyPools().reviews);
    if (spot && spot._library) {
      state.reviewSpot = spot;
      pinReviewSpot(spot);
      return orig();
    }
    unpinReviewSpot();
    state.reviewSpot = null;
    return orig();
  });

  wrap('reviewReveal', (orig) => {
    if (state.reviewSpot?._library) pinReviewSpot(state.reviewSpot);
    return orig();
  });

  wrap('reviewRepair', (orig, pointOk, reasonOk) => {
    if (state.reviewSpot?._library) pinReviewSpot(state.reviewSpot);
    return orig(pointOk, reasonOk);
  });

  wrap('renderXray', (orig) => {
    if (!root.S?.xray?.onboarded) return orig();
    if (bridge.hasProfile()) {
      const spot = bridge.prepareXraySpot(legacyPools().xray);
      if (spot && spot._library) {
        state.xraySpot = spot;
        return withInjectedSpot('XR', 'xrI', spot, orig, { index: xrayInjectIndex() });
      }
    }
    state.xraySpot = null;
    return orig();
  });

  wrap('xrBegin', (orig, st) => {
    if (bridge.hasProfile()) {
      if (!state.xraySpot?._library) {
        const spot = bridge.prepareXraySpot(legacyPools().xray);
        if (spot?._library) state.xraySpot = spot;
      }
      if (state.xraySpot?._library) {
        pinXraySpot(state.xraySpot);
        return orig(st);
      }
    }
    return orig(st);
  });

  wrap('xrReveal', (orig, score) => {
    if (state.xraySpot?._library) pinXraySpot(state.xraySpot);
    try {
      return orig(score);
    } finally {
      if (state.xraySpot?._library) pinXraySpot(state.xraySpot);
    }
  });

  wrap('xrRiver', (orig) => {
    if (state.xraySpot?._library) pinXraySpot(state.xraySpot);
    try {
      return orig();
    } finally {
      if (state.xraySpot?._library) pinXraySpot(state.xraySpot);
    }
  });

  wrap('xrBlocker', (orig) => {
    if (state.xraySpot?._library) pinXraySpot(state.xraySpot);
    try {
      return orig();
    } finally {
      if (state.xraySpot?._library) pinXraySpot(state.xraySpot);
    }
  });

  wrap('xrReport', (orig) => {
    const spotId = state.xraySpot?.id
      || (typeof root.xrI === 'number' ? `XR_${root.xrI}` : null);
    const prevRecord = root.recordEvent;
    assignGlobal('recordEvent', (e) => prevRecord({
      ...e,
      spotId: e.spotId || spotId
    }));
    if (state.xraySpot?._library) pinXraySpot(state.xraySpot);
    try {
      return orig();
    } finally {
      assignGlobal('recordEvent', prevRecord);
      unpinXraySpot();
      state.xraySpot = null;
    }
  });

  wrap('renderXrayStage', (orig) => {
    if (state.xraySpot?._library) pinXraySpot(state.xraySpot);
    try {
      return orig();
    } finally {
      if (state.xraySpot?._library) pinXraySpot(state.xraySpot);
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
      root.show('review');
      return;
    }

    if (next === 'xray') {
      state.xraySpot = null;
      root.show('xray');
      setTimeout(() => root.xrBegin(2), 0);
      return;
    }

    root.show(next);
  });

  return { bridge, state };
}
