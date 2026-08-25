// Range Battleship DOM renderer — matrix-first mobile game UI.

import { RANKS, handCode } from './matrixUtils.js';
import { formatStackLabel } from './courses.js';
import { courseLabel } from './trainerRangeModel.js';

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

function sectorLabel(key) {
  const map = {
    pocketPairs: 'Карманки', suitedAx: 'Suited Ax', offsuitAx: 'Offsuit Ax',
    suitedKx: 'Suited Kx', broadway: 'Broadway', suitedConnectors: 'Коннекторы',
    suitedGappers: 'Гапперы', other: 'Другое'
  };
  return map[key] || key;
}

export function renderBattleshipHub(root, vm, handlers) {
  const progressRows = (vm.courseProgressList || []).map((r) =>
    `<div class="rbProgressRow"><span>${esc(r.label)}</span><b>${r.pct}%</b></div>`
  ).join('') || '<p class="rbProgressEmpty">Пройди первый курс — прогресс появится здесь.</p>';

  root.innerHTML = `<div class="panel pgShell rbShell">
    <div class="pgHud">${headWithBack(`<div class="pgHudTitle"><h1 class="impact">РЕНДЖИ</h1><span class="ey">ТРЕНЕР</span></div>`, 'ranges')}</div>
    <div class="rbHeroCard">
      <span class="rbHeroTag">МОРСКОЙ БОЙ</span>
      <p class="rbHeroCopy">Запомни диапазон руками, а не скриншотом.</p>
      <button type="button" class="rbHeroPlay pgCta pgBubblePress" id="rbOpenBattle">ИГРАТЬ</button>
    </div>
    <section class="rbHubSection">
      <h3 class="rbHubHeading">ТВОЙ ПРОГРЕСС</h3>
      <div class="rbProgressList">${progressRows}</div>
    </section>
    <section class="rbHubSection">
      <h3 class="rbHubHeading">ДРУГИЕ РЕЖИМЫ</h3>
      <button type="button" class="rbModeBtn" id="rbOpenNarrow">Сужение диапазона →</button>
      <button type="button" class="rbModeBtn rbModeBtnMuted" id="rbOpenTrainer">Тренерские ренджи →</button>
    </section>
  </div>`;
  wireBack(root, () => handlers.back?.());
  root.querySelector('#rbOpenBattle').onclick = () => handlers.openBattleshipCatalog?.();
  root.querySelector('#rbOpenTrainer')?.addEventListener('click', () => handlers.openTrainer?.());
  root.querySelector('#rbOpenNarrow')?.addEventListener('click', () => handlers.openNarrowing?.());
}

export function renderBattleshipCatalog(root, vm, handlers) {
  const catalog = vm.catalog || [];
  const positions = [...new Set(catalog.map((c) => c.position))];
  const stacks = [...new Set(catalog.map((c) => c.stack))];
  const last = vm.lastCourse?.courseId;
  const lastCourse = catalog.find((c) => c.courseId === last);
  let selPos = vm.pickerPos || lastCourse?.position || positions[0] || 'BTN';
  let selStack = vm.pickerStack || lastCourse?.stack
    || stacks.find((s) => catalog.some((c) => c.position === selPos && c.stack === s))
    || stacks[0];
  const stacksForPos = stacks.filter((s) => catalog.some((c) => c.position === selPos && c.stack === s));
  if (!stacksForPos.includes(selStack)) selStack = stacksForPos[0];
  const match = catalog.find((c) => c.position === selPos && c.stack === selStack);

  const posChips = positions.map((p) =>
    `<button type="button" class="rbPickChip${p === selPos ? ' active' : ''}" data-pos="${esc(p)}">${esc(p)}</button>`
  ).join('');
  const stackChips = stacksForPos.map((s) =>
    `<button type="button" class="rbPickChip${s === selStack ? ' active' : ''}" data-stack="${esc(s)}">${esc(formatStackLabel(s))}</button>`
  ).join('');

  root.innerHTML = `<div class="panel pgShell rbShell">
    <div class="pgHud">${headWithBack(`<div class="pgHudTitle"><h1 class="impact">МОРСКОЙ БОЙ</h1><span class="ey">ВЫБЕРИ КУРС</span></div>`, 'ranges')}</div>
    <div class="rbPicker" data-pos="${esc(selPos)}" data-stack="${esc(selStack)}">
      <div class="rbPickerBlock"><span class="rbPickerLabel">ПОЗИЦИЯ</span><div class="rbPickRow">${posChips}</div></div>
      <div class="rbPickerBlock"><span class="rbPickerLabel">СТЕК</span><div class="rbPickRow" id="rbStackRow">${stackChips}</div></div>
      <div class="rbPickerPreview">
        <strong>${esc(selPos)} · ${esc(formatStackLabel(selStack))}</strong>
        <small>${match ? `${match.openCount} open · ${match.gradable} рук` : 'Нет данных'}</small>
      </div>
      <button type="button" class="primary rbPickerGo pgCta pgBubblePress" id="rbStartCourse" data-course="${esc(match?.courseId || '')}" ${match ? '' : 'disabled'}>В БОЙ</button>
    </div>
  </div>`;

  wireBack(root, () => handlers.back?.());
  root.querySelectorAll('[data-pos]').forEach((btn) => {
    btn.onclick = () => {
      handlers.setPicker?.(btn.dataset.pos, null);
      handlers.openBattleshipCatalog?.();
    };
  });
  root.querySelectorAll('[data-stack]').forEach((btn) => {
    btn.onclick = () => {
      const picker = root.querySelector('.rbPicker');
      handlers.setPicker?.(picker?.dataset.pos, btn.dataset.stack);
      handlers.openBattleshipCatalog?.();
    };
  });
  const startBtn = root.querySelector('#rbStartCourse');
  if (startBtn) {
    startBtn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      const courseId = startBtn.dataset.course;
      if (courseId) handlers.selectBattleshipCourse?.(courseId);
    };
  }
}

function matrixHtml(mission, state) {
  const activeHands = mission?.getActiveHands ? mission.getActiveHands() : [];
  const activeSet = new Set(activeHands);
  const targetSet = new Set(mission?.getTargetHands?.() || []);
  const cells = [];
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      const hand = handCode(r, c);
      let cls = 'rbCell';
      if (r === c) cls += ' pair';
      else if (r < c) cls += ' suited';
      else cls += ' offsuit';
      if (mission?.type === 'MATRIX_HUNT' && activeSet.size > 0 && !activeSet.has(hand) && !mission.isFinal) {
        cls += ' dimmed';
      }
      if (state.hitHands?.has(hand)) cls += ' hit';
      if (state.missHands?.has(hand)) cls += ' miss';
      if (state.resolved?.has(hand)) cls += ' locked';
      if (state.flashHand === hand && state.feedback?.type === 'hit') cls += ' flash-hit';
      if (state.flashHand === hand && state.feedback?.type === 'miss') cls += ' flash-miss';
      if (state.tutorialPhase === 'pulse' && state.tutorialHand === hand) cls += ' tutorial-pulse';
      const disabled = state.status === 'finished' || state.resolved?.has(hand);
      cells.push(`<button type="button" class="${cls}" data-hand="${esc(hand)}" ${disabled ? 'disabled' : ''} aria-label="${esc(hand)}">${esc(hand)}</button>`);
    }
  }
  const axis = RANKS.map((r) => `<span>${r}</span>`).join('');
  return `<div class="rbMatrixArena">
    <div class="rbAxisTop">${axis}</div>
    <div class="rbMatrixWrap"><div class="rbAxisSide">${axis}</div><div class="rbMatrix">${cells.join('')}</div></div>
  </div>`;
}

function missionIntroHtml(vm) {
  const { mission, state, rangeLabel, missions } = vm;
  if (!state.showMissionIntro || !mission) return '';
  return `<div class="rbMissionIntro">
    <div class="rbIntroTitle">${esc(rangeLabel)}</div>
    <div class="rbIntroMission">Миссия ${mission.index}/${missions.length}</div>
    <div class="rbIntroGoal">${esc(mission.goal)}</div>
    <div class="rbIntroLegend">
      <span>✓ ПОПАЛ</span><span>💥 МИМО</span>
    </div>
    <button type="button" class="primary rbIntroStart" id="rbBeginMission">НАЧАТЬ</button>
  </div>`;
}

function hudHtml(vm) {
  const { mission, state, missions } = vm;
  const grenades = '💣'.repeat(state.grenades) + (state.grenades < 3 ? '·'.repeat(3 - state.grenades) : '');
  return `<div class="rbHudBar">
    <div class="rbHudRow"><span class="rbHudLabel">МИССИЯ ${mission?.index || 1}/${missions?.length || 8}</span></div>
    <div class="rbHudRow rbHudGoal"><span>ЦЕЛЬ:</span> <b>${esc(mission?.title || '')}</b></div>
    <div class="rbHudStats">
      <div class="rbHudStat"><span>${grenades}</span><small>${state.grenades}</small></div>
      <div class="rbHudStat"><span>КОМБО</span><b class="rbCombo">×${state.combo}</b></div>
      <div class="rbHudStat"><span>НАЙДЕНО</span><b>${state.found}/${state.targetTotal}</b></div>
    </div>
  </div>`;
}

export function renderBattleshipGame(root, vm, handlers) {
  const { mission, state, model, missions, rangeLabel } = vm;
  if (!mission || !model) {
    root.innerHTML = `<div class="panel"><p>Загрузка…</p></div>`;
    return;
  }

  const intro = missionIntroHtml(vm);
  const showMatrix = !state.showMissionIntro;
  const tutorialBanner = state.tutorialPhase === 'pulse'
    ? '<p class="rbTutorial">Найди руку из диапазона BTN.</p>'
    : state.tutorialPhase === 'confirm'
      ? '<p class="rbTutorial">Да. Попал. <button type="button" class="rbTutorialOk" id="rbTutorialOk">Ок</button></p>'
      : state.tutorialPhase === 'done'
        ? '<p class="rbTutorial">Теперь попробуй сам.</p>'
        : '';

  const feedbackPop = state.feedback
    ? `<div class="rbFeedbackPop rbFeedbackPop--${state.feedback.type}">${esc(state.feedback.text)}</div>`
    : '';

  const overlay = state.showOverlay ? renderMissionOverlay(vm) : '';
  const finalOv = state.showFinal ? renderFinalOverlay(vm) : '';

  root.innerHTML = `<div class="panel rbGame pgShell">
    <div class="pgHud rbGameHud">${headWithBack(`<div class="pgHudTitle"><h2>${esc(rangeLabel || courseLabel(model))}</h2><span class="ey">МОРСКОЙ БОЙ</span></div>`, 'ranges')}</div>
    <div class="rbGameBody">
      ${intro}
      ${showMatrix ? `${hudHtml(vm)}
        <p class="rbInstruction">${esc(mission.instruction)}</p>
        ${tutorialBanner}
        ${matrixHtml(mission, state)}
        ${feedbackPop}
        <div class="rbSpeechBar">${esc(state.speech || 'Жми на руки из диапазона.')}</div>` : ''}
      ${overlay}
      ${finalOv}
    </div>
  </div>`;

  wireBack(root, () => handlers.back?.());
  root.querySelector('#rbBeginMission')?.addEventListener('click', () => handlers.beginMission?.());
  root.querySelector('#rbTutorialOk')?.addEventListener('click', () => handlers.dismissTutorial?.());
  root.querySelectorAll('[data-hand]').forEach((btn) => {
    btn.onclick = () => handlers.handleCellTap?.(btn.dataset.hand);
  });
  root.querySelector('#rbNextMission')?.addEventListener('click', () => handlers.nextMission?.());
  root.querySelector('#rbRetryMission')?.addEventListener('click', () => handlers.retryMission?.());
}

function renderMissionOverlay(vm) {
  const { mission, state, missions, progress } = vm;
  const isLast = state.missionIndex >= missions.length - 1;
  const weak = state.weakSector ? sectorLabel(state.weakSector) : null;
  return `<div class="rbOverlay show"><div class="rbCard">
    <div class="rbStamp">МИССИЯ ПРОЙДЕНА</div>
    <div class="rbScore">${state.missionScore}%</div>
    <p class="rbSub">ТОЧНОСТЬ ${state.missionScore}%</p>
    <p class="rbSub">ПОПАДАНИЙ ${state.hits} · ПРОМАХОВ ${state.misses}</p>
    ${weak ? `<p class="rbWeak">СЛАБАЯ ЗОНА: ${esc(weak)}</p>` : ''}
    <div class="rbActions">
      <button type="button" class="rangesHelpBtn" id="rbRetryMission">ПОВТОРИТЬ</button>
      <button type="button" class="primary" id="rbNextMission">${isLast ? 'ФИНАЛ' : 'ДАЛЬШЕ'}</button>
    </div>
  </div></div>`;
}

function renderFinalOverlay(vm) {
  const stats = vm.progress.getCourseMissions(vm.course.courseId, vm.missionIds).filter((m) => m.completed);
  const totalHits = stats.reduce((s, m) => s + (m.hits || 0), 0);
  const totalMisses = stats.reduce((s, m) => s + (m.misses || 0), 0);
  const totalAcc = stats.length
    ? Math.round(stats.reduce((s, m) => s + (m.accuracy || 0), 0) / stats.length)
    : 0;
  const bestCombo = Math.max(0, ...stats.map((m) => m.bestCombo || 0));
  const worst = vm.progress.getWeakestMission(vm.course.courseId, vm.missionIds);
  const weakLabel = worst ? sectorLabel(worst.missionId.replace(/-.*$/, '')) : null;
  return `<div class="rbFinal show"><div class="rbFinalCard">
    <div class="rbFinalTitle">${esc(vm.rangeLabel || courseLabel(vm.model))}</div>
    <div class="rbFinalBadge">РЕНДЖ ВЫУЧЕН</div>
    <p class="rbSub">Точность ${totalAcc}% · Попаданий ${totalHits} · Ошибок ${totalMisses}</p>
    <p class="rbSub">Лучшее комбо ×${bestCombo}</p>
    ${weakLabel ? `<p class="rbWeak">Слабая зона: ${esc(weakLabel)}</p>` : ''}
    <button type="button" class="primary rbFinalBtn" id="rbRepeatWeak">ПОВТОРИТЬ СЛАБОЕ</button>
    <button type="button" class="rangesHelpBtn" id="rbRestart">СЛЕДУЮЩИЙ РЕНДЖ</button>
    <button type="button" class="rangesHelpBtn" id="rbBackCatalog">В РЕНДЖИ</button>
  </div></div>`;
}

export function renderBattleshipError(root, vm, handlers) {
  root.innerHTML = `<div class="panel rangesStage"><p>${esc(vm.state?.errorMessage || 'Ошибка')}</p>
    <button type="button" class="primary" id="rbErrBack">НАЗАД</button></div>`;
  root.querySelector('#rbErrBack').onclick = () => handlers.back?.();
}

export function wireFinalOverlay(root, handlers) {
  root.querySelector('#rbRepeatWeak')?.addEventListener('click', () => handlers.repeatWeakMission?.());
  root.querySelector('#rbRestart')?.addEventListener('click', () => handlers.openBattleshipCatalog?.());
  root.querySelector('#rbBackCatalog')?.addEventListener('click', () => handlers.back?.());
}
