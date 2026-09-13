/**
 * Binds card swipe gestures to existing [data-sa] actions (tap path unchanged).
 */
import { mapSwipeToAction, actionHintForDelta, prefersReducedMotion } from './swipe-gesture-core.js';

const THRESHOLD = 56;

function escAttr(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function ensureHints(scene) {
  let layer = scene.querySelector('.psSwipeHints');
  if (layer) return layer;
  layer = document.createElement('div');
  layer.className = 'psSwipeHints';
  layer.setAttribute('aria-hidden', 'true');
  layer.innerHTML = '<span class="psSwipeHint psSwipeHint--left"></span><span class="psSwipeHint psSwipeHint--up"></span><span class="psSwipeHint psSwipeHint--right"></span>';
  scene.appendChild(layer);
  return layer;
}

function setHints(layer, actions) {
  const left = layer.querySelector('.psSwipeHint--left');
  const right = layer.querySelector('.psSwipeHint--right');
  const up = layer.querySelector('.psSwipeHint--up');
  const fold = actions.find((a) => /ФОЛД/i.test(a));
  const passive = actions.find((a) => /КОЛЛ|ЧЕК/i.test(a));
  const agg = actions.find((a) => /РЕЙЗ|СТАВКА|ОЛЛ/i.test(a));
  if (left) left.textContent = fold || '';
  if (right) right.textContent = passive || '';
  if (up) up.textContent = agg || '';
}

function highlightHint(layer, side) {
  layer.querySelectorAll('.psSwipeHint').forEach((el) => el.classList.remove('on'));
  if (!side) return;
  const el = layer.querySelector('.psSwipeHint--' + side);
  if (el && el.textContent) el.classList.add('on');
}

export function attachSwipeScene(sceneEl, opts = {}) {
  if (!sceneEl || sceneEl.dataset.psSwipeBound) return;
  const getActions = opts.getActions || (() => []);
  const isLocked = opts.isLocked || (() => false);
  const onAction = opts.onAction;
  if (typeof onAction !== 'function') return;

  sceneEl.dataset.psSwipeBound = '1';
  sceneEl.classList.add('psSwipeDraggable');
  const dragTarget = sceneEl.querySelector('.pgArenaWrap') || sceneEl;
  const hints = ensureHints(sceneEl);

  let pointerId = null;
  let startX = 0;
  let startY = 0;
  let dragging = false;
  let committed = false;

  function resetTransform() {
    dragTarget.classList.remove('psSwipeDragging', 'psSwipeCommit', 'psSwipeCancel');
    dragTarget.style.transform = '';
    dragTarget.style.transition = '';
    highlightHint(hints, null);
  }

  function actions() {
    return getActions().filter(Boolean);
  }

  function onPointerDown(e) {
    if (committed || isLocked() || pointerId != null) return;
    if (e.target && e.target.closest && e.target.closest('button, a, input, textarea, select, label')) return;
    if (e.button != null && e.button !== 0) return;
    const acts = actions();
    if (!acts.length) return;
    setHints(hints, acts);
    pointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    dragging = false;
    try { dragTarget.setPointerCapture(e.pointerId); } catch (_) {}
  }

  function onPointerMove(e) {
    if (e.pointerId !== pointerId || committed) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (!dragging && Math.hypot(dx, dy) < 8) return;
    dragging = true;
    dragTarget.classList.add('psSwipeDragging');

    const reduced = prefersReducedMotion();
    if (!reduced) {
      const rot = Math.max(-8, Math.min(8, dx * 0.04));
      dragTarget.style.transition = 'none';
      dragTarget.style.transform = `translate3d(${dx}px, ${dy}px, 0) rotate(${rot}deg)`;
    }

    const hint = actionHintForDelta(dx, dy, actions(), { threshold: THRESHOLD });
    highlightHint(hints, hint ? hint.side : null);
  }

  function onPointerUp(e) {
    if (e.pointerId !== pointerId) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    pointerId = null;

    if (!dragging || committed || isLocked()) {
      resetTransform();
      dragging = false;
      return;
    }

    const action = mapSwipeToAction(dx, dy, actions(), { threshold: THRESHOLD });
    if (!action) {
      dragTarget.classList.add('psSwipeCancel');
      if (!prefersReducedMotion()) {
        dragTarget.style.transition = 'transform 180ms var(--motion-ease, ease-out)';
        dragTarget.style.transform = 'translate3d(0,0,0) rotate(0deg)';
        setTimeout(resetTransform, 200);
      } else {
        resetTransform();
      }
      dragging = false;
      return;
    }

    committed = true;
    dragTarget.classList.add('psSwipeCommit');
    if (!prefersReducedMotion()) {
      const outX = dx < 0 ? -120 : dx > 0 ? 120 : 0;
      const outY = dy < 0 ? -80 : 0;
      dragTarget.style.transition = 'transform 160ms var(--motion-ease, ease-out)';
      dragTarget.style.transform = `translate3d(${outX}px, ${outY}px, 0) rotate(${dx * 0.05}deg)`;
    }

    setTimeout(() => {
      onAction(action);
      committed = false;
      resetTransform();
      dragging = false;
    }, prefersReducedMotion() ? 0 : 140);
  }

  dragTarget.addEventListener('pointerdown', onPointerDown);
  dragTarget.addEventListener('pointermove', onPointerMove);
  dragTarget.addEventListener('pointerup', onPointerUp);
  dragTarget.addEventListener('pointercancel', onPointerUp);
}

function patchPsMotion() {
  const M = window.PsMotion || (window.PsMotion = {});
  if (!M.startHand) {
    M.startHand = function (root, cb) {
      const arena = root && root.querySelector('.pgArenaWrap, .pgArena');
      const run = typeof cb === 'function' ? cb : () => {};
      if (!arena || prefersReducedMotion()) {
        run();
        return;
      }
      arena.classList.add('psHandEnter');
      setTimeout(() => {
        arena.classList.remove('psHandEnter');
        run();
      }, 220);
    };
  }
  if (!M.decisionLock) {
    M.decisionLock = function (btn) {
      if (!btn) return;
      btn.classList.add('ps-pressed');
      setTimeout(() => btn.classList.remove('ps-pressed'), prefersReducedMotion() ? 0 : 160);
    };
  }
  M.attachSwipeScene = attachSwipeScene;
}

function bindSwipeVisualFromDom() {
  const visual = document.getElementById('swipeVisual');
  if (!visual || visual.dataset.psSwipeBound) return;
  const actionsHost = document.getElementById('swipeActions');
  if (!actionsHost || !actionsHost.querySelector('[data-sa]')) return;

  attachSwipeScene(visual, {
    getActions: () =>
      Array.from(document.querySelectorAll('#swipeActions [data-sa]')).map((b) => b.dataset.sa),
    isLocked: () => !!window.swLocked,
    onAction: (action) => {
      if (window.swLocked) return;
      const btn = Array.from(document.querySelectorAll('#swipeActions [data-sa]')).find(
        (b) => b.dataset.sa === action
      );
      if (btn && !btn.disabled) btn.click();
    }
  });
}

function hookRenderSwipe() {
  const orig = window.renderSwipe;
  if (!orig || orig.__psSwipeHooked) return;
  window.renderSwipe = function (...args) {
    const ret = orig.apply(this, args);
    queueMicrotask(bindSwipeVisualFromDom);
    return ret;
  };
  window.renderSwipe.__psSwipeHooked = true;
}

patchPsMotion();
hookRenderSwipe();
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    patchPsMotion();
    hookRenderSwipe();
  });
} else {
  queueMicrotask(bindSwipeVisualFromDom);
}
