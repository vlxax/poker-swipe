/**
 * PokerSwipe — Screen Router
 * Strict isolation: Polyana, My Tournaments, and other main views are separate screens.
 */
(function () {
  'use strict';

  const MY_TOUR_MARKERS = ['.v59Journal', '.t23', '.v58JournalHero', '.mt-pro-hero', '.ps72hero'];

  function reparentPs72() {
    const root = document.getElementById('myTournamentsRoot');
    const ps72 = document.getElementById('ps72TournamentScreen');
    if (root && ps72 && !root.contains(ps72)) root.appendChild(ps72);
  }

  function hideMyTournamentsUi() {
    const ps72 = document.getElementById('ps72TournamentScreen');
    ps72?.classList.remove('on');
    ps72?.setAttribute('aria-hidden', 'true');
    document.getElementById('mtProModal')?.classList.remove('on');
    document.getElementById('mtProAnalytics')?.classList.remove('on');
    document.getElementById('mtProDetailOverlay')?.classList.remove('on');
    document.getElementById('mtProDetail')?.classList.remove('on');
    document.body.style.overflow = '';
  }

  function polyanaRoot() {
    return document.getElementById('psPolyanaArea');
  }

  function scrubPolyanaLeak() {
    const area = polyanaRoot();
    if (!area) return;
    MY_TOUR_MARKERS.forEach((sel) => {
      area.querySelectorAll(sel).forEach((node) => {
        if (node.closest('#ps72TournamentScreen')) return;
        node.remove();
      });
    });
  }

  function wrapShow() {
    if (!window.show || window.show._psScreenRouter) return;
    const orig = window.show;

    window.show = function psShow(id) {
      if (id === 'tournaments') id = 'polyana';

      const prev = document.querySelector('.screen.active')?.id;
      const result = orig(id);

      if (id !== 'mytournaments') hideMyTournamentsUi();
      if (id === 'polyana') scrubPolyanaLeak();

      if (id === 'mytournaments') {
        reparentPs72();
        const ps72 = document.getElementById('ps72TournamentScreen');
        if (ps72) {
          ps72.classList.add('on');
          ps72.setAttribute('aria-hidden', 'false');
        }
      }

      return result;
    };
    window.show._psScreenRouter = true;
  }

  function openMyTournamentsRoute() {
    if (typeof window.openMyTournamentsV72 === 'function') return window.openMyTournamentsV72();
    if (typeof window.show === 'function') return window.show('mytournaments');
  }

  function openPolyanaRoute() {
    if (typeof window.openPokerSwipePolyana === 'function') return window.openPokerSwipePolyana();
    if (typeof window.show === 'function') return window.show('polyana');
  }

  function patchLegacyOpeners() {
    const myTourOpeners = ['openMyTournamentsV59', 'openMyTournamentsV58', 'openMyTournamentsV54', 'openJournal'];
    myTourOpeners.forEach((name) => {
      const fn = window[name];
      if (typeof fn !== 'function' || fn._psRouted) return;
      window[name] = function (...args) {
        return openMyTournamentsRoute();
      };
      window[name]._psRouted = true;
    });

    ['openPolyanaV56', 'openPolyanaV54'].forEach((name) => {
      const fn = window[name];
      if (typeof fn !== 'function' || fn._psRouted) return;
      window[name] = function (...args) {
        return openPolyanaRoute();
      };
      window[name]._psRouted = true;
    });
  }

  function blockPolyanaJournalTab() {
    document.addEventListener('click', (e) => {
      const tab = e.target.closest?.('[data-top="journal"]');
      if (!tab) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      e.stopPropagation();
      if (typeof window.openMyTournamentsV72 === 'function') window.openMyTournamentsV72();
      else if (typeof window.show === 'function') window.show('mytournaments');
    }, true);
  }

  function bindNavIsolation() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest?.('.nav [data-nav]');
      if (!btn) return;
      const id = btn.dataset.nav;
      if (id === 'mytournaments') return;
      if (document.getElementById('mytournaments')?.classList.contains('active')) hideMyTournamentsUi();
    }, true);
  }

  function init() {
    reparentPs72();
    wrapShow();
    patchLegacyOpeners();
    blockPolyanaJournalTab();
    bindNavIsolation();
    scrubPolyanaLeak();

    if (typeof MutationObserver !== 'undefined') {
      const obs = new MutationObserver(() => {
        reparentPs72();
        if (document.getElementById('polyana')?.classList.contains('active')) scrubPolyanaLeak();
      });
      obs.observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.PsScreenRouter = { scrubPolyanaLeak, hideMyTournamentsUi, reparentPs72 };
})();
