/**
 * PokerSwipe Character Engine V1
 * Central asset map + reusable showCharacter API for the Green Monster.
 */
(function () {
  'use strict';

  const BUILD = 'ps-character-v1';

  /** @type {Record<string, {src:string, loop:boolean, aspect:number, pose:string, states:string[]}>} */
  const GREEN_MONSTER_CLIPS = {
    idle: {
      src: 'assets/green-monster/demon-idle.webm',
      loop: true,
      aspect: 720 / 534,
      pose: 'Peeking over table edge, arms crossed, smug grin',
      states: ['idle', 'neutral', 'challenge']
    },
    thinking: {
      src: 'assets/green-monster/demon-thinking.webm',
      loop: true,
      aspect: 720 / 970,
      pose: 'Full body, hand on chin, analytical',
      states: ['thinking', 'waiting']
    },
    success: {
      src: 'assets/green-monster/demon-correct.webm',
      loop: false,
      aspect: 720 / 970,
      pose: 'Thumbs up, wide celebratory grin',
      states: ['success', 'happy', 'celebration', 'correct']
    },
    mistake: {
      src: 'assets/green-monster/demon-wrong.webm',
      loop: false,
      aspect: 1,
      pose: 'Arms crossed, disappointed smirk',
      states: ['mistake', 'wrong', 'confused', 'suboptimal']
    }
  };

  const PLACEMENTS = {
    'table-peek': { clip: 'idle', width: 118, height: 88 },
    'table-right': { clip: 'thinking', width: 128, height: 172 },
    'result-side': { clip: 'success', width: 92, height: 92 },
    'result-compact': { clip: 'mistake', width: 78, height: 78 }
  };

  const STATE_TO_CLIP = {
    idle: 'idle',
    neutral: 'idle',
    challenge: 'idle',
    thinking: 'thinking',
    waiting: 'thinking',
    success: 'success',
    happy: 'success',
    celebration: 'success',
    correct: 'success',
    mistake: 'mistake',
    wrong: 'mistake',
    confused: 'mistake',
    suboptimal: 'mistake'
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

  const preloadCache = new Map();
  const activeVideos = new WeakMap();

  function normalizeState(state) {
    return STATE_TO_CLIP[state] ? state : 'thinking';
  }

  function clipKey(state) {
    return STATE_TO_CLIP[normalizeState(state)] || 'thinking';
  }

  function dialogueFor(screen, state, custom) {
    if (custom) return Array.isArray(custom) ? custom : [custom, ''];
    const ctx = DIALOGUE[screen] || DIALOGUE.sizing;
    const key = normalizeState(state);
    const mapped = ctx[key] || ctx.thinking || ctx.challenge || ['ЗЕЛЁНЫЙ КОМПАНЬОН', ''];
    return mapped;
  }

  function gradeToState(grade, opts = {}) {
    if (grade === 'g' || grade === 'EXCELLENT' || grade === 'GOOD') return 'success';
    if (grade === 'r' || grade === 'MISTAKE' || grade === 'BLUNDER') return 'mistake';
    if (opts.sizeGrade === 'r' || opts.actionGrade === 'r') return 'mistake';
    if (grade === 'y' || grade === 'INACCURACY') return 'suboptimal';
    return 'suboptimal';
  }

  function preloadClip(key) {
    const clip = GREEN_MONSTER_CLIPS[key];
    if (!clip || preloadCache.has(key)) return preloadCache.get(key);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.src = clip.src;
    const task = new Promise((resolve) => {
      const done = () => resolve(video);
      video.addEventListener('loadeddata', done, { once: true });
      video.addEventListener('error', done, { once: true });
    });
    preloadCache.set(key, task);
    return task;
  }

  function preloadStates(states) {
    const keys = new Set((states || ['thinking', 'success', 'mistake']).map(clipKey));
    keys.forEach((k) => preloadClip(k));
  }

  function clearSlot(slot) {
    if (!slot) return;
    const video = activeVideos.get(slot);
    if (video) {
      try { video.pause(); } catch (_) {}
      activeVideos.delete(slot);
    }
    slot.innerHTML = '';
    slot.classList.remove('isReady');
    slot.classList.add('isLoading');
  }

  function mountVideo(slot, state, loopOverride) {
    const key = clipKey(state);
    const clip = GREEN_MONSTER_CLIPS[key];
    if (!clip) return null;

    clearSlot(slot);

    const video = document.createElement('video');
    video.className = 'psCharVideo';
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.loop = loopOverride != null ? loopOverride : clip.loop;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.setAttribute('disablepictureinpicture', '');
    video.setAttribute('aria-hidden', 'true');
    video.src = clip.src;

    video.addEventListener('loadeddata', () => {
      slot.classList.remove('isLoading');
      slot.classList.add('isReady');
      const play = video.play();
      if (play && typeof play.catch === 'function') play.catch(() => {});
    }, { once: true });

    video.addEventListener('ended', () => {
      if (!video.loop && clip.loop) {
        video.loop = true;
        video.play()?.catch?.(() => {});
      }
    });

    slot.appendChild(video);
    activeVideos.set(slot, video);
    preloadClip(key);
    return video;
  }

  function ensureSlot(host, placement) {
    if (!host) return null;
    let slot = host.querySelector(':scope > .psCharSlot');
    if (!slot) {
      slot = document.createElement('div');
      slot.className = 'psCharSlot isLoading';
      slot.dataset.placement = placement;
      slot.dataset.psCharBuild = BUILD;
      host.appendChild(slot);
    } else {
      slot.dataset.placement = placement;
    }
    return slot;
  }

  function showCharacter(opts = {}) {
    const {
      character = 'green-monster',
      state = 'thinking',
      placement = 'table-right',
      host,
      loop,
      screen = 'sizing',
      dialogue,
      showBubble = false,
      bubbleHost
    } = opts;

    if (character !== 'green-monster' || !host) return null;

    const slot = ensureSlot(host, placement);
    mountVideo(slot, state, loop);

    if (!showBubble) return slot;

    const bubbleRoot = bubbleHost || host.parentElement || host;
    let reaction = bubbleRoot.querySelector(':scope > .psCharReaction, .psCharReaction');
    if (!reaction) {
      reaction = document.createElement('div');
      reaction.className = 'psCharReaction';
      reaction.dataset.psCharBuild = BUILD;
      const anchor = bubbleRoot.querySelector('.pgControls, .verdict, .pgVerdictCompact');
      if (anchor) anchor.insertAdjacentElement('beforebegin', reaction);
      else bubbleRoot.appendChild(reaction);
    }

    let sideSlot = reaction.querySelector('.psCharSlot');
    if (!sideSlot) {
      sideSlot = document.createElement('div');
      sideSlot.className = 'psCharSlot isLoading';
      sideSlot.dataset.placement = 'result-side';
      reaction.prepend(sideSlot);
    }
    mountVideo(sideSlot, state, loop);

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
    host.parentElement?.querySelectorAll?.('.psCharReaction')?.forEach((n) => n.remove());
  }

  function mountArenaCharacter(arenaWrap, opts = {}) {
    if (!arenaWrap) return null;
    const state = opts.state || 'thinking';
    const placement = opts.placement || (state === 'idle' || state === 'challenge' ? 'table-peek' : 'table-right');
    preloadStates([state, 'success', 'mistake']);
    return showCharacter({
      ...opts,
      host: arenaWrap,
      placement,
      showBubble: false
    });
  }

  function reactVerdict(verdictEl, grade, screen = 'sizing', opts = {}) {
    if (!verdictEl) return null;
    const state = gradeToState(grade, opts);
    const shell = verdictEl.closest('.pgShell, .panel, #dailyArea, #sizingArea') || verdictEl.parentElement;
    shell?.querySelectorAll('.psCharReaction, .freakCoachReaction')?.forEach((n) => n.remove());
    shell?.querySelectorAll('.pgArenaWrap > .psCharSlot')?.forEach(clearSlot);

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

    mountVideo(slot, state, false);
    preloadClip(clipKey(state === 'success' ? 'thinking' : 'idle'));
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

  function wrapDailyReveal() {
    const base = typeof window.dailyReveal === 'function' ? window.dailyReveal : null;
    if (!base || base.__psCharWrapped) return;
    window.dailyReveal = function dailyRevealWithCharacter() {
      const result = base.apply(this, arguments);
      setTimeout(() => {
        const shell = document.querySelector('#dailyArea');
        const anchor = findDailyReactionAnchor(shell);
        if (!anchor) return;
        reactVerdict(anchor, readGradeFromShell(shell), 'daily', { insertAfter: true });
      }, 0);
      return result;
    };
    window.dailyReveal.__psCharWrapped = true;
  }

  window.PsCharacter = {
    BUILD,
    ASSETS: {
      directory: 'assets/green-monster/',
      character: 'green-monster',
      clips: GREEN_MONSTER_CLIPS,
      placements: PLACEMENTS,
      stateToClip: STATE_TO_CLIP
    },
    showCharacter,
    hideCharacter,
    mountArenaCharacter,
    reactVerdict,
    gradeToState,
    preload: preloadStates,
    dialogueFor,
    wrapDailyReveal
  };

  function watchDailyResults() {
    const area = document.getElementById('dailyArea');
    if (!area || area.dataset.psCharWatch) return;
    area.dataset.psCharWatch = '1';
    const observer = new MutationObserver(() => {
      if (!document.getElementById('daily')?.classList.contains('active')) return;
      const anchor = findDailyReactionAnchor(area);
      if (!anchor || anchor.dataset.psCharReacted) return;
      anchor.dataset.psCharReacted = '1';
      reactVerdict(anchor, readGradeFromShell(area), 'daily', { insertAfter: true });
    });
    observer.observe(area, { childList: true, subtree: true });
  }

  wrapDailyReveal();
  window.addEventListener('load', () => {
    wrapDailyReveal();
    watchDailyResults();
  });
  if (document.readyState !== 'loading') watchDailyResults();
  else document.addEventListener('DOMContentLoaded', watchDailyResults);
})();
