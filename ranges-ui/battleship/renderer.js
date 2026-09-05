// Range Battleship DOM renderer — matrix-first mobile game UI.

import { RANKS, handCode } from './matrixUtils.js';
import { formatStackLabel, displayPosition, trainerPosition, getCatalogPositions, getStacksForPosition, findCourseForPicker } from './courses.js';
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

export function renderRangesHub(root, vm, handlers) {
  // New unified Ranges hub — primary entry point showing all learning modes
  let continueCard = '';
  if (vm.lastStudiedRange) {
    const r = vm.lastStudiedRange;
    const pct = r.masteryPercent ? `<div class="rhMastery"><span>Освоено</span><b>${r.masteryPercent}%</b></div>` : '';
    continueCard = `<div class="rhCard rhCardContinue">
      <h3>ПРОДОЛЖИТЬ</h3>
      <div class="rhRangeLabel">${esc(r.positionLabel)} · ${esc(r.stackLabel)}</div>
      <div class="rhRangeContext">${esc(r.situationLabel)}</div>
      ${pct}
      <button type="button" class="primary pgCta pgBubblePress" id="rhContinue">ПРОДОЛЖИТЬ</button>
    </div>`;
  }

  root.innerHTML = `<div class="panel pgShell rhShell">
    <div class="pgHud">${headWithBack(`<div class="pgHudTitle"><h1 class="impact">РЕНДЖИ</h1></div>`, 'ranges')}</div>
    <p class="rhSubtitle">Изучай, тренируй и повторяй префлоп-диапазоны.</p>
    ${continueCard}
    <div class="rhPathsContainer">
      <button type="button" class="rhPath rhPathPrimary pgCta pgBubblePress" id="rhStudy">
        <span class="rhPathTitle">ИЗУЧАТЬ РЕНДЖ</span>
        <span class="rhPathDesc">Выбери позицию и стек</span>
      </button>
      <button type="button" class="rhPath pgCta pgBubblePress" id="rhBattleship">
        <span class="rhPathTitle">МОРСКОЙ БОЙ</span>
        <span class="rhPathDesc">Запомни диапазон в игре</span>
      </button>
      <button type="button" class="rhPath pgCta pgBubblePress" id="rhNarrowing">
        <span class="rhPathTitle">КАК СУЖАЕТСЯ РЕНДЖ</span>
        <span class="rhPathDesc">Посмотри как меняется диапазон</span>
      </button>
    </div>
  </div>`;
  wireBack(root, () => handlers.back?.());
  root.querySelector('#rhStudy').onclick = () => handlers.openTrainer?.();
  root.querySelector('#rhBattleship').onclick = () => handlers.openBattleshipCatalog?.();
  root.querySelector('#rhNarrowing').onclick = () => handlers.openNarrowing?.();
  if (vm.lastStudiedRange) {
    root.querySelector('#rhContinue').onclick = () => handlers.continueLastRange?.();
  }
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
  const displayPositions = getCatalogPositions(catalog);
  const last = vm.lastCourse?.courseId;
  const lastCourse = catalog.find((c) => c.courseId === last);
  let selPos = vm.pickerPos || lastCourse?.position || trainerPosition(displayPositions[0]) || 'BTN';
  let selStack = vm.pickerStack || lastCourse?.stack
    || getStacksForPosition(catalog, selPos)[0];
  const stacksForPos = getStacksForPosition(catalog, selPos);
  if (!stacksForPos.includes(selStack)) selStack = stacksForPos[0];
  const match = findCourseForPicker(catalog, selPos, selStack);

  const posChips = displayPositions.map((displayPos) => {
    const tp = trainerPosition(displayPos);
    return `<button type="button" class="rbPickChip${tp === selPos ? ' active' : ''}" data-pos="${esc(tp)}">${esc(displayPos)}</button>`;
  }).join('');
  const stackChips = stacksForPos.map((s) =>
    `<button type="button" class="rbPickChip${s === selStack ? ' active' : ''}" data-stack="${esc(s)}">${esc(formatStackLabel(s))}</button>`
  ).join('');

  root.innerHTML = `<div class="panel pgShell rbShell">
    <div class="pgHud">${headWithBack(`<div class="pgHudTitle"><h1 class="impact">МОРСКОЙ БОЙ</h1><span class="ey">ВЫБЕРИ КУРС</span></div>`, 'ranges')}</div>
    <div class="rbPicker">
      <div class="rbPickerBlock"><span class="rbPickerLabel">ПОЗИЦИЯ</span><div class="rbPickRow">${posChips}</div></div>
      <div class="rbPickerBlock"><span class="rbPickerLabel">СТЕК</span><div class="rbPickRow" id="rbStackRow">${stackChips}</div></div>
      <div class="rbPickerPreview">
        <strong>${esc(displayPosition(selPos))} · ${esc(formatStackLabel(selStack))}</strong>
        <small>${match ? `${match.openCount} open · ${match.gradable} рук` : 'Нет подтверждённого ренджа'}</small>
      </div>
      <button type="button" class="primary rbPickerGo pgCta pgBubblePress" id="rbStartCourse" data-course="${esc(match?.courseId || '')}" ${match ? '' : 'disabled'}>В БОЙ</button>
    </div>
  </div>`;

  wireBack(root, () => handlers.back?.());
  root.querySelectorAll('.rbPickChip[data-pos]').forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      handlers.setPicker?.(btn.dataset.pos, null);
      handlers.openBattleshipCatalog?.();
    };
  });
  root.querySelectorAll('.rbPickChip[data-stack]').forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      handlers.setPicker?.(selPos, btn.dataset.stack);
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
  const missedSet = new Set(state.showFailOverlay ? (state.missedTargets || []) : []);
  const cells = [];
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      const hand = handCode(r, c);
      let cls = 'rbCell neutral';
      const tapped = state.hitHands?.has(hand) || state.missHands?.has(hand);
      if (state.hitHands?.has(hand)) cls = 'rbCell hit';
      else if (state.missHands?.has(hand)) cls = 'rbCell miss';
      else if (missedSet.has(hand)) cls = 'rbCell review-missed';
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
  return `<div class="rbHudBar">
    <div class="rbHudRow"><span class="rbHudLabel">МИССИЯ ${mission?.index || 1}/${missions?.length || 8}</span></div>
    <div class="rbHudRow rbHudGoal"><span>ЦЕЛЬ:</span> <b>${esc(mission?.title || '')}</b></div>
    <div class="rbHudStats">
      <div class="rbHudStat"><span>💣 ${state.grenades}</span><small>гранат</small></div>
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
      : '';

  const feedbackPop = state.feedback
    ? `<div class="rbFeedbackPop rbFeedbackPop--${state.feedback.type}">${esc(state.feedback.text)}</div>`
    : '';

  const overlay = state.showOverlay ? renderMissionOverlay(vm) : '';
  const failOv = state.showFailOverlay ? renderFailOverlay(vm) : '';
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
      ${failOv}
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

function renderFailOverlay(vm) {
  const { state } = vm;
  const missed = (state.missedTargets || []).slice(0, 8);
  const wrong = (state.wrongHands || []).slice(0, 8);
  return `<div class="rbOverlay show"><div class="rbCard rbCard--fail">
    <div class="rbStamp rbStamp--fail">ГРАНАТЫ КОНЧИЛИСЬ</div>
    <p class="rbSub">ТОЧНОСТЬ ${state.missionScore}%</p>
    <p class="rbSub">ПОПАДАНИЙ ${state.hits} · ПРОМАХОВ ${state.misses}</p>
    ${wrong.length ? `<p class="rbReview">Лишние: ${wrong.map(esc).join(', ')}</p>` : ''}
    ${missed.length ? `<p class="rbReview">Пропущены: ${missed.map(esc).join(', ')}</p>` : ''}
    <div class="rbActions">
      <button type="button" class="primary" id="rbRetryMission">ПОВТОРИТЬ МИССИЮ</button>
    </div>
  </div></div>`;
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
