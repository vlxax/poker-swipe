// Selection catalog for the ranges UI.
//
// Thin adapter over coverage.js: the poker model decides what exists, this file
// only shapes it into the chip lists the renderer consumes. `positions` and
// `formats` stay the full poker model (used by non-UI callers); the `available*`
// lists are what the selector is allowed to render.

import {
  FORMAT_IDS, FORMAT_LABELS, positionsForFormat, getValidOpeners
} from './positions.js';
import {
  SITUATION_IDS, SITUATION_LABELS, situationNeedsOpener,
  formatOptionsFor, positionOptionsFor, situationOptionsFor,
  openerOptionsFor, stackOptionsFor, evaluateCombination, hiddenScenarioSummary,
  unavailableSummary
} from './coverage.js';

export const FORMATS = FORMAT_IDS.map((id) => ({ id, label: FORMAT_LABELS[id] }));

export const SITUATIONS = SITUATION_IDS.map((id) => ({
  id,
  label: SITUATION_LABELS[id],
  needsOpener: situationNeedsOpener(id),
  push: id === 'push_fold'
}));

export function situationMeta(id) {
  return SITUATIONS.find((s) => s.id === id) || null;
}

export function situationLabel(id) {
  return SITUATION_LABELS[id] || id;
}

export function getCatalog(pack, format = '6max') {
  const fmt = FORMAT_IDS.includes(format) ? format : '6max';
  const availableFormats = formatOptionsFor(pack);
  return {
    pack,
    format: fmt,
    formats: FORMATS,
    situations: SITUATIONS,
    positions: positionsForFormat(fmt),
    availableFormats: FORMATS.filter((f) => availableFormats.includes(f.id)),
    availablePositions: positionOptionsFor(pack, fmt),
    hiddenScenarios: hiddenScenarioSummary(pack),
    unavailable: unavailableSummary(pack)
  };
}

export function situationsForPosition(catalog, position) {
  if (!position) return [];
  const ids = situationOptionsFor(catalog.pack, { format: catalog.format, position });
  return SITUATIONS.filter((s) => ids.includes(s.id));
}

export function positionsForSituation(catalog, situation) {
  return (catalog.availablePositions || []).filter((position) => (
    situationOptionsFor(catalog.pack, { format: catalog.format, position }).includes(situation)
  ));
}

export function openersForSituation(catalog, situation, position) {
  if (!situationNeedsOpener(situation) || !position) return [];
  return openerOptionsFor(catalog.pack, { format: catalog.format, position, situation });
}

export function stacksForSituation(catalog, situation, position, opener = null) {
  if (!situation || !position) return [];
  return stackOptionsFor(catalog.pack, {
    format: catalog.format, position, situation, opener
  });
}

// Every seat that could legally have opened before hero, regardless of whether
// the pack has data for it. Exposed so the UI and tests can tell "impossible"
// apart from "not covered yet".
export function legalOpeners(format, position) {
  return getValidOpeners(format, position);
}

export function isSelectionComplete(sel) {
  if (!sel || !sel.format || !sel.position || !sel.situation) return false;
  if (sel.stack === null || sel.stack === undefined) return false;
  if (situationNeedsOpener(sel.situation) && !sel.opener) return false;
  return true;
}

export function isSelectionAvailable(pack, sel) {
  return evaluateCombination(pack, sel).available;
}

export function nextCtaLabel(sel) {
  if (!sel.position) return 'ВЫБЕРИ ПОЗИЦИЮ';
  if (!sel.situation) return 'ВЫБЕРИ СИТУАЦИЮ';
  if (situationNeedsOpener(sel.situation) && !sel.opener) return 'ВЫБЕРИ ОТКРЫТИЕ';
  if (sel.stack === null || sel.stack === undefined) return 'ВЫБЕРИ СТЕК';
  return 'ПОКАЗАТЬ РЕНДЖ';
}

export function suggestNearby(sel, catalog) {
  const out = [];
  if (!sel.position && catalog.availablePositions.length) {
    out.push({ field: 'position', value: catalog.availablePositions[0] });
    return out;
  }
  const situations = situationsForPosition(catalog, sel.position);
  if (!sel.situation && situations.length) {
    out.push({ field: 'situation', value: situations[0].id });
    return out;
  }
  if (situationNeedsOpener(sel.situation) && !sel.opener) {
    const openers = openersForSituation(catalog, sel.situation, sel.position);
    if (openers.length) out.push({ field: 'opener', value: openers[0] });
    return out;
  }
  const stacks = stacksForSituation(catalog, sel.situation, sel.position, sel.opener);
  if (stacks.length) out.push({ field: 'stack', value: stacks[0].id });
  return out;
}

// Drops anything the current prefix no longer supports, so the selection can
// never carry a stale position/situation/opener/stack into the result screen.
export function sanitizeSelection(sel, catalog) {
  const next = {
    format: catalog.format,
    position: sel.position || null,
    situation: sel.situation || null,
    opener: sel.opener || null,
    stack: sel.stack === undefined ? null : sel.stack,
    pushMode: sel.pushMode || 'PUSH'
  };

  if (next.position && !catalog.availablePositions.includes(next.position)) {
    next.position = null;
  }
  if (!next.position) {
    return { ...next, situation: null, opener: null, stack: null };
  }

  const situations = situationsForPosition(catalog, next.position).map((s) => s.id);
  if (next.situation && !situations.includes(next.situation)) {
    next.situation = null;
  }
  if (!next.situation) {
    return { ...next, opener: null, stack: null };
  }

  if (situationNeedsOpener(next.situation)) {
    const openers = openersForSituation(catalog, next.situation, next.position);
    if (next.opener && !openers.includes(next.opener)) next.opener = null;
    if (!next.opener) return { ...next, stack: null };
  } else {
    next.opener = null;
  }

  const stacks = stacksForSituation(catalog, next.situation, next.position, next.opener);
  if (next.stack !== null && !stacks.some((s) => s.id === Number(next.stack))) {
    next.stack = null;
  }
  return next;
}
