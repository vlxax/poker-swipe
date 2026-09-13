/**
 * PokerSwipe — Hand of the Day bridge
 * Fullscreen overlay on show('daily'). Hides app bottom nav. No engine rewrite.
 * Module: modules/hand-of-the-day.html (approved redesign).
 */
(function () {
  'use strict';

  const BUILD = 'hand-day-bridge-v3';
  const MODULE_SRC = 'modules/hand-of-the-day.html';
  const OVERLAY_ID = 'psHandDayOverlay';

  function ensureOverlay() {
    let el = document.getElementById(OVERLAY_ID);
    if (el) return el;
    el = document.createElement('div');
    el.id = OVERLAY_ID;
    el.setAttribute('aria-hidden', 'true');
    el.style.cssText = [
      'position:fixed',
      'inset:0',
      'z-index:99990',
      'display:none',
      'background:#030504',
      'width:100%',
      'height:100%',
      'max-height:100dvh'
    ].join(';');
    const frame = document.createElement('iframe');
    frame.id = 'psHandDayFrame';
    frame.title = 'Рука дня';
    frame.setAttribute('allow', 'fullscreen');
    frame.style.cssText = 'border:0;width:100%;height:100%;display:block;background:#030504';
    el.appendChild(frame);
    document.body.appendChild(el);
    return el;
  }

  function setAppNavHidden(hidden) {
    document.documentElement.classList.toggle('psHandDayOpen', !!hidden);
    document.body.classList.toggle('psHandDayOpen', !!hidden);
    const nav = document.querySelector('.nav, nav.nav, #bottomNav, .bottomNav, [data-ps-bottom-nav]');
    if (nav) {
      if (hidden) {
        nav.dataset.psPrevDisplay = nav.style.display || '';
        nav.style.display = 'none';
      } else if (nav.dataset.psPrevDisplay !== undefined) {
        nav.style.display = nav.dataset.psPrevDisplay;
        delete nav.dataset.psPrevDisplay;
      }
    }
  }

  function openHandDay() {
    const overlay = ensureOverlay();
    const frame = document.getElementById('psHandDayFrame');
    if (!frame) return;
    frame.src = MODULE_SRC + '?v=' + encodeURIComponent(BUILD) + '&t=' + Date.now();
    overlay.style.display = 'block';
    overlay.setAttribute('aria-hidden', 'false');
    setAppNavHidden(true);
  }

  function closeHandDay() {
    const overlay = document.getElementById(OVERLAY_ID);
    if (overlay) {
      overlay.style.display = 'none';
      overlay.setAttribute('aria-hidden', 'true');
    }
    const frame = document.getElementById('psHandDayFrame');
    if (frame) {
      try { frame.src = 'about:blank'; } catch (_) {}
    }
    setAppNavHidden(false);
    if (typeof window.show === 'function') {
      try { window.show('home'); } catch (_) { /* ignore */ }
    }
  }

  function patchShow() {
    if (!window.show || window.show.__psHandDayBridge) return;
    const orig = window.show;
    window.show = function psHandDayShow(id) {
      if (id === 'daily') {
        openHandDay();
        return true;
      }
      if (document.documentElement.classList.contains('psHandDayOpen')) {
        const overlay = document.getElementById(OVERLAY_ID);
        if (overlay) {
          overlay.style.display = 'none';
          overlay.setAttribute('aria-hidden', 'true');
        }
        setAppNavHidden(false);
      }
      return orig.apply(this, arguments);
    };
    window.show.__psHandDayBridge = true;
  }

  function onMessage(ev) {
    const data = ev && ev.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'HAND_DAY_BACK' || data.type === 'HAND_DAY_CLOSE') {
      closeHandDay();
    }
  }

  function injectCss() {
    if (document.getElementById('psHandDayBridgeCss')) return;
    const style = document.createElement('style');
    style.id = 'psHandDayBridgeCss';
    style.textContent = [
      'html.psHandDayOpen, body.psHandDayOpen { overflow: hidden !important; }',
      'html.psHandDayOpen .nav, body.psHandDayOpen .nav,',
      'html.psHandDayOpen #bottomNav, body.psHandDayOpen #bottomNav { display: none !important; }',
      '#' + OVERLAY_ID + ' { touch-action: auto; }',
      '#' + OVERLAY_ID + ' iframe { touch-action: manipulation; }'
    ].join('\n');
    document.head.appendChild(style);
  }

  function init() {
    injectCss();
    patchShow();
    window.addEventListener('message', onMessage);
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && document.documentElement.classList.contains('psHandDayOpen')) {
        closeHandDay();
      }
    });
    setTimeout(patchShow, 0);
    setTimeout(patchShow, 400);
    window.PsHandDayBridge = { BUILD, open: openHandDay, close: closeHandDay, MODULE_SRC: MODULE_SRC };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
