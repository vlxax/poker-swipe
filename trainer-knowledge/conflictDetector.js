// Detect conflicts between trainer data and POKER_BRAIN_PACK — never auto-resolve.

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { canGradeWithTrainerAction } from './status.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const BRAIN_POSITION_MAP = {
  EP: 'UTG',
  LJ: 'HJ',
  HJ: 'HJ'
};

function brainStackFromBand(band) {
  if (!band) return null;
  if (band.includes('-')) {
    const [lo, hi] = band.split('-').map(Number);
    return Math.round((lo + hi) / 2);
  }
  if (band.endsWith('+')) return parseFloat(band) + 10;
  return parseFloat(band);
}

function brainKeyForUoHand({ position, stackBand, hand }) {
  const pos = BRAIN_POSITION_MAP[position] || position;
  const stack = brainStackFromBand(stackBand);
  if (!stack || !pos || !hand) return null;
  return `RFI|${pos}|${stack}|${hand}`;
}

function dominantBrainAction(policy = {}) {
  const entries = Object.entries(policy).filter(([, v]) => v > 0);
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return { action: entries[0][0], freq: entries[0][1], mixed: entries.length > 1 };
}

export function detectTrainerBrainConflicts({ uoHands, pokerBrainPack }) {
  const conflicts = [];
  const preflop = pokerBrainPack?.preflop || {};

  for (const rec of uoHands) {
    if (!canGradeWithTrainerAction(rec.actionRaw)) continue;
    const key = brainKeyForUoHand({
      position: rec.position,
      stackBand: rec.stackBand,
      hand: rec.hand
    });
    if (!key || !preflop[key]) continue;

    const brain = dominantBrainAction(preflop[key]);
    if (!brain) continue;

    const trainerAction = rec.actionRaw;
    const brainAction = brain.action;

    const trainerIsRaise = trainerAction === 'RAISE' || trainerAction === 'AI';
    const brainIsRaise = brainAction === 'RAISE';
    const trainerPlays = trainerIsRaise;
    const brainPlays = brainIsRaise || brainAction === 'CALL';

    if (trainerPlays !== brainPlays || (trainerIsRaise && !brainIsRaise && brainAction !== 'CALL')) {
      conflicts.push({
        id: `conflict_${rec.chartId}_${rec.hand}`,
        chartId: rec.chartId,
        hand: rec.hand,
        position: rec.position,
        stackBand: rec.stackBand,
        trainer: { action: trainerAction, source: 'TRAINER' },
        pokerBrain: { action: brainAction, freq: brain.freq, mixed: brain.mixed, atlasKey: key },
        note: 'Position mapped EP→UTG, stack band→midpoint for comparison only'
      });
    }
  }

  return conflicts;
}

export function loadPokerBrainPackFromStrategyFile() {
  const path = join(ROOT, 'strategy_pack_v17.js');
  const raw = readFileSync(path, 'utf8');
  return JSON.parse(raw.replace(/^window\.POKER_BRAIN_PACK\s*=\s*/, '').replace(/;?\s*$/, ''));
}
