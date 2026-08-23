/**
 * PokerSwipe Character Engine V1
 * Reusable character API. UI renders static transparent PNGs only.
 * WEBM clips remain mapped for future alpha exports but are never mounted in UI.
 */
(function () {
  'use strict';

  const BUILD = 'ps-character-v1-static';

  /** Legacy WEBM map — not used in live UI (yuv420p black matte). */
  const GREEN_MONSTER_CLIPS = {
    idle: { src: 'assets/green-monster/demon-idle.webm', loop: true },
    thinking: { src: 'assets/green-monster/demon-thinking.webm', loop: true },
    success: { src: 'assets/green-monster/demon-correct.webm', loop: false },
    mistake: { src: 'assets/green-monster/demon-wrong.webm', loop: false }
  };

  /** Transparent PNG sprites suitable for in-UI placement. */
  const GREEN_MONSTER_IMAGES = {
    idle: {
      src: 'assets/daily-hand/demon-cards-v2.png',
      pose: 'Gesturing with cards, challenge / thinking'
    },
    thinking: {
      src: 'assets/daily-hand/demon-cards-v2.png',
      pose: 'Gesturing with cards, analytical'
    },
    challenge: {
      src: 'assets/daily-hand/demon-cards-v2.png',
      pose: 'Gesturing with cards, daily hero'
    },
    success: {
      src: 'assets/my-tournaments/winner-demon-v3.png',
      pose: 'Celebratory winner with trophy'
    },
    mistake: {
      src: 'assets/daily-hand/dino-poster.png',
      pose: 'Compact smug grin, suboptimal / wrong'
    },
    suboptimal: {
      src: 'assets/daily-hand/dino-poster.png',
      pose: 'Compact smug grin, borderline'
    }
  };

  const UI_ENABLED = Object.values(GREEN_MONSTER_IMAGES).some((x) => x?.src);

  const PLACEMENTS = {
    'controls-hero': { width: 72, height: 72 },
    'controls-corner': { width: 64, height: 64 },
    'result-side': { width: 72, height: 72 },
    'result-compact': { width: 64, height: 64 }
  };

  const STATE_TO_CLIP = {
    idle: 'idle',
    neutral: 'idle',
    challenge: 'challenge',
    thinking: 'thinking',
    waiting: 'thinking',
    success: 'success',
    happy: 'success',
    celebration: 'success',
    correct: 'success',
    mistake: 'mistake',
    wrong: 'mistake',
    confused: 'mistake',
    suboptimal: 'suboptimal'
  };

  const DIALOGUE = {
    daily: {
      idle: ['ЗЕЛЁНЫЙ КОМПАНЬОН', 'Одна рука. Одно решение.'],
      challenge: ['ЗЕЛЁНЫЙ КОМПАНЬОН', 'Смотрим, что ты сделаешь.'],
      thinking: ['ЗЕЛЁНЫЙ КОМПАНЬОН', 'Думай. Потом жми.'],
      success: ['ЗЕЛЁНЫЙ КОМПАНЬОН', 'Вот это уже похоже на покер.'],
      suboptimal: ['ЗЕЛЁНЫЙ КОМПАНЬОН', 'Размер нормальный. Причина — нет.'],
      mistake: ['ЗЕЛЁНЫЙ КОМПАНЬОН', 'Тут ты переборщила.']
    },
    sizing: {
      thinking: ['ЗЕЛЁНЫЙ КОМПАНЬОН', 'Какой сайз?'],
      challenge: ['ЗЕЛЁНЫЙ КОМПАНЬОН', 'Какой сайз?'],
      success: ['ЗЕЛЁНЫЙ КОМПАНЬОН', 'Сайз нормальный.'],
      suboptimal: ['ЗЕЛЁНЫЙ КОМПАНЬОН', 'Размер нормальный. Причина — нет.'],
      mistake: ['ЗЕЛЁНЫЙ КОМПАНЬОН', 'Тут ты переборщила.']
    }
  };

  function normalizeState(state) {
    return STATE_TO_CLIP[state] ? state : 'thinking';
  }

  function imageKey(state) {
    return STATE_TO_CLIP[normalizeState(state)] || 'thinking';
  }

  function imageFor(state) {
    return GREEN_MONSTER_IMAGES[imageKey(state)] || GREEN_MONSTER_IMAGES.thinking;
  }

  function dialogueFor(screen, state, custom) {
    if (custom) return Array.isArray(custom) ? custom : [custom, ''];
    const ctx = DIALOGUE[screen] || DIALOGUE.sizing;
    const key = normalizeState(state);
    return ctx[key] || ctx.thinking || ctx.challenge || ['ЗЕЛЁНЫЙ КОМПАНЬОН', ''];
  }

  function gradeToState(grade, opts = {}) {
    if (grade === 'g' || grade === 'EXCELLENT' || grade === 'GOOD') return 'success';
    if (grade === 'r' || grade === 'MISTAKE' || grade === 'BLUNDER') return 'mistake';
    if (opts.sizeGrade === 'r' || opts.actionGrade === 'r') return 'mistake';
    if (grade === 'y' || grade === 'INACCURACY') return 'suboptimal';
    return 'suboptimal';
  }

  function clearSlot(slot) {
    if (!slot) return;
    slot.innerHTML = '';
    slot.classList.remove('isReady');
    slot.classList.add('isLoading');
  }

  function mountImage(slot, state) {
    const asset = imageFor(state);
    if (!asset?.src) return null;
    clearSlot(slot);
    const img = document.createElement('img');
    img.className = 'psCharImage';
    img.alt = '';
    img.decoding = 'async';
    img.loading = 'lazy';
    img.src = asset.src;
    img.addEventListener('load', () => {
      slot.classList.remove('isLoading');
      slot.classList.add('isReady');
    }, { once: true });
    img.addEventListener('error', () => {
      slot.classList.remove('isReady');
      slot.classList.add('isLoading');
    }, { once: true });
    slot.appendChild(img);
    if (img.complete && img.naturalWidth) slot.classList.replace('isLoading', 'isReady');
    return img;
  }

  function controlsHost(shellOrWrap) {
    if (!shellOrWrap) return null;
    return shellOrWrap.querySelector?.('.pgControls')
      || shellOrWrap.closest?.('.pgShell')?.querySelector('.pgControls')
      || (shellOrWrap.classList?.contains('pgControls') ? shellOrWrap : null);
  }

  function ensureSlot(host, placement) {
    if (!host) return null;
    let slot = host.querySelector(':scope > .psCharSlot');
    if (!slot) {
      slot = document.createElement('div');
      slot.className = 'psCharSlot isLoading';
      slot.dataset.placement = placement;
      slot.dataset.psCharBuild = BUILD;
      host.prepend(slot);
    } else {
      slot.dataset.placement = placement;
    }
    return slot;
  }

  function showCharacter(opts = {}) {
    if (!UI_ENABLED) return null;
    const {
      state = 'thinking',
      placement = 'controls-corner',
      host,
      screen = 'sizing',
      dialogue,
      showBubble = false,
      bubbleHost
    } = opts;
    if (!host) return null;

    const slot = ensureSlot(host, placement);
    mountImage(slot, state);

    if (!showBubble) return slot;

    const bubbleRoot = bubbleHost || host;
    let reaction = bubbleRoot.querySelector(':scope > .psCharReaction');
    if (!reaction) {
      reaction = document.createElement('div');
      reaction.className = 'psCharReaction';
      reaction.dataset.psCharBuild = BUILD;
      host.appendChild(reaction);
    }
    let sideSlot = reaction.querySelector('.psCharSlot');
    if (!sideSlot) {
      sideSlot = document.createElement('div');
      sideSlot.className = 'psCharSlot isLoading';
      sideSlot.dataset.placement = 'result-side';
      reaction.prepend(sideSlot);
    }
    mountImage(sideSlot, state);
    const [ey, body] = dialogueFor(screen, state, dialogue);
    let bubble = reaction.querySelector('.psCharBubble');
    if (!bubble) {
      bubble = document.createElement('div');
      bubble.className = 'psCharBubble';
      reaction.appendChild(bubble);
    }
    bubble.innerHTML = `<span class="ey">${ey}</span><strong>${body}</strong>`;
    return { slot, reaction, bubble };
  }

  function hideCharacter(host) {
    if (!host) return;
    host.querySelectorAll('.psCharSlot').forEach(clearSlot);
    host.querySelectorAll('.psCharReaction').forEach((n) => n.remove());
  }

  function mountArenaCharacter(arenaWrap, opts = {}) {
    if (!UI_ENABLED) return null;
    const controls = controlsHost(arenaWrap);
    if (!controls) return null;
    const state = opts.state || 'thinking';
    const placement = opts.placement
      || (state === 'idle' || state === 'challenge' ? 'controls-hero' : 'controls-corner');
    return showCharacter({
      ...opts,
      host: controls,
      placement,
      showBubble: false
    });
  }

  function reactVerdict(verdictEl, grade, screen = 'sizing', opts = {}) {
    if (!UI_ENABLED || !verdictEl) return null;
    const state = gradeToState(grade, opts);
    const shell = verdictEl.closest('.pgShell, .panel, #dailyArea, #sizingArea') || verdictEl.parentElement;
    shell?.querySelectorAll('.psCharReaction, .freakCoachReaction')?.forEach((n) => n.remove());
    shell?.querySelectorAll('.psCharSlot').forEach(clearSlot);

    const [ey, body] = dialogueFor(screen, state, opts.dialogue);
    const reaction = document.createElement('div');
    reaction.className = 'psCharReaction';
    reaction.dataset.psCharBuild = BUILD;
    reaction.dataset.grade = String(grade || '');

    const slot = document.createElement('div');
    slot.className = 'psCharSlot isLoading';
    slot.dataset.placement = 'result-side';

    const bubble = document.createElement('div');
    bubble.className = 'psCharBubble';
    bubble.innerHTML = `<span class="ey">${ey}</span><strong>${body}</strong>`;

    reaction.append(slot, bubble);

    if (opts.insertAfter || verdictEl.classList.contains('dualGrade')) {
      verdictEl.insertAdjacentElement('afterend', reaction);
    } else {
      verdictEl.insertAdjacentElement('beforebegin', reaction);
    }

    mountImage(slot, state);
    return reaction;
  }

  function findDailyReactionAnchor(area) {
    return area?.querySelector('.verdict, .pgVerdictCompact, .dualGrade');
  }

  function readGradeFromShell(shell) {
    const boxes = shell?.querySelectorAll('.gradeBox') || [];
    let cls = 'y';
    for (const box of boxes) {
      if (box.classList.contains('r')) return 'r';
      if (box.classList.contains('y')) cls = 'y';
      if (box.classList.contains('g') && cls !== 'r') cls = 'g';
    }
    return cls;
  }

  function decorateDailyFeedback(area) {
    if (!UI_ENABLED || !area) return;
    const anchor = findDailyReactionAnchor(area);
    if (!anchor || anchor.dataset.psCharReacted) return;
    anchor.dataset.psCharReacted = '1';
    reactVerdict(anchor, readGradeFromShell(area), 'daily', { insertAfter: true });
  }

  function wrapDailyReveal() {
    const base = typeof window.dailyReveal === 'function' ? window.dailyReveal : null;
    if (!base || base.__psCharWrapped || !UI_ENABLED) return;
    window.dailyReveal = function dailyRevealWithCharacter() {
      const result = base.apply(this, arguments);
      setTimeout(() => decorateDailyFeedback(document.querySelector('#dailyArea')), 0);
      return result;
    };
    window.dailyReveal.__psCharWrapped = true;
  }

  function watchDailyResults() {
    if (!UI_ENABLED) return;
    const area = document.getElementById('dailyArea');
    if (!area || area.dataset.psCharWatch) return;
    area.dataset.psCharWatch = '1';
    const observer = new MutationObserver(() => {
      if (!document.getElementById('daily')?.classList.contains('active')) return;
      decorateDailyFeedback(area);
    });
    observer.observe(area, { childList: true, subtree: true });
  }

  window.PsCharacter = {
    BUILD,
    UI_ENABLED,
    ASSETS: {
      directory: 'assets/daily-hand/',
      character: 'green-monster',
      clips: GREEN_MONSTER_CLIPS,
      images: GREEN_MONSTER_IMAGES,
      placements: PLACEMENTS,
      stateToClip: STATE_TO_CLIP,
      uiMedia: 'static-png'
    },
    showCharacter,
    hideCharacter,
    mountArenaCharacter,
    reactVerdict,
    gradeToState,
    preload() {},
    dialogueFor,
    wrapDailyReveal
  };

  wrapDailyReveal();
  window.addEventListener('load', () => {
    wrapDailyReveal();
    watchDailyResults();
  });
  if (document.readyState !== 'loading') watchDailyResults();
  else document.addEventListener('DOMContentLoaded', watchDailyResults);
})();
