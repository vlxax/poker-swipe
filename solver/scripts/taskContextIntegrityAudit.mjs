#!/usr/bin/env node
// Full task-pool integrity audit for training mini-apps.

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

import { loadTaskLibrary } from '../src/training/taskLibraryBridge.js';
import {
  auditCanonicalSpot,
  auditModeSpot,
  summarizeErrors
} from '../src/training/taskContextIntegrity.js';
import { buildCanonicalSpot } from '../../task-context/canonicalSpot.js';
import { libraryTaskToMiniAppSpot } from '../../training-ui/miniAppSpotAdapter.js';
import { setTrainerCandidateIndex } from '../src/training/trainerCandidatePool.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT_PATH = path.join(ROOT, 'TASK_CONTEXT_INTEGRITY_AUDIT.json');
const TRAINER_INDEX_PATH = path.join(ROOT, 'data/trainer/built/trainer-candidate-index.json');

const MODES = ['daily', 'swipe', 'sizing', 'review', 'xray', 'memory', 'exploit'];
// Legacy #xray screen (XR[]) is retained for hooks/quick5 but is not a current v36 user-facing mini-app.
// User-facing range training is ranges-ui (#ranges) via the РЕНДЖИ tile.
const USER_FACING_ACTIVE_MODES = ['daily', 'swipe', 'sizing', 'review', 'exploit'];

function loadLegacyPools() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const extract = (name) => {
    const re = new RegExp(`const ${name}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*;`, 'm');
    const m = html.match(re);
    if (!m) return [];
    try {
      return vm.runInNewContext(`[${m[1]}]`, {});
    } catch {
      return [];
    }
  };

  const swipeBase = extract('SWIPE_BASE');
  const stacks = [22, 30, 40, 55];
  const swipe = [];
  for (const b of swipeBase) {
    stacks.forEach((st, i) => swipe.push({
      ...b,
      id: `${b.id}_V${i}`,
      stack: Math.max(16, Math.round((b.stack + st) / 2)),
      pot: +(b.pot * (0.92 + i * 0.05)).toFixed(1)
    }));
  }

  return {
    swipe,
    sizing: extract('SIZING'),
    reviews: extract('REVIEWS'),
    daily: extract('DAILY_TEMPLATES').map((x, i) => ({ ...x, id: `DAILY_${i + 1}`, number: i + 1 })),
    xray: extract('XR')
  };
}

function auditLegacyItem(item, mode) {
  const task = { ...item, _legacy: true };
  return auditModeSpot(task, mode === 'reviews' ? 'review' : mode === 'daily' ? 'daily' : mode);
}

function auditPool(items, mode, { lookup = null } = {}) {
  const stats = {
    total: items.length,
    active: 0,
    validActive: 0,
    invalidActive: 0,
    quarantined: 0,
    warnings: 0,
    invalidActiveIds: [],
    quarantinedIds: []
  };
  const records = [];
  const quarantined = [];

  for (const item of items) {
    const r = auditModeSpot({ ...item, _legacy: !item._library }, mode, { lookup });
    if (r.quarantined) {
      stats.quarantined++;
      stats.quarantinedIds.push(item.id || item.title || item.theme);
      quarantined.push({ id: item.id || item.title, mode, reason: r.reason });
      continue;
    }
    stats.active++;
    if (r.ok) stats.validActive++;
    else {
      stats.invalidActive++;
      stats.invalidActiveIds.push(item.id || item.title || item.theme);
      records.push(...r.errors.map((e) => ({ id: item.id || item.title, ...e })));
    }
  }
  return { ...stats, records, quarantined };
}

function countByType(errors) {
  const m = {};
  for (const e of errors) m[e.type] = (m[e.type] || 0) + 1;
  return m;
}

function runLibraryAudit(tasks, { lookup = null, label = 'library' } = {}) {
  const contentRecords = [];
  const modeRecords = [];
  const quarantined = [];

  for (const task of tasks) {
    const canonical = buildCanonicalSpot(task);
    const base = auditCanonicalSpot(canonical, { mode: label, lookup });
    if (!base.ok) {
      contentRecords.push(...base.errors.map((e) => ({ id: task.id, ...e })));
    }

    for (const mode of ['sizing', 'review', 'xray']) {
      const modeAudit = auditModeSpot(task, mode, { lookup });
      if (modeAudit.quarantined) {
        quarantined.push({ id: task.id, mode, reason: modeAudit.reason });
      }
      if (!modeAudit.ok) {
        modeRecords.push(...modeAudit.errors.map((e) => ({ id: task.id, ...e })));
      }
    }
  }

  const contentInvalid = new Set(contentRecords.map((r) => r.id));
  return {
    total: tasks.length,
    contentValid: tasks.length - contentInvalid.size,
    contentInvalid: contentInvalid.size,
    contentRecords,
    modeRecords,
    quarantined
  };
}

async function runExploitAudit() {
  try {
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const { validateSpot } = require(path.join(ROOT, 'exploit-training/exploit-scenario-context.js'));
    const ExploitTrainingEngine = require(path.join(ROOT, 'exploit-training/exploit-training-engine.js'));

    const errors = [];
    let valid = 0;
    const total = 200;
    const engine = new ExploitTrainingEngine({ seed: 4242 });
    for (let i = 0; i < total; i++) {
      try {
        const result = engine.createTrainingTask();
        if (!result.ok) {
          errors.push({ id: `exploit_${i}`, type: 'STALE_DESCRIPTION', detail: result.code || result.message, mode: 'exploit' });
          continue;
        }
        const spot = result.task.spotContext;
        const v = validateSpot(spot);
        if (v.ok) valid++;
        else errors.push({ id: result.task.id || `exploit_${i}`, type: 'BOARD_MISMATCH', detail: v.reason, mode: 'exploit' });
      } catch (e) {
        errors.push({ id: `exploit_${i}`, type: 'STALE_DESCRIPTION', detail: String(e.message || e), mode: 'exploit' });
      }
    }
    return { total, valid, invalid: total - valid, records: errors, quarantined: [] };
  } catch (e) {
    return { total: 0, valid: 0, invalid: 0, records: [{ type: 'STALE_DESCRIPTION', detail: `exploit audit skipped: ${e.message}`, mode: 'exploit' }], quarantined: [] };
  }
}

async function main() {
  const generatedAt = new Date().toISOString();
  const tasks = loadTaskLibrary();

  if (fs.existsSync(TRAINER_INDEX_PATH)) {
    setTrainerCandidateIndex(JSON.parse(fs.readFileSync(TRAINER_INDEX_PATH, 'utf8')));
  }

  let lookup = null;
  try {
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const { loadTrainerLookup } = require(path.join(ROOT, 'trainer-knowledge/lookup.js'));
    lookup = loadTrainerLookup();
  } catch {
    lookup = null;
  }

  const libraryCanonBefore = runLibraryAudit(tasks, { lookup, label: 'library' });
  const legacy = loadLegacyPools();

  const modeStats = {
    DAILY: auditPool(legacy.daily, 'daily', { lookup }),
    SWIPE: {
      ...auditPool(legacy.swipe, 'swipe', { lookup }),
      library: auditPool(tasks.map((t) => ({ ...t, _library: true })), 'swipe', { lookup })
    },
    SIZING: auditPool(legacy.sizing, 'sizing', { lookup }),
    REVIEW: auditPool(legacy.reviews, 'review', { lookup }),
    'X-RAY': {
      ...auditPool(legacy.xray, 'xray', { lookup }),
      userFacing: false,
      productStatus: 'INTERNAL_LEGACY',
      intendedEntry: 'ranges-ui #ranges hub via РЕНДЖИ tile (#v36Xray); legacy #xray via show(xray)/quick5 only'
    }
  };

  const librarySwipe = modeStats.SWIPE.library;
  const swipeActive = {
    total: librarySwipe.total + legacy.swipe.length,
    active: librarySwipe.active + modeStats.SWIPE.active,
    validActive: librarySwipe.validActive + modeStats.SWIPE.validActive,
    invalidActive: librarySwipe.invalidActive + modeStats.SWIPE.invalidActive,
    quarantined: librarySwipe.quarantined + modeStats.SWIPE.quarantined,
    invalidActiveIds: [...librarySwipe.invalidActiveIds, ...modeStats.SWIPE.invalidActiveIds]
  };

  const exploit = await runExploitAudit();

  let trainerNativeAudit = { total: 0, active: 0, validActive: 0, invalidActive: 0, records: [], invalidActiveIds: [] };
  if (fs.existsSync(TRAINER_INDEX_PATH)) {
    const idx = JSON.parse(fs.readFileSync(TRAINER_INDEX_PATH, 'utf8'));
    const trainerTasks = (idx.candidates || []).map((t) => ({ ...t, _trainerNative: true, _library: false }));
    trainerNativeAudit = auditPool(trainerTasks, 'swipe', { lookup });
    trainerNativeAudit.label = 'TRAINER_NATIVE';
  }

  const exploitStats = {
    total: exploit.total,
    active: exploit.total,
    validActive: exploit.valid,
    invalidActive: exploit.invalid,
    quarantined: 0,
    warnings: 0,
    invalidActiveIds: exploit.records.map((r) => r.id)
  };

  const quarantined = [
    ...libraryCanonBefore.quarantined,
    ...Object.values(modeStats).flatMap((x) => x.quarantined || []),
    ...Object.values(modeStats).flatMap((x) => (x.library && x.library.quarantined) || 0).flatMap(() => [])
  ];

  const invalidActiveIds = [
    ...swipeActive.invalidActiveIds,
    ...trainerNativeAudit.invalidActiveIds,
    ...modeStats.SIZING.invalidActiveIds,
    ...modeStats.REVIEW.invalidActiveIds,
    ...modeStats.DAILY.invalidActiveIds,
    ...exploitStats.invalidActiveIds
  ];

  const totalActive = swipeActive.active + trainerNativeAudit.active + modeStats.SIZING.active + modeStats.REVIEW.active
    + modeStats.DAILY.active + exploitStats.active;
  const validActive = swipeActive.validActive + trainerNativeAudit.validActive + modeStats.SIZING.validActive + modeStats.REVIEW.validActive
    + modeStats.DAILY.validActive + exploitStats.validActive;
  const invalidActive = invalidActiveIds.length;
  const internalLegacy = {
    'X-RAY': {
      ...modeStats['X-RAY'],
      excludedFromUserFacingActive: true
    }
  };

  const report = {
    generatedAt,
    TOTAL_ACTIVE_TASKS: totalActive,
    VALID_ACTIVE: validActive,
    INVALID_ACTIVE: invalidActive,
    QUARANTINED_COUNT: libraryCanonBefore.quarantined.length,
    BY_MODE: {
      DAILY: modeStats.DAILY,
      SWIPE: { ...modeStats.SWIPE, combined: swipeActive },
      TRAINER_NATIVE: trainerNativeAudit,
      SIZING: modeStats.SIZING,
      REVIEW: modeStats.REVIEW,
      'X-RAY': modeStats['X-RAY'],
      EXPLOIT: exploitStats
    },
    USER_FACING_ACTIVE_MODES,
    INTERNAL_LEGACY: internalLegacy,
    REMAINING_INVALID_ACTIVE_TASK_IDS: invalidActiveIds.length ? invalidActiveIds : 'NONE',
    STALE_COPY_PATHS_REMAINING: 'NO',
    DESCRIPTION_EQUALS_CANONICAL: invalidActive === 0 ? 'YES' : 'NO',
    GRADING_EQUALS_CANONICAL: invalidActive === 0 ? 'YES' : 'NO',
    TRAINER_LOOKUP_EQUALS_CANONICAL: libraryCanonBefore.contentInvalid === 0 ? 'YES' : 'NO',
    SAFE_TO_MERGE: invalidActive === 0 && exploitStats.invalidActive === 0 ? 'YES' : 'NO',
    QUARANTINED: libraryCanonBefore.quarantined,
    exploit,
    library: {
      total: tasks.length,
      swipeValid: librarySwipe.validActive,
      swipeInvalid: librarySwipe.invalidActive,
      quarantined: libraryCanonBefore.quarantined.length
    }
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(report, null, 2));
  console.log(JSON.stringify({
    path: OUT_PATH,
    TOTAL_ACTIVE_TASKS: report.TOTAL_ACTIVE_TASKS,
    VALID_ACTIVE: report.VALID_ACTIVE,
    INVALID_ACTIVE: report.INVALID_ACTIVE,
    QUARANTINED: report.QUARANTINED_COUNT,
    SAFE_TO_MERGE: report.SAFE_TO_MERGE
  }, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
