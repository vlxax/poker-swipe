// Home "Твоя игра" recommendation — maps weakness concepts to real runnable training.
// Never routes to legacy Heal hub; unsupported concepts are filtered from Home CTA.

const BACKING = {
  TRAINER_EXACT: 'TRAINER_EXACT',
  STATIC_CURATED: 'STATIC_CURATED',
  PROCEDURAL: 'PROCEDURAL',
  EXISTING_MINIAPP: 'EXISTING_MINIAPP',
  UNSUPPORTED: 'UNSUPPORTED'
};

function normConcept(c) {
  return String(c || '').toLowerCase().trim();
}

function appWin() {
  return typeof globalThis !== 'undefined' ? globalThis : undefined;
}

function swipePool(concept) {
  const w = appWin();
  const pool = (w && Array.isArray(w.SWIPE))
    ? w.SWIPE.filter((x) => normConcept(x.concept) === normConcept(concept))
    : [];
  return pool;
}

function conceptMatches(concept, pattern) {
  return pattern.test(normConcept(concept));
}

export function classifyConceptBacking(concept) {
  const c = normConcept(concept);
  if (!c) return { backing: BACKING.UNSUPPORTED, reason: 'empty' };

  if (conceptMatches(concept, /sizing|size|overbet|barrel_size|turn sizing|big value|polar turn/)) {
    const w = appWin();
    if (w?.document?.getElementById?.('sizing') || (w && !w.document)) {
      return { backing: BACKING.EXISTING_MINIAPP, target: 'sizing', concept };
    }
    return { backing: BACKING.UNSUPPORTED, reason: 'sizing_screen_missing' };
  }

  if (conceptMatches(concept, /bb defence|bb_defence|price defence|small bet defence|defence/)) {
    const pool = swipePool(concept);
    if (pool.length) return { backing: BACKING.STATIC_CURATED, target: 'swipe', concept };
    const w = appWin();
    const broad = (w?.SWIPE || []).filter((x) => /bb defence|defence/i.test(x.concept || ''));
    if (broad.length) return { backing: BACKING.STATIC_CURATED, target: 'swipe', concept: broad[0].concept };
    return { backing: BACKING.UNSUPPORTED, reason: 'no_bb_defence_pool' };
  }

  if (conceptMatches(concept, /thin value|river value/)) {
    const pool = swipePool(concept);
    if (pool.length) return { backing: BACKING.STATIC_CURATED, target: 'swipe', concept };
    const w = appWin();
    const broad = (w?.SWIPE || []).filter((x) => /thin value|river value/i.test(x.concept || ''));
    if (broad.length) return { backing: BACKING.STATIC_CURATED, target: 'swipe', concept: broad[0].concept };
    return { backing: BACKING.UNSUPPORTED, reason: 'no_thin_value_pool' };
  }

  if (conceptMatches(concept, /river bluffcatch|bluffcatch|bluff-catch/)) {
    const pool = swipePool(concept);
    if (pool.length) return { backing: BACKING.STATIC_CURATED, target: 'swipe', concept };
    const w = appWin();
    const broad = (w?.SWIPE || []).filter((x) => /bluffcatch|bluff-catch/i.test(x.concept || ''));
    if (broad.length) return { backing: BACKING.STATIC_CURATED, target: 'swipe', concept: broad[0].concept };
    return { backing: BACKING.UNSUPPORTED, reason: 'no_bluffcatch_pool' };
  }

  if (conceptMatches(concept, /rfi|preflop\.rfi|open range|range narrowing/)) {
    const pool = swipePool(concept);
    if (pool.length) return { backing: BACKING.STATIC_CURATED, target: 'swipe', concept };
    if (appWin()?.newSwipeSession) {
      return { backing: BACKING.TRAINER_EXACT, target: 'swipe_trainer', concept };
    }
    return { backing: BACKING.UNSUPPORTED, reason: 'no_preflop_training' };
  }

  const pool = swipePool(concept);
  if (pool.length) return { backing: BACKING.STATIC_CURATED, target: 'swipe', concept };

  if (appWin()?.newSwipeSession) {
    return { backing: BACKING.TRAINER_EXACT, target: 'swipe_trainer', concept };
  }

  return { backing: BACKING.UNSUPPORTED, reason: 'no_matching_training' };
}

export function isLaunchableConcept(concept) {
  return classifyConceptBacking(concept).backing !== BACKING.UNSUPPORTED;
}

function leakStatsFromEvents(events = []) {
  const m = {};
  for (const e of events) {
    if (!e?.concept || e.mode === 'diagnostic') continue;
    if (!m[e.concept]) m[e.concept] = { concept: e.concept, n: 0, g: 0, y: 0, r: 0 };
    const x = m[e.concept];
    x.n++;
    x[e.grade] = (x[e.grade] || 0) + 1;
  }
  return Object.values(m)
    .map((x) => ({ ...x, score: Math.round(((x.g || 0) + (x.y || 0) * 0.55) / Math.max(1, x.n) * 100) }))
    .sort((a, b) => a.score - b.score);
}

export function getActionableTopLeak() {
  const w = appWin();
  const events = w?.S?.events;
  if (!Array.isArray(events)) {
    const topFn = w && typeof w.topLeak === 'function' ? w.topLeak : null;
    const leak = topFn ? topFn() : null;
    return leak && isLaunchableConcept(leak.concept) ? leak : null;
  }
  const stats = leakStatsFromEvents(events).filter((x) => x.n >= 3);
  for (const leak of stats) {
    if (isLaunchableConcept(leak.concept)) return leak;
  }
  return null;
}

export function resolveHomeRecommendation(leak) {
  if (!leak?.concept) {
    return { launchable: false, backing: BACKING.UNSUPPORTED, displayConcept: null };
  }
  const route = classifyConceptBacking(leak.concept);
  const w = appWin();
  const labelFn = w && typeof w.conceptLabel === 'function' ? w.conceptLabel : (id) => id;
  return {
    launchable: route.backing !== BACKING.UNSUPPORTED,
    backing: route.backing,
    target: route.target,
    concept: leak.concept,
    displayConcept: labelFn(leak.concept),
    route
  };
}

export function launchHomeRecommendation(leak) {
  const w = appWin();
  const rec = resolveHomeRecommendation(leak);
  if (!rec.launchable) {
    try { if (w) w.swSession = []; } catch (e) { /* ignore */ }
    w?.show?.('swipe');
    w?.newSwipeSession?.();
    return { launched: 'swipe_fallback', rec };
  }

  const { target, concept } = rec.route;
  if (target === 'sizing') {
    w?.show?.('sizing');
    return { launched: 'sizing', rec };
  }
  if (target === 'swipe' && typeof w?.startConceptSwipe === 'function') {
    w.startConceptSwipe(concept);
    return { launched: 'swipe_concept', rec };
  }
  if (target === 'swipe_trainer') {
    try { if (w) w.swSession = []; } catch (e) { /* ignore */ }
    w?.newSwipeSession?.();
    w?.show?.('swipe');
    return { launched: 'swipe_trainer', rec };
  }
  try { if (w) w.swSession = []; } catch (e) { /* ignore */ }
  w?.show?.('swipe');
  return { launched: 'swipe_fallback', rec };
}

export function installHomeRecommendation(appWindow) {
  const target = appWindow || appWin();
  if (!target) return;
  target.HomeRecommendation = {
    BACKING,
    classifyConceptBacking,
    isLaunchableConcept,
    getActionableTopLeak,
    resolveHomeRecommendation,
    launchHomeRecommendation
  };
}

export { BACKING };
