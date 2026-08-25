// Range Battleship DOM renderer — mobile-first, PokerSwipe dark/lime shell.

import { RANKS, handCode } from './matrixUtils.js';
import { formatStackLabel } from './courses.js';
import { courseLabel } from './trainerRangeModel.js';
import { isOpen } from './trainerRangeModel.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function headWithBack(titleHtml, app, disabled = false) {
  const nav = window.MiniAppNav;
  if (!nav) return titleHtml;
  return nav.headRow(app, titleHtml, { disabled });
}

function wireBack(root, handler) {
  window.MiniAppNav?.wire(root, 'ranges', handler);
}

export function renderBattleshipHub(root, vm, handlers) {
  const last = vm.lastCourse;
  const continueHtml = last?.course
    ? `<button type="button" class="rbContinue pgCta pgBubblePress" id="rbContinue">Продолжить · ${esc(last.courseId)}</button>`
    : '';
  root.innerHTML = `<div class="panel pgShell rbShell">
    <div class="pgHud">${headWithBack(`<div class="pgHudTitle"><h1 class="impact">РЕНДЖИ</h1><span class="ey">ТРЕНЕР</span></div>`, 'ranges')}</div>
    <button type="button" class="rbHeroBtn primary pgCta pgBubblePress" id="rbOpenBattle">
      <span class="rbHeroEy">МОРСКОЙ БОЙ</span>
      <strong>Выучи диапазон через 8 миссий</strong>
      <small>13×13 матрица · гранаты · комбо</small>
    </button>
    ${continueHtml}
    <button type="button" class="rangesHelpBtn" id="rbOpenTrainer">Тренерские ренджи →</button>
    <button type="button" class="rangesHelpBtn" id="rbOpenNarrow">Сужение диапазона →</button>
  </div>`;
  wireBack(root, () => handlers.back?.());
  root.querySelector('#rbOpenBattle').onclick = () => handlers.openBattleshipCatalog?.();
  root.querySelector('#rbOpenTrainer')?.addEventListener('click', () => handlers.openTrainer?.());
  root.querySelector('#rbOpenNarrow')?.addEventListener('click', () => handlers.openNarrowing?.());
  const cont = root.querySelector('#rbContinue');
  if (cont) cont.onclick = () => handlers.selectBattleshipCourse?.(last.courseId);
}

export function renderBattleshipCatalog(root, vm, handlers) {
  const groups = {};
  for (const c of vm.catalog || []) {
    const key = c.position || '?';
    if (!groups[key]) groups[key] = [];
    groups[key].push(c);
  }
  const list = Object.entries(groups).map(([pos, courses]) => {
    const chips = courses.map((c) =>
      `<button type="button" class="rbCourseChip" data-course="${esc(c.courseId)}">${esc(formatStackLabel(c.stack))}</button>`
    ).join('');
    return `<div class="rbCourseGroup"><span class="rbCoursePos">${esc(pos)}</span><div class="rbCourseChips">${chips}</div></div>`;
  }).join('');

  root.innerHTML = `<div class="panel pgShell rbShell">
    <div class="pgHud">${headWithBack(`<div class="pgHudTitle"><h1 class="impact">МОРСКОЙ БОЙ</h1><span class="ey">ВЫБЕРИ ДИАПАЗОН</span></div>`, 'ranges')}</div>
    <p class="rangesLead rbLead">Только диапазоны с точными тренерскими данными UO open.</p>
    <div class="rbCatalog">${list || '<p class="rangesEmpty">Нет доступных курсов.</p>'}</div>
  </div>`;
  wireBack(root, () => handlers.back?.());
  root.querySelectorAll('[data-course]').forEach((btn) => {
    btn.onclick = () => handlers.selectBattleshipCourse?.(btn.dataset.course);
  });
}

function matrixHtml(mission, state, model, handlers) {
  const activeHands = mission?.getActiveHands ? mission.getActiveHands() : [];
  const activeSet = new Set(activeHands);
  const cells = [];
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      const hand = handCode(r, c);
      let cls = 'rbCell';
      if (r === c) cls += ' pair';
      else if (r < c) cls += ' suited';
      else cls += ' offsuit';
      if (mission?.type !== 'FINAL_BATTLE' && activeSet.size > 0 && !activeSet.has(hand)) cls += ' dimmed';
      if (state.used?.has(hand)) cls += ' selected-open';
      const locked = state.status === 'finished' || state.submitted;
      if (locked) cls += ' locked';
      cells.push(`<button type="button" class="${cls}" data-hand="${esc(hand)}" ${locked ? 'disabled' : ''}>${esc(hand)}</button>`);
    }
  }
  const axis = RANKS.map((r) => `<span>${r}</span>`).join('');
  return `<div class="rbAxisTop">${axis}</div>
    <div class="rbMatrixWrap"><div class="rbAxisSide">${axis}</div><div class="rbMatrix">${cells.join('')}</div></div>`;
}

export function renderBattleshipGame(root, vm, handlers) {
  const { mission, state, model, missions } = vm;
  if (!mission || !model) {
    root.innerHTML = `<div class="panel"><p>Загрузка…</p></div>`;
    return;
  }

  const dots = (missions || []).map((_, i) => {
    let cls = 'rbDot';
    if (i === state.missionIndex) cls += ' active';
    else if (i < state.missionIndex) cls += ' done';
    return `<span class="${cls}"></span>`;
  }).join('');

  const submitArea = mission.usesSubmit
    ? `<div class="rbSubmitArea"><button type="button" class="rbSubmitBtn" id="rbSubmit" ${state.submitted ? 'disabled' : ''}>✅ Готово</button></div>`
    : '';

  let interaction = '';
  if (mission.type === 'FULL_SECTOR_CONFIRM' && !state.choiceMade && state.status === 'playing') {
    const choices = mission.getChoices();
    interaction = `<div class="rbChoiceGroup">${choices.map((ch) =>
      `<button type="button" class="rbChoiceBtn" data-choice="${esc(ch)}">${esc(ch)}</button>`
    ).join('')}</div>`;
  } else if ((mission.type === 'MIXED_DECISIONS' || mission.type === 'FINAL_BATTLE') && state.status === 'playing') {
    const hands = mission.type === 'FINAL_BATTLE'
      ? (state.finalBattleHands.length ? state.finalBattleHands : mission.getActiveHands())
      : mission.getDecisions();
    if (state.decisionIndex < hands.length && state.shots > 0) {
      const hand = hands[state.decisionIndex];
      interaction = `<p class="rbPrompt">Рука <b>${esc(hand)}</b> (${state.decisionIndex + 1}/${hands.length})</p>
        <div class="rbDecisionGroup">
          <button type="button" class="rbDecisionBtn" data-decision="OPEN">OPEN</button>
          <button type="button" class="rbDecisionBtn" data-decision="FOLD">FOLD</button>
        </div>`;
    }
  }

  const onboarding = state.showOnboarding
    ? `<div class="rbOnboarding show"><div class="rbOnboardCard">
        <h2>🎯 Ренджи: Морской бой</h2>
        <p>Пройди курс из 8 миссий и выучи диапазон <b>${esc(courseLabel(model))}</b>.</p>
        <p class="rbMuted">Попадание — 💥 взрыв. Промах — ❌ теряешь гранату.</p>
        <button type="button" class="primary rbStartBtn" id="rbStart">В БОЙ</button>
      </div></div>`
    : '';

  const overlay = state.showOverlay ? renderMissionOverlay(vm) : '';
  const finalOv = state.showFinal ? renderFinalOverlay(vm, handlers) : '';

  root.innerHTML = `<div class="panel rbGame pgShell">
    <div class="pgHud">${headWithBack(`<div class="pgHudTitle"><h2>${esc(courseLabel(model))}</h2><span class="ey">МОРСКОЙ БОЙ</span></div>`, 'ranges')}</div>
    <div class="rbGameInner">
      ${onboarding}
      <div class="rbMissionBar"><span>Миссия <b>${state.missionIndex + 1}/${missions.length}</b></span><div class="rbDots">${dots}</div></div>
      <div class="rbHud">
        <div><small>💣</small><b>${state.shots}</b></div>
        <div><small>✓</small><b class="rbGreen">${state.hits}</b></div>
        <div><small>🔥</small><b class="rbCombo">×${state.combo}</b></div>
      </div>
      <div class="rbMissionHead">
        <div class="rbMissionTitle">${esc(mission.title)}</div>
        <div class="rbMissionDesc">${esc(mission.description)}</div>
        ${submitArea}
      </div>
      ${matrixHtml(mission, state, model, handlers)}
      ${interaction}
      <div class="rbFeedback"><div class="rbAvatar">♠️</div><div class="rbSpeech">${state.speech || 'Выбирай клетку. <b>Правильная рука взорвётся.</b>'}</div></div>
      <div class="rbBottom"><button type="button" class="rangesHelpBtn" id="rbResetMission">↻ Сброс миссии</button></div>
      ${overlay}
      ${finalOv}
    </div>
  </div>`;

  wireBack(root, () => handlers.back?.());
  root.querySelector('#rbStart')?.addEventListener('click', () => handlers.startBattleship?.());
  root.querySelector('#rbSubmit')?.addEventListener('click', () => handlers.submitRangeHunt?.());
  root.querySelector('#rbResetMission')?.addEventListener('click', () => handlers.retryMission?.());
  root.querySelectorAll('[data-choice]').forEach((btn) => {
    btn.onclick = () => handlers.handleChoice?.(btn.dataset.choice);
  });
  root.querySelectorAll('[data-decision]').forEach((btn) => {
    btn.onclick = () => handlers.handleDecision?.(btn.dataset.decision);
  });
  root.querySelectorAll('[data-hand]').forEach((btn) => {
    btn.onclick = () => {
      const hand = btn.dataset.hand;
      if (mission.type === 'RANGE_HUNT') handlers.toggleHand?.(hand);
      else if (mission.type === 'FIND_THE_EDGE') handlers.handleEdgeClick?.(hand);
    };
  });
  root.querySelector('#rbNextMission')?.addEventListener('click', () => handlers.nextMission?.());
  root.querySelector('#rbRetryMission')?.addEventListener('click', () => handlers.retryMission?.());
}

function renderMissionOverlay(vm) {
  const { mission, state } = vm;
  const score = state.missionScore ?? 0;
  const isLast = state.missionIndex >= vm.missions.length - 1;
  return `<div class="rbOverlay show"><div class="rbCard">
    <div class="rbScore">${score}%</div>
    <h2>${score >= 80 ? '🎯 Отлично!' : score >= 50 ? '👍 Хорошо' : '📖 Учимся'}</h2>
    <p class="rbSub">Попаданий: ${state.hits} · Промахов: ${state.misses}</p>
    <div class="rbActions">
      <button type="button" class="rangesHelpBtn" id="rbRetryMission">↻ Повторить</button>
      <button type="button" class="primary" id="rbNextMission">${isLast ? '🏆 Завершить' : '→ Следующая'}</button>
    </div>
  </div></div>`;
}

function renderFinalOverlay(vm, handlers) {
  const stats = vm.progress.getCourseMissions(vm.course.courseId, vm.missionIds).filter((m) => m.completed);
  const totalAcc = stats.length
    ? Math.round(stats.reduce((s, m) => s + (m.accuracy || 0), 0) / stats.length)
    : 0;
  const mastered = totalAcc >= 80 && stats.length >= vm.missions.length;
  return `<div class="rbFinal show"><div class="rbFinalCard">
    <div class="rbBigScore">${mastered ? '🏆' : '📚'}</div>
    <h2>${mastered ? `${esc(courseLabel(vm.model))} освоен!` : 'Курс пройден'}</h2>
    <p class="rbSub">Средняя точность ${totalAcc}% · ${stats.length}/${vm.missions.length} миссий</p>
    <button type="button" class="primary rbFinalBtn" id="rbRepeatWeak">Повторить слабую миссию</button>
    <button type="button" class="rangesHelpBtn" id="rbRestart">Пройти ещё раз</button>
    <button type="button" class="rangesHelpBtn" id="rbBackCatalog">К выбору диапазона</button>
  </div></div>`;
}

export function renderBattleshipError(root, vm, handlers) {
  root.innerHTML = `<div class="panel rangesStage"><p>${esc(vm.state?.errorMessage || 'Ошибка')}</p>
    <button type="button" class="primary" id="rbErrBack">НАЗАД</button></div>`;
  root.querySelector('#rbErrBack').onclick = () => handlers.back?.();
}

// Wire final overlay buttons after paint — called from main paint cycle
export function wireFinalOverlay(root, handlers) {
  root.querySelector('#rbRepeatWeak')?.addEventListener('click', () => handlers.repeatWeakMission?.());
  root.querySelector('#rbRestart')?.addEventListener('click', () => handlers.restartCourse?.());
  root.querySelector('#rbBackCatalog')?.addEventListener('click', () => handlers.back?.());
}
