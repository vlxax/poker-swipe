/**
 * PokerSwipe — internal mini-app task history (not browser history).
 */
(function () {
  'use strict';

  const stacks = Object.create(null);
  let restoring = false;

  function clone(v) {
    try {
      return JSON.parse(JSON.stringify(v));
    } catch (_) {
      return v;
    }
  }

  window.MiniAppNav = {
    isRestoring() {
      return restoring;
    },

    withRestore(fn) {
      restoring = true;
      try {
        fn();
      } finally {
        restoring = false;
      }
    },

    reset(app) {
      stacks[app] = [];
    },

    push(app, snapshot) {
      if (restoring) return;
      if (!stacks[app]) stacks[app] = [];
      stacks[app].push(clone(snapshot));
    },

    replace(app, snapshot) {
      if (!stacks[app] || !stacks[app].length) {
        this.push(app, snapshot);
        return;
      }
      stacks[app][stacks[app].length - 1] = clone(snapshot);
    },

    pop(app) {
      const s = stacks[app];
      if (!s || s.length <= 1) return null;
      s.pop();
      return clone(s[s.length - 1]);
    },

    peek(app) {
      const s = stacks[app];
      return s && s.length ? clone(s[s.length - 1]) : null;
    },

    depth(app) {
      return (stacks[app] || []).length;
    },

    canBack(app) {
      return this.depth(app) > 1;
    },

    backButtonHtml(opts = {}) {
      const id = opts.id || 'pgBackBtn';
      const disabled = !!opts.disabled;
      const cls = 'pgBackBtn' + (disabled ? ' is-disabled' : '');
      return `<button type="button" class="${cls}" id="${id}" aria-label="Назад"${disabled ? ' disabled' : ''}><span class="pgBackIcon" aria-hidden="true">←</span></button>`;
    },

    headRow(app, innerHtml, opts = {}) {
      const disabled = opts.disabled != null ? opts.disabled : !this.canBack(app);
      const back = this.backButtonHtml({ id: opts.id || 'pgBackBtn', disabled });
      return `<div class="pgHeadRow">${back}<div class="pgHeadMain">${innerHtml}</div></div>`;
    },

    wire(root, app, onBack, opts = {}) {
      if (!root) return;
      const sel = opts.selector || '#pgBackBtn, .pgBackBtn';
      const btn = root.querySelector(sel);
      if (!btn || btn.dataset.navWired === '1') return;
      btn.dataset.navWired = '1';
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (btn.disabled || btn.classList.contains('is-disabled')) return;
        onBack();
      };
    },

    markActive(app) {
      window.__miniAppNavActive = app;
    },

    clearActive(app) {
      if (window.__miniAppNavActive === app) window.__miniAppNavActive = null;
    }
  };
})();
