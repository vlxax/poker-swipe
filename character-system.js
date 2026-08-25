/**
 * PokerSwipe Character System V2
 * Unified API for FreakLady (coach/analysis) and Green Monster (companion/emotion)
 * Semantic state → character selection → rendering + speech
 */
(function() {
  'use strict';

  // ======================
  // ASSET REGISTRY
  // ======================
  const CHARACTERS = {
    FREAK_LADY: 'freak-lady',
    MONSTER: 'monster'
  };

  const SEMANTIC_STATES = {
    // Positive feedback
    CORRECT: { char: CHARACTERS.FREAK_LADY, mood: 'correct', emoji: '✓' },
    SUCCESS: { char: CHARACTERS.FREAK_LADY, mood: 'correct', emoji: '✓' },

    // Negative feedback
    WRONG: { char: CHARACTERS.FREAK_LADY, mood: 'wrong', emoji: '✕' },
    ERROR: { char: CHARACTERS.FREAK_LADY, mood: 'wrong', emoji: '✕' },

    // Caution/borderline
    SKEPTICAL: { char: CHARACTERS.FREAK_LADY, mood: 'skeptical', emoji: '⚠' },
    WARNING: { char: CHARACTERS.FREAK_LADY, mood: 'skeptical', emoji: '⚠' },
    BORDERLINE: { char: CHARACTERS.FREAK_LADY, mood: 'skeptical', emoji: '⚠' },

    // Analysis/thinking
    THINKING: { char: CHARACTERS.FREAK_LADY, mood: 'thinking', emoji: '◯' },
    ANALYZING: { char: CHARACTERS.FREAK_LADY, mood: 'thinking', emoji: '◯' },

    // Celebration
    STREAK: { char: CHARACTERS.FREAK_LADY, mood: 'streak', emoji: '⚡' },
    CELEBRATION: { char: CHARACTERS.FREAK_LADY, mood: 'streak', emoji: '⚡' },

    // Idle/neutral
    IDLE: { char: CHARACTERS.FREAK_LADY, mood: 'idle', emoji: '○' },
    NEUTRAL: { char: CHARACTERS.FREAK_LADY, mood: 'idle', emoji: '○' }
  };

  // Grade-to-state mapping (g=good, y=yellow/borderline, r=red/error)
  const GRADE_TO_STATE = {
    g: 'CORRECT',
    y: 'SKEPTICAL',
    r: 'WRONG'
  };

  // Context-specific dialogue (maintains backward compatibility)
  const DIALOGUE = {
    swipe: {
      g: ['ЧИСТО', 'Я даже спорить не буду.'],
      y: ['ЖИВЁТ', 'Но тонко. Не расслабляйся.'],
      r: ['ОШИБКА', 'Вот здесь уже дорого.']
    },
    sizing: {
      g: ['САЙЗИНГ СЕЛ', 'Банк не вырос раньше причины.'],
      y: ['ЖИВЁТ', 'Размер уже просит адвоката.'],
      r: ['ПЕРЕБОР', 'Сначала причина. Потом большой банк.']
    },
    daily: {
      g: ['СОШЛОСЬ', 'Логика неприятно хорошо собралась.'],
      y: ['ЕСТЬ РАБОТА', 'Часть аргументов живёт. Часть уже в суде.'],
      r: ['ДОКРУЧИ', 'Решение есть. Архитектуры пока нет.']
    },
    review: {
      g: ['НАШЛА', 'Место преступления определено.'],
      y: ['ПОЧТИ', 'Починилось, но швы ещё видно.'],
      r: ['МИМО', 'Следствие ушло не по той улице.']
    },
    solver: {
      thinking: ['СЧИТАЮ EV', 'Не мешай взрослым числам.'],
      g: ['SOLVER ДОВОЛЕН', 'Повода для драмы почти нет.'],
      y: ['ТОНКО', 'Не катастрофа, но деньги уже шуршат.'],
      r: ['EV УЕХАЛ', 'Вот здесь ошибка уже стоит денег.']
    },
    session: {
      streak: ['СЕРИЯ', 'Прилично. Не привыкай.'],
      g: ['СЕССИЯ ЧИСТАЯ', 'Подозрительно хорошо.'],
      y: ['ЖИВЁШЬ', 'Слишком много пограничного.'],
      r: ['ЛИК НАЙДЕН', 'Кажется, у нас появился любимый способ терять EV.']
    }
  };

  // ======================
  // SIZING MODES
  // ======================
  const SIZING_MODES = {
    REACTION: { minWidth: 56, maxWidth: 100, label: 'Contextual response' },
    COACH: { minWidth: 120, maxWidth: 220, label: 'Integrated coaching' },
    HERO: { minWidth: 220, maxWidth: 400, label: 'Major moments' }
  };

  // ======================
  // INTERNAL STATE
  // ======================
  const activeCharacters = new Map(); // host → character state
  const preloadedAssets = new Map(); // asset key → loaded status
  let renderMode = 'composition'; // 'composition' or 'simple'

  // ======================
  // HELPER FUNCTIONS
  // ======================

  function normalizeState(state) {
    const key = String(state).toUpperCase();
    return SEMANTIC_STATES[key] || SEMANTIC_STATES.THINKING;
  }

  function gradeToSemanticState(grade) {
    return GRADE_TO_STATE[grade] || 'THINKING';
  }

  function getDialogue(context, mood) {
    const ctx = DIALOGUE[context] || DIALOGUE.swipe;

    // Handle mood objects
    if (typeof mood === 'object' && mood.mood) {
      const m = mood.mood;
      if (ctx[m]) return ctx[m];
      if (ctx['g'] && m === 'correct') return ctx['g'];
      if (ctx['y'] && m === 'skeptical') return ctx['y'];
      if (ctx['r'] && m === 'wrong') return ctx['r'];
    }

    // Handle string moods
    if (ctx[mood]) return ctx[mood];
    if (mood === 'correct' && ctx['g']) return ctx['g'];
    if (mood === 'skeptical' && ctx['y']) return ctx['y'];
    if (mood === 'wrong' && ctx['r']) return ctx['r'];
    if (mood === 'thinking' && ctx.thinking) return ctx.thinking;
    if (mood === 'streak' && ctx.streak) return ctx.streak;

    return ctx.thinking || ctx.g || ['ФРИКОВАЯ ДАМА', 'Смотрю.'];
  }

  function canPreferReducedMotion() {
    return window.matchMedia &&
           window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  // ======================
  // CHARACTER RENDERING
  // ======================

  /**
   * Render FreakLady using existing freak-lady-reactive.js
   */
  function renderFreakLady(container, mood, context, options = {}) {
    if (!window.FreakLady?.react) return null;

    const normalizedMood = typeof mood === 'object' ? mood.mood : mood;
    const state = SEMANTIC_STATES[normalizeState(mood).stateKey] || normalizeState(mood);

    // FreakLady.react handles the rendering
    return window.FreakLady.react(
      container,
      normalizedMood || state.mood || 'thinking',
      context,
      options
    );
  }

  /**
   * Render speech bubble
   */
  function renderSpeechBubble(container, dialogue, options = {}) {
    const [title, body] = dialogue;
    const bubble = document.createElement('div');
    bubble.className = 'ps-speech-bubble';
    bubble.setAttribute('data-bubble-type', options.type || 'inline');

    bubble.innerHTML = `
      <div class="ps-bubble-header">
        <span class="ey ps-bubble-title">${title}</span>
      </div>
      <div class="ps-bubble-body">
        <strong>${body}</strong>
      </div>
    `;

    if (options.fade) {
      bubble.classList.add('ps-bubble-fade');
    }

    return bubble;
  }

  // ======================
  // PUBLIC API
  // ======================

  /**
   * Show character reaction to a verdict
   * @param {Element} container - Where to render the reaction
   * @param {string} grade - 'g', 'y', or 'r'
   * @param {string} context - 'swipe', 'sizing', 'daily', etc
   * @param {Object} options - Additional options (wide, custom dialogue, etc)
   */
  function reactToVerdict(container, grade, context = 'swipe', options = {}) {
    if (!container || !container.isConnected) return null;

    // Remove any existing reactions to prevent duplicates
    const existing = container.querySelector(':scope > .ps-character-reaction, :scope > .freakCoachReaction');
    if (existing) existing.remove();

    const semanticState = gradeToSemanticState(grade);
    const stateInfo = SEMANTIC_STATES[semanticState];

    // Render using FreakLady (currently the main character)
    const reaction = renderFreakLady(
      container,
      stateInfo.mood,
      context,
      { wide: options.wide }
    );

    if (reaction) {
      reaction.classList.add('ps-character-reaction');
      reaction.dataset.grade = grade;
      reaction.dataset.context = context;
    }

    return reaction;
  }

  /**
   * Show character with sizing mode
   * @param {Element} host - Container
   * @param {string} mode - 'REACTION', 'COACH', or 'HERO'
   * @param {string} state - Semantic state (CORRECT, WRONG, THINKING, etc)
   * @param {Object} options - Additional options
   */
  function showCharacter(host, mode = 'REACTION', state = 'IDLE', options = {}) {
    if (!host || !host.isConnected) return null;

    const sizing = SIZING_MODES[mode] || SIZING_MODES.REACTION;
    const stateInfo = normalizeState(state);

    const wrapper = document.createElement('div');
    wrapper.className = 'ps-character-container';
    wrapper.dataset.mode = mode;
    wrapper.dataset.state = state;
    wrapper.style.minHeight = sizing.minWidth + 'px';

    // Render character
    const charDiv = document.createElement('div');
    charDiv.className = 'ps-character-display';
    wrapper.appendChild(charDiv);

    // Use FreakLady as main character
    renderFreakLady(charDiv, stateInfo.mood, options.context || 'swipe');

    // Add speech if provided
    if (options.dialogue) {
      const bubble = renderSpeechBubble(options.dialogue, { type: mode.toLowerCase() });
      wrapper.appendChild(bubble);
    }

    host.appendChild(wrapper);
    activeCharacters.set(host, { mode, state, element: wrapper });

    return wrapper;
  }

  /**
   * Hide all characters from a container
   */
  function hideCharacter(host) {
    if (!host) return;

    host.querySelectorAll('.ps-character-container').forEach(el => {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.3s ease-out';
      setTimeout(() => el.remove(), 300);
    });

    activeCharacters.delete(host);
  }

  /**
   * Clear all characters
   */
  function clear() {
    document.querySelectorAll('.ps-character-container, .ps-character-reaction').forEach(el => {
      el.remove();
    });
    activeCharacters.clear();
  }

  /**
   * Preload assets
   */
  function preload(states = []) {
    // FreakLady preloading happens automatically via freak-lady-reactive.js
    if (!window.FreakLady?.play) return Promise.resolve();

    const moods = states
      .map(s => normalizeState(s).mood)
      .filter(Boolean);

    const promises = moods.map(mood =>
      new Promise(resolve => {
        try {
          window.FreakLady.play(document.createElement('canvas'), mood, false);
          resolve();
        } catch (e) {
          resolve(); // Graceful failure
        }
      })
    );

    return Promise.all(promises);
  }

  /**
   * Set system-wide render mode
   */
  function setRenderMode(mode) {
    renderMode = mode;
  }

  // ======================
  // EXPORT API
  // ======================

  window.CharacterSystem = {
    // Public methods
    reactToVerdict,
    showCharacter,
    hideCharacter,
    clear,
    preload,
    setRenderMode,

    // Constants
    CHARACTERS,
    SEMANTIC_STATES,
    SIZING_MODES,
    GRADE_TO_STATE,
    DIALOGUE,

    // Utilities
    normalizeState,
    gradeToSemanticState,
    getDialogue,
    canPreferReducedMotion
  };

  // ======================
  // INITIALIZATION
  // ======================

  // Hook into existing verdict flows to prevent character duplication bugs
  if (typeof window.finalizeSwipe === 'function') {
    const originalFinalizeSwipe = window.finalizeSwipe;
    window.finalizeSwipe = function(s, a, size) {
      const result = originalFinalizeSwipe.call(this, s, a, size);
      // Character rendering is handled by FreakLady.react() in original
      return result;
    };
  }

  console.log('[CharacterSystem] Initialized with FreakLady integration');
})();
