// Shared personalization bridge for all home-section mini-apps.

import {
  getMttTaskPool, hasUsablePlayerProfile, recordTrainingResult,
  updateSkillProfileInStore, deriveSkillTags, drillFromLibraryTask,
  libraryTaskToBrainSpot
} from '../solver/src/index.js';
import { getTaskById } from '../solver/src/training/taskLibraryBridge.js';
import { buildMiniAppPlan, MINI_APP_SPECS } from '../solver/src/training/miniAppPlanner.js';
import { contentFingerprint } from '../solver/src/training/sessionDiversity.js';
import {
  buildLegacyPool, legacySizingToSpot, legacyReviewToSpot, legacySwipeToSpot, legacyXrayToSpot
} from './legacyPoolAdapter.js';
import {
  libraryTaskToMiniAppSpot, libraryTaskToSizingSpot,
  libraryTaskToReviewSpot, libraryTaskToXraySpot, isMttTask, taskEligibleForMiniApp
} from './miniAppSpotAdapter.js';

const GRADE_MAP = { g: 'EXCELLENT', y: 'GOOD', r: 'MISTAKE' };
const EV_MAP = { g: 0, y: 0.08, r: 0.65 };

export function letterGradeToTraining(letter) {
  return GRADE_MAP[letter] || 'GOOD';
}

export function letterGradeToEvLoss(letter) {
  return EV_MAP[letter] != null ? EV_MAP[letter] : 0.35;
}

function libraryTaskToSwipe(task) {
  const spot = libraryTaskToBrainSpot(task);
  if (!spot) return null;
  return spot;
}

function spotToModeItem(spot, appId) {
  if (spot._legacy) return spot._legacy.item;
  const task = getTaskById(spot.id);
  if (task && isMttTask(task)) {
    const converted = libraryTaskToMiniAppSpot(task, appId);
    if (converted) return converted;
    if (appId === 'swipe' || appId === 'memory') return libraryTaskToSwipe(task);
  }
  if (appId === 'swipe' || appId === 'memory') {
    const task = getTaskById(spot.id);
    if (task) return libraryTaskToSwipe(task);
  }
  return null;
}

export function createMiniAppBridge(store) {
  const recentIds = new Set();

  function hasProfile() {
    return hasUsablePlayerProfile(store);
  }

  function combinedPool(legacy = {}, appId = 'swipe') {
    const lib = getMttTaskPool();
    if (hasProfile()) return lib;
    const leg = buildLegacyPool(legacy);
    const byId = new Map();
    for (const s of [...lib, ...leg]) {
      if (s && s.id) byId.set(s.id, s);
    }
    return [...byId.values()];
  }

  function eligiblePool(legacy = {}, appId = 'swipe') {
    return combinedPool(legacy, appId).filter((spot) => {
      if (recentIds.has(spot.id)) return false;
      if (spot?._legacy) return spot._legacy.type === appId || appId === 'swipe' || appId === 'quick5';
      const task = getTaskById(spot.id);
      if (!task) return false;
      return taskEligibleForMiniApp(task, appId);
    });
  }

  function selectIds(plan) {
    return (plan && plan.spotIds) || (plan && plan.spots && plan.spots.map((s) => s.id)) || [];
  }

  function prepareSession(appId, { legacy = {}, count = null, history = null, now = Date.now() } = {}) {
    if (!hasProfile()) return null;
    const pool = eligiblePool(legacy, appId);
    if (!pool.length) return null;
    const plan = buildMiniAppPlan(store, appId, { pool, history: history || store.loadHistory(), count, now });
    if (!plan || !plan.filled) return null;
    const items = selectIds(plan)
      .map((id) => {
        const spot = pool.find((p) => p.id === id);
        if (spot) return spotToModeItem(spot, appId);
        const task = getTaskById(id);
        if (task && isMttTask(task)) {
          return libraryTaskToMiniAppSpot(task, appId) || libraryTaskToSwipe(task);
        }
        return null;
      })
      .filter(Boolean);
    if (!items.length) return null;
    for (const item of items) {
      if (item?.id) recentIds.add(item.id);
    }
    return { plan, items, spotIds: selectIds(plan) };
  }

  function prepareSwipeSession(count = 10, legacySwipe = []) {
    return prepareSession('swipe', { legacy: { swipe: legacySwipe }, count });
  }

  function prepareSizingSpot(legacySizing = []) {
    const session = prepareSession('sizing', { legacy: { sizing: legacySizing }, count: 1 });
    return session && session.items[0] ? session.items[0] : null;
  }

  function prepareReviewSpot(legacyReviews = []) {
    const session = prepareSession('review', { legacy: { reviews: legacyReviews }, count: 1 });
    return session && session.items[0] ? session.items[0] : null;
  }

  function prepareXraySpot(legacyXray = []) {
    const session = prepareSession('xray', { legacy: { xray: legacyXray }, count: 1 });
    return session && session.items[0] ? session.items[0] : null;
  }

  /** @deprecated use prepareXraySpot — returns library spot, not legacy index */
  function prepareXrayIndex(legacyXray = []) {
    const spot = prepareXraySpot(legacyXray);
    if (!spot) return null;
    if (spot._legacy && spot._legacy.index != null) return spot._legacy.index;
    return spot;
  }

  function prepareQuick5(legacy = {}) {
    return prepareSession('quick5', { legacy, count: MINI_APP_SPECS.quick5.count });
  }

  function prepareMemorySpot(legacySwipe = []) {
    const session = prepareSession('memory', { legacy: { swipe: legacySwipe }, count: 1 });
    return session && session.items[0] ? session.items[0] : null;
  }

  function makeDrillFromLegacy(item, mode) {
    if (item && item._drill) return item._drill;
    const task = getTaskById(item.id);
    if (task) {
      const gen = drillFromLibraryTask(task);
      if (gen.ok) return gen.drill;
    }
    return {
      drillId: `legacy|${mode}|${item.id}`,
      sourceTaskId: item.id,
      concept: item.concept || mode,
      street: String(item.street || '').toLowerCase(),
      metadata: { taskId: item.id, legacyMode: mode, legacyItem: item }
    };
  }

  function skillTagsForLegacy(item, mode) {
    const task = getTaskById(item.id);
    if (task) return deriveSkillTags(task);
    return deriveSkillTags({
      concept: item.concept,
      street: item.street,
      tags: mode === 'sizing' ? ['sizing'] : mode === 'xray' ? ['range', 'range narrowing'] : [],
      position: item.pos,
      heroStack: item.stack
    });
  }

  function recordLegacyOutcome({ item, mode, gradeLetter, grade, evLossBb, spacedReview = false } = {}) {
    if (!item || !hasProfile()) return null;
    const drill = makeDrillFromLegacy(item, mode);
    const trainingGrade = grade || letterGradeToTraining(gradeLetter);
    const loss = evLossBb != null ? evLossBb : letterGradeToEvLoss(gradeLetter);
    const skillTags = skillTagsForLegacy(item, mode);
    const result = recordTrainingResult(store, { drill, grade: trainingGrade, evLossBb: loss });
    if (spacedReview) {
      const hist = store.loadHistory() || [];
      if (hist.length) hist[hist.length - 1].spacedReview = true;
      store.saveHistory(hist);
    }
    return { ...result, skillTags };
  }

  function findLegacyItem(spotId, mode, legacy = {}) {
    if (!spotId) return null;
    const pools = {
      swipe: legacy.swipe || [],
      sizing: legacy.sizing || [],
      review: legacy.reviews || [],
      memory: legacy.swipe || [],
      xray: legacy.xray || []
    };
    const pool = pools[mode] || [];
    const direct = pool.find((x) => x && x.id === spotId);
    if (direct) return direct;
    if (mode === 'xray' && /^XR_(\d+)$/.test(spotId)) {
      const m = /^XR_(\d+)$/.exec(spotId);
      const idx = m ? Number(m[1]) : -1;
      return pool[idx] || null;
    }
    const task = getTaskById(spotId);
    if (task) {
      if (mode === 'sizing') return libraryTaskToSizingSpot(task);
      if (mode === 'review') return libraryTaskToReviewSpot(task);
      if (mode === 'xray') return libraryTaskToXraySpot(task);
      return libraryTaskToSwipe(task);
    }
    return null;
  }

  function recordFromLegacyEvent(event, legacy = {}) {
    if (!event || !hasProfile()) return null;
    const mode = event.mode;
    if (!mode || mode === 'daily' || mode === 'heal' || mode === 'diagnostic') return null;
    const item = findLegacyItem(event.spotId, mode, legacy)
      || findLegacyItem(event.spotId, 'swipe', legacy)
      || {
        id: event.spotId || `${mode}_${Date.now()}`,
        concept: event.concept || mode,
        street: event.street
      };
    const spacedReview = mode === 'review' || mode === 'memory';
    return recordLegacyOutcome({
      item,
      mode,
      gradeLetter: event.grade,
      evLossBb: letterGradeToEvLoss(event.grade),
      spacedReview
    });
  }

  return {
    store,
    hasProfile,
    prepareSession,
    prepareSwipeSession,
    prepareSizingSpot,
    prepareReviewSpot,
    prepareXraySpot,
    prepareXrayIndex,
    prepareQuick5,
    prepareMemorySpot,
    recordLegacyOutcome,
    recordFromLegacyEvent,
    findLegacyItem,
    libraryTaskToSwipe,
    MINI_APP_SPECS
  };
}
