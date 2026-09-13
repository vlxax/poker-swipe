// Trainer narrowing renderer — analysis / transformation visual language.

import { RANKS } from '../battleship/matrixUtils.js';
import { formatStackLabel, displayPosition, trainerPosition, getCatalogPositions, getStacksForPosition, findCourseForPicker } from '../battleship/courses.js';
import { isOpen, isGradable } from '../battleship/trainerRangeModel.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function handCode(r, c) {
  const a = RANKS[r];
  const b = RANKS[c];
  if (r === c) return a + b;
  return r < c ? a + b + 's' : b + a + 'o';
}

function headWithBack(titleHtml) {
  const nav = window.MiniAppNav;
  if (!nav) return titleHtml;
  return nav.headRow('ranges', titleHtml, { disabled: false });
}

function wireBack(root, handler) {
  window.MiniAppNav?.wire(root, 'ranges', handler);
}

function matrixHtml(model, { revealed = false, revealAnimating = false, flashHand = null, highlightHand = null, tapMode = false } = {}) {
  const cells = [];
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      const hand = handCode(r, c);
      let cls = 'rnCell';
      if (r === c) cls += ' pair';
      else if (r < c) cls += ' suited';
      else cls += ' offsuit';

      const gradable = isGradable(hand, model);
      const open = isOpen(hand, model) === true;

      if (!gradable) cls += ' blocked';
      else if (!revealed) cls += ' neutral';
      else if (open) cls += ' survives';
      else cls += ' excluded';

      if (revealAnimating) cls += ' anim';
      if (highlightHand === hand) cls += ' anchor';
      if (flashHand === hand) cls += ' flash';
      const interactive = tapMode && gradable && revealed;
      cells.push(`<${interactive ? 'button' : 'div'} ${interactive ? 'type="button"' : ''} class="${cls}" ${interactive ? `data-rn-hand="${esc(hand)}"` : ''}>${esc(hand)}</${interactive ? 'button' : 'div'}>`);
    }
  }
  const axis = RANKS.map((x) => `<span>${x}</span>`).join('');
  return `<div class="rnMatrixArena">
    <div class="rnAxisTop">${axis}</div>
    <div class="rnMatrixWrap"><div class="rnAxisSide">${axis}</div><div class="rnMatrix">${cells.join('')}</div></div>
  </div>`;
}

export function renderNarrowingCatalog(root, vm, handlers) {
  const catalog = vm.catalog || [];
  const displayPositions = getCatalogPositions(catalog);
  const last = vm.lastLessonId;
  const lastLesson = catalog.find((c) => c.courseId === last);
  let selPos = vm.pickerPos || lastLesson?.position || trainerPosition(displayPositions[0]) || 'BTN';
  let selStack = vm.pickerStack || lastLesson?.stack
    || getStacksForPosition(catalog, selPos)[0];
  const stacksForPos = getStacksForPosition(catalog, selPos);
  if (!stacksForPos.includes(selStack)) selStack = stacksForPos[0];
  const match = findCourseForPicker(catalog, selPos, selStack);

  const posChips = displayPositions.map((displayPos) => {
    const tp = trainerPosition(displayPos);
    return `<button type="button" class="rnPickChip${tp === selPos ? ' active' : ''}" data-pos="${esc(tp)}">${esc(displayPos)}</button>`;
  }).join('');
  const stackChips = stacksForPos.map((s) =>
    `<button type="button" class="rnPickChip${s === selStack ? ' active' : ''}" data-stack="${esc(s)}">${esc(formatStackLabel(s))}</button>`
  ).join('');

  root.innerHTML = `<div class="panel pgShell rnShell">
    <div class="pgHud">${headWithBack(`<div class="pgHudTitle"><h1 class="impact">СУЖЕНИЕ</h1><span class="ey">ДИАПАЗОНА</span></div>`)}</div>
    <p class="rnLead">Увидь, как диапазон сужается после действия соперника.</p>
    <div class="rnPicker">
      <div class="rnPickerBlock"><span class="rnPickerLabel">ПОЗИЦИЯ</span><div class="rnPickRow">${posChips}</div></div>
      <div class="rnPickerBlock"><span class="rnPickerLabel">СТЕК</span><div class="rnPickRow">${stackChips}</div></div>
      <div class="rnPickerPreview"><strong>${esc(displayPosition(selPos))} · ${esc(formatStackLabel(selStack))}</strong>
        <small>${match ? `open · ${match.openCount} рук` : 'Нет подтверждённого ренджа'}</small></div>
      <button type="button" class="primary rnPickerGo" id="rnStartLesson" data-lesson="${esc(match?.courseId || '')}" ${match ? '' : 'disabled'}>НАЧАТЬ</button>
    </div>
  </div>`;

  wireBack(root, () => handlers.back?.());
  root.querySelectorAll('.rnPickChip[data-pos]').forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      handlers.setNarrowPicker?.(btn.dataset.pos, null);
      handlers.openNarrowing?.();
    };
  });
  root.querySelectorAll('.rnPickChip[data-stack]').forEach((btn) => {
    btn.onclick = (e) => {
      e.stopPropagation();
      handlers.setNarrowPicker?.(selPos, btn.dataset.stack);
      handlers.openNarrowing?.();
    };
  });
  const start = root.querySelector('#rnStartLesson');
  if (start) {
    start.onclick = (e) => {
      e.preventDefault();
      const id = start.dataset.lesson;
      if (id) handlers.startNarrowingLesson?.(id);
    };
  }
}

function countBar(counts, revealed) {
  if (!revealed) {
    return `<div class="rnCountBar"><span>БЫЛО: <b>${counts.before}</b></span></div>`;
  }
  return `<div class="rnCountBar rnCountBar--after">
    <span>БЫЛО: <b>${counts.before}</b></span>
    <span class="rnArrow">↓</span>
    <span>ОСТАЛОСЬ: <b class="rnGreen">${counts.after}</b></span>
  </div>`;
}

export function renderNarrowingLesson(root, vm, handlers) {
  const { lesson, model, counts, revealed, revealAnimating, exercise, phase, feedback, speech, flashHand } = vm;
  if (!lesson || !model) {
    root.innerHTML = `<div class="panel"><p>Загрузка…</p></div>`;
    return;
  }

  if (phase === 'onboarding') {
    root.innerHTML = `<div class="panel pgShell rnShell">
      <div class="pgHud">${headWithBack(`<div class="pgHudTitle"><h2>Сужение диапазона</h2><span class="ey">КАК ЭТО РАБОТАЕТ</span></div>`)}</div>
      <div class="rnOnboard">
        <p>Мы не угадываем руку соперника.<br>Мы убираем руки, которые больше не подходят под его действие.</p>
        <div class="rnFlow"><span>БЫЛО</span><span class="rnArrow">↓</span><span>СОПЕРНИК ОТКРЫЛСЯ</span><span class="rnArrow">↓</span><span>ОСТАЛОСЬ</span></div>
        <button type="button" class="primary" id="rnOnboardOk">ПОНЯТНО</button>
      </div>
    </div>`;
    wireBack(root, () => handlers.back?.());
    root.querySelector('#rnOnboardOk')?.addEventListener('click', () => handlers.dismissNarrowingOnboard?.());
    return;
  }

  if (phase === 'complete') {
    const avg = vm.scores?.length ? Math.round(vm.scores.reduce((a, b) => a + b, 0) / vm.scores.length) : 0;
    root.innerHTML = `<div class="panel pgShell rnShell">
      <div class="pgHud">${headWithBack(`<div class="pgHudTitle"><h2>${esc(lesson.label)}</h2><span class="ey">ГОТОВО</span></div>`)}</div>
      <div class="rnComplete">
        <div class="rnCompleteBadge">УРОК ПРОЙДЕН</div>
        <p>Точность: <b>${avg}%</b></p>
        <p class="rnSub">Осталось <b>${counts.after}</b> рук из ${counts.before}.</p>
        <button type="button" class="primary" id="rnNextLesson">ДРУГОЙ СПОТ</button>
        <button type="button" class="rnLinkBtn" id="rnBackHub">В РЕНДЖИ</button>
      </div>
    </div>`;
    wireBack(root, () => handlers.back?.());
    root.querySelector('#rnNextLesson')?.addEventListener('click', () => handlers.openNarrowing?.());
    root.querySelector('#rnBackHub')?.addEventListener('click', () => handlers.back?.());
    return;
  }

  let cta = '';
  if (phase === 'preview' && !revealed) {
    cta = `<button type="button" class="primary rnRevealBtn" id="rnReveal">ПОКАЖИ, ЧТО ОСТАЛОСЬ</button>`;
  } else if (phase === 'preview' && revealed) {
    cta = `<p class="rnExplain">${esc(speech || 'После открытия большая часть мусора исчезает из диапазона.')}</p>
      <button type="button" class="primary" id="rnContinue">ДАЛЬШЕ</button>`;
  }

  let exerciseHtml = '';
  if (phase === 'exercise' && exercise) {
    if (exercise.type === 'mc') {
      exerciseHtml = `<div class="rnExercise">
        <p class="rnQuestion">${esc(exercise.prompt)}</p>
        <div class="rnChoices">${exercise.choices.map((ch) =>
          `<button type="button" class="rnChoice" data-choice="${esc(ch)}">${esc(ch)}</button>`
        ).join('')}</div>
      </div>`;
    } else if (exercise.type === 'yesno') {
      exerciseHtml = `<div class="rnExercise">
        <p class="rnQuestion">${esc(exercise.prompt)}</p>
        <p class="rnHandBadge">${esc(exercise.hand)}</p>
        <div class="rnChoices">
          <button type="button" class="rnChoice" data-yn="yes">ДА</button>
          <button type="button" class="rnChoice" data-yn="no">НЕТ</button>
        </div>
      </div>`;
    } else if (exercise.type === 'tap') {
      exerciseHtml = `<div class="rnExercise">
        <p class="rnQuestion">${esc(exercise.prompt)}</p>
      </div>`;
    }
    if (feedback) {
      exerciseHtml += `<div class="rnFeedback rnFeedback--${feedback.type}">${esc(feedback.text)}</div>`;
    }
    if (speech) exerciseHtml += `<p class="rnSpeech">${esc(speech)}</p>`;
  }

  const tapMode = phase === 'exercise' && exercise?.type === 'tap';
  const highlight = phase === 'exercise' && exercise?.type === 'yesno' ? exercise.hand : null;

  root.innerHTML = `<div class="panel pgShell rnShell rnLesson">
    <div class="pgHud">${headWithBack(`<div class="pgHudTitle"><h2>${esc(lesson.label)}</h2><span class="ey">СУЖЕНИЕ</span></div>`)}</div>
    <div class="rnActionLine">${esc(lesson.actionLine)}</div>
    ${countBar(counts, revealed)}
    ${matrixHtml(model, { revealed, revealAnimating, flashHand, highlightHand: highlight, tapMode })}
    ${cta}
    ${exerciseHtml}
  </div>`;

  wireBack(root, () => handlers.back?.());
  root.querySelector('#rnReveal')?.addEventListener('click', () => handlers.revealNarrowing?.());
  root.querySelector('#rnContinue')?.addEventListener('click', () => handlers.continueNarrowing?.());
  root.querySelectorAll('[data-choice]').forEach((btn) => {
    btn.onclick = () => handlers.answerNarrowingMc?.(btn.dataset.choice);
  });
  root.querySelectorAll('[data-yn]').forEach((btn) => {
    btn.onclick = () => handlers.answerNarrowingYn?.(btn.dataset.yn);
  });
  root.querySelectorAll('[data-rn-hand]').forEach((btn) => {
    btn.onclick = () => handlers.tapNarrowingHand?.(btn.dataset.rnHand);
  });
}

export function renderNarrowingError(root, vm, handlers) {
  root.innerHTML = `<div class="panel rangesStage"><p>${esc(vm.errorMessage || 'Ошибка')}</p>
    <button type="button" class="primary" id="rnErrBack">НАЗАД</button></div>`;
  root.querySelector('#rnErrBack').onclick = () => handlers.back?.();
}
