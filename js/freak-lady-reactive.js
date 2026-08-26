// PokerSwipe — Freak Lady reconstructed reactive engine
// Uses window.FREAK_LADY_LIBRARY loaded before this file.
(function(global){
  'use strict';

  const LIB = global.FREAK_LADY_LIBRARY || [];
  const stateToImage = {
    idle: 'assets/freak-lady/idle.png',
    thinking: 'assets/freak-lady/thinking.png',
    correct: 'assets/freak-lady/correct.png',
    skeptical: 'assets/freak-lady/skeptical.png',
    wrong: 'assets/freak-lady/wrong.png',
    streak: 'assets/freak-lady/streak.png',
    g: 'assets/freak-lady/correct.png',
    y: 'assets/freak-lady/skeptical.png',
    r: 'assets/freak-lady/wrong.png'
  };

  const RECENT_LIMIT = 30;
  const state = {
    handCount: 0,
    sessionStats: { correct: 0, yellow: 0, wrong: 0, streak: 0, bestStreak: 0 },
    recoveryMode: false,
    recoveryStreak: 0,
    recentIds: []
  };

  function normalizeGrade(mood){
    if (mood === 'correct') return 'g';
    if (mood === 'skeptical' || mood === 'yellow') return 'y';
    if (mood === 'wrong') return 'r';
    return mood;
  }

  function assetStateFor(mood){
    const n = normalizeGrade(mood);
    if (n === 'g') return 'correct';
    if (n === 'y') return 'skeptical';
    if (n === 'r') return 'wrong';
    if (n === 'thinking') return 'thinking';
    if (n === 'streak') return 'streak';
    return 'idle';
  }

  function cloneState(){
    return JSON.parse(JSON.stringify(state));
  }

  function resetSession(){
    state.handCount = 0;
    state.sessionStats = { correct: 0, yellow: 0, wrong: 0, streak: 0, bestStreak: 0 };
    state.recoveryMode = false;
    state.recoveryStreak = 0;
    state.recentIds = [];
  }

  function resetHistory(){
    state.recentIds = [];
  }

  function recordId(id){
    if (!id) return;
    state.recentIds.push(id);
    if (state.recentIds.length > RECENT_LIMIT) state.recentIds.splice(0, state.recentIds.length - RECENT_LIMIT);
  }

  function contextPool(context){
    if (context === 'session') return LIB.filter(x => x.context === 'session');
    return LIB.filter(x => x.context === context);
  }

  function categoryMatchesConcept(item, concept){
    if (!concept) return false;
    return item.category === concept || item.leakConcept === concept;
  }

  function getEligiblePool(grade, context='swipe', opts={}){
    const g = normalizeGrade(grade);
    let pool = contextPool(context);

    if (context !== 'session') {
      pool = pool.filter(x => x.grade === g);
    }

    if (opts.isRepeatedLeak && (opts.leakConcept || opts.concept)) {
      const leak = opts.leakConcept || opts.concept;
      const exactLeak = pool.filter(x => x.category === 'repeated_leak' && x.leakConcept === leak);
      if (exactLeak.length) return exactLeak;
    }

    if (g === 'r' && Number(opts.confidence) >= 70) {
      const p = pool.filter(x => x.category === 'confidently_wrong');
      if (p.length) return p;
    }

    if (g === 'g' && Number(opts.confidence) < 40 && opts.confidence !== undefined && opts.confidence !== null) {
      const p = pool.filter(x => x.category === 'low_confidence');
      if (p.length) return p;
    }

    if (opts.concept) {
      const p = pool.filter(x => categoryMatchesConcept(x, opts.concept));
      if (p.length) pool = p;
    }

    if (opts.action) {
      const exactAction = pool.filter(x => !x.action || x.action === opts.action);
      if (exactAction.length) pool = exactAction;
    }

    return pool;
  }

  function pickFresh(pool){
    if (!pool.length) return null;
    const fresh = pool.filter(x => !state.recentIds.includes(x.id));
    const source = fresh.length ? fresh : pool;
    return source[Math.floor(Math.random() * source.length)];
  }

  function selectPhrase(grade, context='swipe', opts={}){
    const g = normalizeGrade(grade);

    if (opts.forceComeback) {
      const c = pickFresh(LIB.filter(x => x.context === context && x.category === 'comeback' && x.grade === 'g'));
      if (c) { recordId(c.id); return c; }
    }

    if (opts.forceStreak || grade === 'streak') {
      const s = pickFresh(LIB.filter(x => x.context === context && x.category === 'streak' && x.grade === 'g'));
      if (s) { recordId(s.id); return s; }
    }

    let pool = getEligiblePool(g, context, opts);

    if (!pool.length && context !== 'session') {
      pool = LIB.filter(x => x.context === context && x.grade === g && x.category === 'generic');
    }
    if (!pool.length) {
      pool = LIB.filter(x => x.context === context && x.grade === g);
    }
    if (!pool.length) {
      pool = LIB.filter(x => x.grade === g && x.context !== 'session');
    }

    const phrase = pickFresh(pool);
    if (phrase) recordId(phrase.id);
    return phrase;
  }

  function updateStats(grade){
    const g = normalizeGrade(grade);
    if (!['g','y','r'].includes(g)) return { comeback:false, streak:false };

    state.handCount += 1;

    if (g === 'g') {
      state.sessionStats.correct += 1;
      state.sessionStats.streak += 1;
      state.sessionStats.bestStreak = Math.max(state.sessionStats.bestStreak, state.sessionStats.streak);

      let comeback = false;
      if (state.recoveryMode) {
        state.recoveryStreak += 1;
        if (state.recoveryStreak >= 3) {
          comeback = true;
          state.recoveryMode = false;
          state.recoveryStreak = 0;
        }
      }

      const streak = state.sessionStats.streak >= 6;
      return { comeback, streak };
    }

    if (g === 'y') {
      state.sessionStats.yellow += 1;
      state.sessionStats.streak = 0;
      if (state.recoveryMode) state.recoveryStreak = 0;
      return { comeback:false, streak:false };
    }

    state.sessionStats.wrong += 1;
    state.sessionStats.streak = 0;
    state.recoveryStreak = 0;
    if (state.sessionStats.wrong >= 3) state.recoveryMode = true;
    return { comeback:false, streak:false };
  }

  function makeImage(stateName){
    const img = document.createElement('img');
    img.className = 'freakCoachAvatar';
    img.src = stateToImage[stateName] || stateToImage.idle;
    img.dataset.freakState = stateName;
    img.alt = `Фриковая Дама: ${stateName}`;
    img.draggable = false;
    img.onerror = function(){
      if (this.dataset.fallbackApplied === '1') return;
      this.dataset.fallbackApplied = '1';
      this.src = stateToImage.idle;
    };
    return img;
  }

  function phraseMeta(phrase, visualState){
    const category = phrase?.category || visualState;
    const text = phrase?.text || (visualState === 'thinking' ? 'Смотрю.' : 'Фриковая Дама');
    const label = String(category).replaceAll('_', ' ').toUpperCase();
    return { category, text, label };
  }

  function renderReaction(target, phrase, visualState, opts={}){
    if (!target || !target.isConnected) return null;

    const layout = opts.layout || 'compact';
    if (layout !== 'compact') {
      return renderComposition(target, phrase, visualState, opts);
    }

    const prior = target.querySelector(':scope > .freakCoachReaction, :scope > .psCharCompose');
    if (prior) prior.remove();

    const row = document.createElement('div');
    row.className = 'freakCoachReaction' + (opts.wide ? ' freakCoachWide' : '') + (visualState === 'thinking' ? ' freakCoachThinking' : '');
    row.dataset.mood = visualState;
    row.setAttribute('aria-label', 'Реакция Фриковой Дамы');

    const avatar = document.createElement('div');
    avatar.className = 'freakCoachAvatarWrap';
    avatar.appendChild(makeImage(visualState));

    const copy = document.createElement('div');
    copy.className = 'freakCoachCopy';
    const meta = phraseMeta(phrase, visualState);
    copy.innerHTML = `<span class="ey">ФРИКОВАЯ ДАМА · ${meta.label}</span><strong></strong>`;
    copy.querySelector('strong').textContent = meta.text;

    row.append(avatar, copy);

    const button = target.querySelector(':scope > .primary, :scope > .secondary, :scope > button.primary, :scope > button.secondary, #holdArea');
    if (button) target.insertBefore(row, button);
    else target.appendChild(row);

    return row;
  }

  function renderSceneComposition(target, phrase, visualState, opts={}){
    const side = opts.side === 'left' ? 'left' : 'right';
    const meta = phraseMeta(phrase, visualState);

    const row = document.createElement('div');
    row.className = `psCharCompose psCharCompose--scene psCharCompose--${side} mood-${visualState}`;
    if (opts.wide) row.classList.add('psCharCompose--wide');
    row.dataset.mood = visualState;
    row.setAttribute('aria-label', 'Реакция Фриковой Дамы');

    const art = document.createElement('div');
    art.className = 'psCharCompose__art';
    art.appendChild(makeImage(visualState));

    const bubble = document.createElement('div');
    bubble.className = 'psCharCompose__bubble';
    bubble.innerHTML = `<span class="ey psCharCompose__ey">ФРИКОВАЯ ДАМА · ${meta.label}</span><strong class="psCharCompose__text"></strong>`;
    bubble.querySelector('.psCharCompose__text').textContent = meta.text;

    if (opts.headline) {
      const head = document.createElement('div');
      head.className = 'psCharCompose__headline';
      head.innerHTML = opts.headline;
      bubble.insertBefore(head, bubble.firstChild);
    }

    row.append(bubble, art);

    const replace = opts.replace === true;
    if (replace) {
      target.innerHTML = '';
      target.appendChild(row);
    } else {
      const button = target.querySelector(':scope > .primary, :scope > .secondary, :scope > button.primary, :scope > button.secondary, #holdArea, .v31VerdictCTA');
      if (button) target.insertBefore(row, button);
      else target.appendChild(row);
    }

    requestAnimationFrame(() => row.classList.add('psCharCompose--in'));
    return row;
  }

  function renderComposition(target, phrase, visualState, opts={}){
    if (!target || !target.isConnected) return null;

    const prior = target.querySelector(':scope > .freakCoachReaction, :scope > .psCharCompose');
    if (prior) prior.remove();

    const layout = opts.layout || 'coach';
    if (layout === 'scene' || layout === 'result' || layout === 'analysis' || layout === 'hero') {
      return renderSceneComposition(target, phrase, visualState, { ...opts, layout: 'scene' });
    }

    const side = opts.side === 'left' ? 'left' : 'right';
    const meta = phraseMeta(phrase, visualState);

    const row = document.createElement('div');
    row.className = `psCharCompose psCharCompose--${layout} psCharCompose--${side} mood-${visualState}`;
    if (opts.wide) row.classList.add('psCharCompose--wide');
    row.dataset.mood = visualState;
    row.setAttribute('aria-label', 'Реакция Фриковой Дамы');

    const art = document.createElement('div');
    art.className = 'psCharCompose__art';
    art.appendChild(makeImage(visualState));

    const panel = document.createElement('div');
    panel.className = 'psCharCompose__panel';
    panel.innerHTML = `<span class="ey psCharCompose__ey">ФРИКОВАЯ ДАМА · ${meta.label}</span><strong class="psCharCompose__text"></strong>`;
    panel.querySelector('.psCharCompose__text').textContent = meta.text;

    if (opts.headline) {
      const head = document.createElement('div');
      head.className = 'psCharCompose__headline';
      head.innerHTML = opts.headline;
      panel.insertBefore(head, panel.firstChild);
    }

    if (side === 'left') row.append(art, panel);
    else row.append(panel, art);

    const replace = opts.replace === true;
    if (replace) {
      target.innerHTML = '';
      target.appendChild(row);
    } else {
      const button = target.querySelector(':scope > .primary, :scope > .secondary, :scope > button.primary, :scope > button.secondary, #holdArea, .v31VerdictCTA');
      if (button) target.insertBefore(row, button);
      else target.appendChild(row);
    }

    requestAnimationFrame(() => row.classList.add('psCharCompose--in'));
    return row;
  }

  function mountComposition(target, opts={}){
    const mood = opts.mood || 'thinking';
    const context = opts.context || 'swipe';
    const n = normalizeGrade(mood);

    if (n === 'thinking') {
      return renderComposition(target, { category: 'thinking', text: opts.text || 'Смотрю.' }, 'thinking', opts);
    }

    const phrase = selectPhrase(n, context, opts);
    const visualState = opts.visualState || assetStateFor(n);
    return renderComposition(target, phrase, visualState, opts);
  }

  function react(target, mood='thinking', context='swipe', opts={}){
    const n = normalizeGrade(mood);

    if (n === 'thinking') {
      return renderReaction(target, { category:'thinking', text: opts.text || 'Смотрю.' }, 'thinking', opts);
    }

    if (n === 'streak') {
      const phrase = selectPhrase('g', context, { ...opts, forceStreak:true });
      return renderReaction(target, phrase, 'streak', opts);
    }

    const flags = updateStats(n);

    let phrase;
    let visualState = assetStateFor(n);

    if (flags.comeback) {
      phrase = selectPhrase('g', context, { ...opts, forceComeback:true });
      visualState = 'correct';
    } else if (flags.streak) {
      phrase = selectPhrase('g', context, { ...opts, forceStreak:true });
      visualState = 'streak';
    } else {
      phrase = selectPhrase(n, context, opts);
    }

    return renderReaction(target, phrase, visualState, opts);
  }

  function getSessionSummary(){
    const s = state.sessionStats;
    const total = s.correct + s.yellow + s.wrong;
    const accuracy = total ? s.correct / total : 0;
    let category = 'session_bad';
    if (accuracy >= .8 && s.wrong <= 1) category = 'session_excellent';
    else if (accuracy >= .6) category = 'session_good';
    else if (accuracy >= .4) category = 'session_medium';

    const pool = LIB.filter(x => x.context === 'session' && x.category === category);
    return {
      category,
      phrase: pickFresh(pool),
      stats: cloneState().sessionStats
    };
  }

  function play(target, mood){
    if (target && target.tagName === 'IMG') {
      const s = assetStateFor(mood);
      target.src = stateToImage[s] || stateToImage.idle;
      target.dataset.freakState = s;
    }
    return Promise.resolve();
  }

  function sessionMood(g, y, r){
    if (g >= 8 && r <= 1) return 'streak';
    if (r >= 4) return 'r';
    if (y >= 4 || r >= 2) return 'y';
    return 'g';
  }

  const api = {
    react,
    play,
    mountComposition,
    getSessionSummary,
    sessionMood,
    assets: stateToImage,
    debug: {
      selectPhrase,
      getEligiblePool,
      resetSession,
      resetHistory,
      getState: cloneState
    }
  };

  global.FreakLady = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
