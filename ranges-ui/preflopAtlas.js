// Builds range matrices from POKER_BRAIN_PACK.preflop.
//
// Every lookup goes through rangeSources.js, which only ever resolves exact
// keys. A tuple counts as usable when all 169 hand classes are present; a
// partially populated tuple is treated as no data rather than being padded.

import { matrixClasses } from './matrix.js';
import {
  SOURCE_RFI, SOURCE_VS_OPEN, SOURCE_BB_DEFEND, SOURCE_VS_3BET,
  sourceIdFor, lookupPolicyExact, describeSource
} from './rangeSources.js';

const ACTION_RU = {
  FOLD: 'Фолд',
  CALL: 'Колл',
  RAISE: 'Рейз',
  PUSH: 'Пуш',
  MIX: 'Микс'
};

// How the raw {FOLD, CALL, RAISE} policy maps onto "do we play this hand" and
// onto the label shown in the hand detail card.
export function actionFor(policy = {}, sourceId) {
  const fold = policy.FOLD || 0;
  const call = policy.CALL || 0;
  const raise = policy.RAISE || 0;

  if (sourceId === SOURCE_RFI) {
    return { action: 'RAISE', freq: raise, play: raise, label: 'Открываем' };
  }

  const play = call + raise;
  if (sourceId === SOURCE_VS_3BET) {
    if (raise >= 0.4) return { action: 'RAISE', freq: raise, play, label: '4-бетим' };
    if (play >= 0.45) return { action: 'CALL', freq: call, play, label: 'Коллим' };
    return { action: 'FOLD', freq: fold, play, label: 'Фолдим' };
  }
  if (sourceId === SOURCE_VS_OPEN || sourceId === SOURCE_BB_DEFEND) {
    if (raise >= 0.4) return { action: 'RAISE', freq: raise, play, label: '3-бетим' };
    if (play >= 0.45) return { action: 'CALL', freq: call, play, label: 'Коллим' };
    return { action: 'FOLD', freq: fold, play, label: 'Фолдим' };
  }

  const best = Math.max(raise, call, fold);
  const action = best === raise ? 'RAISE' : best === call ? 'CALL' : 'FOLD';
  return { action, freq: best, play, label: ACTION_RU[action] };
}

export function playBucket(play) {
  const p = Number(play) || 0;
  if (p >= 0.85) return { key: 'always', label: 'Играем всегда' };
  if (p >= 0.15) return { key: 'sometimes', label: 'Играем иногда' };
  return { key: 'never', label: 'Не играем' };
}

export function buildAtlasMatrix(pack, sel) {
  const sourceId = sourceIdFor(sel.situation, sel.position);
  const cells = {};
  let found = 0;
  const classes = matrixClasses();

  for (const hand of classes) {
    const policy = lookupPolicyExact(pack, sel, hand);
    if (!policy) {
      cells[hand] = { hand, supported: false, play: 0, bucket: 'never' };
      continue;
    }
    found++;
    const meta = actionFor(policy, sourceId);
    const bucket = playBucket(meta.play);
    cells[hand] = {
      hand,
      supported: true,
      play: meta.play,
      bucket: bucket.key,
      bucketLabel: bucket.label,
      action: meta.action,
      actionLabel: meta.label,
      freq: meta.freq,
      policy
    };
  }

  // Anything short of the full 169 classes is an incomplete tuple, not a range.
  const supported = found === classes.length;
  return { cells, found, supported, sourceId, source: describeSource(pack, sel) };
}

export function handDetailFromAtlas(pack, sel, hand) {
  const policy = lookupPolicyExact(pack, sel, hand);
  if (!policy) return null;
  const sourceId = sourceIdFor(sel.situation, sel.position);
  const meta = actionFor(policy, sourceId);
  const bucket = playBucket(meta.play);
  const openSize = sourceId === SOURCE_RFI
    ? (sel.stack <= 25 ? 2.2 : sel.stack <= 40 ? 2.3 : 2.5)
    : null;
  return {
    hand,
    actionLabel: meta.label,
    actionCode: meta.action,
    freqPct: Math.round((meta.freq || 0) * 100),
    bucketLabel: bucket.label,
    sizeLabel: openSize ? `${String(openSize).replace('.', ',')} ББ` : null,
    policy
  };
}

export { ACTION_RU };
