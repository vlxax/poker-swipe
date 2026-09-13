/**
 * Pure swipe → action mapping for Poker Swipe UI.
 * Does not grade or change actions — only picks an existing label from the spot.
 */

const DEFAULT_THRESHOLD = 56;
const DEFAULT_DOMINANCE = 1.25;

export function prefersReducedMotion() {
  try {
    return typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch (_) {
    return false;
  }
}

/** @returns {string|null} action label from spot.actions */
export function mapSwipeToAction(dx, dy, actions, opts = {}) {
  const list = (actions || []).map(String);
  if (!list.length) return null;

  const threshold = opts.threshold != null ? opts.threshold : DEFAULT_THRESHOLD;
  const dominance = opts.dominance != null ? opts.dominance : DEFAULT_DOMINANCE;
  const adx = Math.abs(dx);
  const ady = Math.abs(dy);
  if (Math.max(adx, ady) < threshold) return null;

  const horizontal = adx >= ady * dominance;
  const vertical = ady >= adx * dominance;

  if (horizontal) {
    if (dx < 0) {
      const fold = list.find((a) => /ФОЛД/i.test(a));
      if (fold) return fold;
    } else {
      const passive = list.find((a) => /КОЛЛ|ЧЕК/i.test(a));
      if (passive) return passive;
    }
  }

  if (vertical && dy < 0) {
    const agg = list.find((a) => /РЕЙЗ|СТАВКА|ОЛЛ-ИН|ОЛЛИН/i.test(a));
    if (agg) return agg;
  }

  return null;
}

export function actionHintForDelta(dx, dy, actions, opts = {}) {
  const action = mapSwipeToAction(dx, dy, actions, { ...opts, threshold: (opts.threshold || DEFAULT_THRESHOLD) * 0.65 });
  if (!action) return null;
  return { action, side: dx < 0 ? 'left' : dy < 0 ? 'up' : 'right' };
}
