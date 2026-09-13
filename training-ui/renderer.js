// DOM renderer for the personalised training UI. Renders view models into the
// existing #dailyArea container. When game layout is active, uses HUD + felt
// shell (same philosophy as Review/Sizing).

import { gradeClass, STREET_RU } from './viewModel.js';
import {
  renderGameLobby, renderGameDrill, renderGameFeedback, renderGameLoading
} from './gameShell.js';
import {
  sessionProgressHtml, feedbackSectionsHtml, choiceClass, wireFeedbackNext
} from './sessionChrome.js';
import { mistakeReviewScreenViewModel } from './sessionReview.js';

const useGameDaily = () => window.__maGameLayout === true;

function el(sel) { return typeof window.$ === 'function' ? window.$(sel) : document.querySelector(sel); }
function esc(s) { return typeof window.esc === 'function' ? window.esc(s) : String(s == null ? '' : s); }
function cardHtml(c) { return typeof window.card === 'function' ? window.card(c, true) : `<span class="pc">${esc(c)}</span>`; }

const posRu = (p) => ({ BTN: 'BTN', SB: 'SB', BB: 'BB', CO: 'CO', MP: 'MP' }[String(p || '').toUpperCase()] || esc(p || '—'));

function streetDots(street) {
  const order = ['preflop', 'flop', 'turn', 'river'];
  const idx = order.indexOf(street);
  return `<div class="streetDots">${order.map((s, i) =>
    `<span class="${i < idx ? 'done' : i === idx ? 'on' : ''}">${STREET_RU[s].slice(0, 3)}</span>`).join('')}</div>`;
}

export const renderHome = (root, vm, handlers = {}) => {
  if (!root) return;
  if (useGameDaily() && vm.type === 'training') {
    renderGameLobby(root, vm, handlers);
    return;
  }
  const h = handlers;
  if (vm.type === 'training') {
    const pp = vm.playerProfile;
    const profileHtml = pp ? `<div class="rangesField" style="margin-top:12px">
      <span class="ey">${esc(vm.profileHeading || 'ТВОЙ ПРОФИЛЬ')}</span>
      ${pp.strongest ? `<div class="row"><span>${esc(vm.strongestHeading || 'Сильный навык')}</span><b>${esc(pp.strongest.label)} · ${esc(pp.strongest.score)}</b></div>` : ''}
      ${pp.weakest ? `<div class="row"><span>${esc(vm.weakestHeading || 'Слабый навык')}</span><b>${esc(pp.weakest.label)} · ${esc(pp.weakest.score)}</b></div>` : ''}
      <span class="ey" style="margin-top:10px;display:block">${esc(vm.tracksHeading || 'НАВЫКИ')}</span>
      ${(pp.tracks || []).map((t) =>
        `<div class="row"><span>${esc(t.label)}</span><b>${esc(t.score)} · ${esc(t.masteryState)} · ${esc(t.trendArrow)} ${esc(t.trend)} · ${esc(vm.mistakesHeading || 'ошибки')} ${esc(t.mistakeFrequency)}</b></div>`
      ).join('')}
    </div>` : '';
    const scoresHtml = !pp && (vm.skillScores || []).length
      ? `<div class="rangesField" style="margin-top:12px"><span class="ey">${esc(vm.levelHeading || 'ТВОЙ УРОВЕНЬ')}</span>${(vm.skillScores || []).map((s) =>
        `<div class="row"><span>${esc(s.label)}</span><b>${esc(s.score)}</b></div>`).join('')}</div>`
      : '';
    const focusHtml = (vm.focusItems || []).map((item) => `<div class="row"><span>•</span><b>${esc(item)}</b></div>`).join('');
    const resumeHtml = vm.resume ? `<div class="trResumeCard panel" style="margin-bottom:16px;border:1px solid rgba(200,255,61,0.25)">
      <span class="ey">${esc(vm.resume.title)}</span>
      <h2 style="margin:8px 0 4px;font-size:1.1rem">${esc(vm.resume.sessionLabel)}</h2>
      <p class="mut small">${esc(vm.resume.progressText)} · ${esc(vm.resume.answeredText)}${vm.resume.activityLabel ? ` · ${esc(vm.resume.activityLabel)}` : ''}</p>
      <div class="grid2" style="margin-top:12px;gap:8px">
        <button class="primary" id="trResumeContinue">${esc(vm.resume.continueCta)} →</button>
        <button class="secondary" id="trResumeNew">${esc(vm.resume.newCta)}</button>
      </div>
    </div>` : '';
    root.innerHTML = `<div class="panel dailyStage">
      ${resumeHtml}
      <span class="ey">ТРЕНИРОВКА</span>
      <h1 class="impact">${esc(vm.title)}</h1>
      <p class="mut">${esc(vm.subtitle)}</p>
      ${profileHtml}
      ${scoresHtml}
      <p class="ey" style="margin-top:16px">${esc(vm.focusHeading)}</p>
      ${focusHtml}
      <p class="ey" style="margin-top:14px">${esc(vm.whyHeading)}</p>
      <p class="mut small">${esc(vm.whyText)}</p>
      ${vm.recentHistory && vm.recentHistory.length ? `<div class="trRecentHistory" style="margin-top:16px">
        <span class="ey">НЕДАВНИЕ РЕШЕНИЯ</span>
        <ul class="mut small" style="margin:8px 0 0;padding-left:18px">
          ${vm.recentHistory.map((row) =>
    `<li>${esc(row.when || '')}${row.when ? ' · ' : ''}${esc(row.concept)}${row.isMistake ? ' · ошибка' : ''}</li>`
  ).join('')}
        </ul>
        <p class="mut small">Полный разбор по ходу доступен сразу после сессии.</p>
      </div>` : ''}
      <button class="primary" id="trStart" style="margin-top:16px">${esc(vm.cta)} →</button>
    </div>`;
    const rc = root.querySelector('#trResumeContinue');
    const rn = root.querySelector('#trResumeNew');
    if (rc && typeof h.continueResume === 'function') rc.onclick = () => h.continueResume();
    if (rn && typeof h.startNew === 'function') rn.onclick = () => h.startNew();
    const b = root.querySelector('#trStart');
    if (b && typeof h.start === 'function') b.onclick = () => h.start();
  } else {
    root.innerHTML = `<div class="panel dailyStage">
      <span class="ey">ЕЖЕДНЕВНАЯ ТРЕНИРОВКА</span>
      <h1 class="impact">${esc(vm.title)}<br><span class="pink">ОБЩАЯ.</span></h1>
      <p class="mut">${esc(vm.note)}</p>
      <button class="primary" id="trStart">${esc(vm.cta)} →</button>
    </div>`;
    const b = root.querySelector('#trStart');
    if (b && typeof h.start === 'function') b.onclick = () => h.start();
  }
};

export const renderLoading = (root, vm = {}) => {
  if (!root) return;
  if (useGameDaily()) {
    renderGameLoading(root, vm);
    return;
  }
  root.innerHTML = `<div class="panel dailyStage">
    <span class="ey">ТРЕНИРОВКА · ПОДГОТОВКА</span>
    <h1 class="impact">ПОДБИРАЕМ<br><span class="pink">РАЗДАЧИ.</span></h1>
    <p class="mut">Подбираем раздачи под твой уровень. Пару секунд…</p>
    <button class="secondary" id="trCancel">ОТМЕНИТЬ</button>
  </div>`;
  const b = root.querySelector('#trCancel');
  if (b && typeof vm.cancel === 'function') b.onclick = () => vm.cancel();
};

export const renderDrill = (root, vm, handlers = {}) => {
  if (!root) return;
  if (useGameDaily()) {
    renderGameDrill(root, vm, handlers);
    return;
  }
  const h = handlers;
  const sc = vm.scenario || {};
  const board = (sc.board || []).map(cardHtml).join('');
  const hero = (sc.heroCards || []).map((c) => cardHtml(c)).join('');
  const gridBusy = vm.isAnswering ? ' is-answering' : '';
  root.innerHTML = `<div class="panel dailyStage">
    ${sessionProgressHtml(vm.sessionProgress || vm.progress)}
    <span class="ey">${esc(vm.streetRu)}</span>
    ${streetDots(vm.street)}
    <div class="dailyPot">
      <div><span class="ey">POT</span><b>${sc.potBb != null ? Number(sc.potBb).toFixed(1) : '—'} BB</b></div>
      <div><span class="ey">EFF</span><b>${sc.effectiveStackBb != null ? Number(sc.effectiveStackBb).toFixed(1) : '—'} BB</b></div>
    </div>
    <div class="row"><span class="mut small">${posRu(sc.heroPosition)} (ТЫ) vs ${posRu(sc.villainPosition)}</span></div>
    ${vm.contextLine ? `<p class="mut small">${esc(vm.contextLine)}</p>` : ''}
    ${vm.historyLine ? `<p class="mut small">${esc(vm.historyLine)}</p>` : ''}
    <div class="dailyBoard">${board || ''}</div>
    ${hero ? `<div class="cards holeCards">${hero}</div>` : ''}
    ${vm.confidence && vm.confidence.available
      ? `<p class="mut small">УВЕРЕННОСТЬ В РАЗБОРЕ ${vm.confidence.score}%${vm.confidence.note ? ' — ' + esc(vm.confidence.note) : ''}</p>` : ''}
    <h2 id="trPrompt">${esc(vm.prompt)}</h2>
    <div class="grid2 trChoiceGrid${gridBusy}" role="group" aria-labelledby="trPrompt">${vm.options.map((o) =>
      `<button type="button" class="${choiceClass(o, vm)}" data-option="${esc(o.id)}"${vm.isAnswering ? ' disabled' : ''}>${esc(o.labelRu)}</button>`).join('')}</div>
  </div>`;
  root.querySelectorAll('[data-option]').forEach((b) => {
    b.onclick = () => {
      if (vm.isAnswering || b.disabled) return;
      if (typeof h.answer === 'function') h.answer(b.dataset.option);
    };
  });
};

export const renderFeedback = (root, vm, handlers = {}) => {
  if (!root) return;
  if (useGameDaily()) {
    renderGameFeedback(root, vm, handlers);
    return;
  }
  const h = handlers;
  const cls = gradeClass(vm.grade);

  if (vm.structured) {
    const detail = vm.detail || {};
    const detailHtml = `<details class="regReport" style="margin-top:12px">
      <summary class="ey" style="cursor:pointer">ПОДРОБНЫЙ РАЗБОР →</summary>
      <p class="mut small">${esc(detail.heroRange || '')}</p>
      <p class="mut small">${esc(detail.villainRange || '')}</p>
      <p class="mut small">${esc(detail.valueHands || '')}</p>
      <p class="mut small">${esc(detail.bluffHands || '')}</p>
      <p class="mut small">${esc(detail.folds || '')}</p>
      <p class="mut small">${esc(detail.calls || '')}</p>
      <p class="mut small">${esc(detail.position || '')}</p>
      ${detail.stackDepth ? `<p class="mut small">${esc(detail.stackDepth)}</p>` : ''}
      <p class="mut small">${esc(detail.potSizing || '')}</p>
      ${detail.icm ? `<p class="mut small">${esc(detail.icm)}</p>` : ''}
      ${detail.alternativeLine ? `<p class="mut small">${esc(detail.alternativeLine)}</p>` : ''}
    </details>`;
    root.innerHTML = `<div class="panel dailyStage">
      ${sessionProgressHtml(vm.sessionProgress)}
      <span class="ey">ВСКРЫТИЕ · РАЗБОР</span>
      <h1 class="impact">${esc(vm.verdict || vm.gradeTitle || 'Результат')}</h1>
      <div class="dualGrade">
        <div class="gradeBox ${cls}"><span class="ey">ОЦЕНКА</span><b>${esc(vm.grade || vm.verdict || '—')}</b></div>
        <div class="gradeBox ${cls}"><span class="ey">ПОТЕРЯ EV</span><b>${vm.evLossBb != null ? Number(vm.evLossBb).toFixed(2) : '—'} BB</b></div>
      </div>
      ${feedbackSectionsHtml(vm, cls)}
      ${vm.tip ? `<p class="mut small">${esc(vm.tip)}</p>` : ''}
      ${detailHtml}
      <p class="trNextHint">Нажми «Далее» или Enter, чтобы продолжить</p>
      <button type="button" class="primary" id="trNext">СЛЕДУЮЩАЯ РАЗДАЧА →</button>
    </div>`;
    wireFeedbackNext(root, h);
    return;
  }

  const freq = vm.strategy && vm.strategy.recommendedFrequency != null
    ? Math.round(vm.strategy.recommendedFrequency * 100) + '%'
    : '—';
  const rec = vm.strategy && vm.strategy.recommendedActionLabel ? vm.strategy.recommendedActionLabel : '—';
  root.innerHTML = `<div class="panel dailyStage">
    ${sessionProgressHtml(vm.sessionProgress)}
    <span class="ey">ВСКРЫТИЕ · ОЦЕНКА</span>
    <h1 class="impact">${esc(vm.gradeTitle || 'Результат')}</h1>
    <div class="dualGrade">
      <div class="gradeBox ${cls}"><span class="ey">ОЦЕНКА</span><b>${esc(vm.grade)}</b></div>
      <div class="gradeBox ${cls}"><span class="ey">ПОТЕРЯ EV</span><b>${vm.evLossBb != null ? Number(vm.evLossBb).toFixed(2) : '—'} BB</b></div>
    </div>
    ${feedbackSectionsHtml({
      ...vm,
      correctAction: vm.correctAction || rec,
      strategy: { ...vm.strategy, recommendedFrequency: vm.strategy?.recommendedFrequency, recommendedActionLabel: rec }
    }, cls)}
    <p class="mut small">ТРЕНИРУЕМ: ${esc(vm.concept || '—')}</p>
    <p class="trNextHint">Нажми «Далее» или Enter, чтобы продолжить</p>
    <button type="button" class="primary" id="trNext">СЛЕДУЮЩАЯ РАЗДАЧА →</button>
  </div>`;
  wireFeedbackNext(root, h);
};

function summaryScoreBlock(vm) {
  const answered = vm.answered != null ? vm.answered : vm.solved;
  const correct = vm.correctCount != null ? vm.correctCount : vm.nearOptimalCount;
  const total = vm.total > 0 ? vm.total : answered;
  const pct = vm.percentCorrect != null ? `${vm.percentCorrect}%` : '—';
  const mistakes = vm.mistakeCount != null ? vm.mistakeCount : Math.max(0, answered - (correct || 0));
  return `<div class="trSummaryHero" aria-live="polite">
    <span class="ey">СЕССИЯ ЗАВЕРШЕНА</span>
    <h1 class="impact trSummaryScore">${correct != null ? correct : '—'} / ${total}<br><span class="pink">ВЕРНО</span></h1>
    <p class="mut small">${pct !== '—' ? `Точность: <b>${esc(pct)}</b> · ` : ''}Отвечено: <b>${answered}</b></p>
  </div>
  <div class="trSummaryMistakes">
    <span class="ey">ОШИБКИ</span>
    <p class="trSummaryMistakeCount"><b>${mistakes}</b> ${mistakes === 1 ? 'ошибка' : mistakes < 5 ? 'ошибки' : 'ошибок'}</p>
    ${vm.mistakePreview && vm.mistakePreview.length
    ? `<ul class="trMistakePreview mut small">${vm.mistakePreview.map((t) => `<li>${esc(t)}</li>`).join('')}</ul>`
    : (mistakes === 0 ? '<p class="mut small">Без ошибок в этой сессии.</p>' : '')}
  </div>`;
}

export const renderSummary = (root, vm, handlers = {}) => {
  if (!root) return;
  const h = handlers;
  const trendHtml = vm.trend && vm.trend.available
    ? `<div class="verdict"><span class="ey">ПРОГРЕСС (${esc(vm.primaryLabel || '')})</span><p>До: ${vm.trend.beforeAvg.toFixed(2)} BB · После: ${vm.trend.afterAvg.toFixed(2)} BB · разница ${vm.trend.delta > 0 ? '+' : ''}${vm.trend.delta.toFixed(2)} BB</p></div>`
    : `<p class="mut small">Нужно больше решений для оценки прогресса.</p>`;
  const reviewBtn = vm.canReviewMistakes
    ? `<button type="button" class="primary" id="trReviewMistakes" style="margin-top:12px;width:100%">РАЗБОР ОШИБОК →</button>`
    : `<p class="mut small" style="margin-top:12px">Нет ошибок для разбора.</p>`;
  root.innerHTML = `<div class="panel dailyStage trSummary">
    ${summaryScoreBlock(vm)}
    <div class="dualGrade" style="margin-top:14px">
      <div class="gradeBox"><span class="ey">СРЕДНЯЯ ПОТЕРЯ EV</span><b>${vm.avgLossBb != null ? Number(vm.avgLossBb).toFixed(2) : '—'} BB</b></div>
      <div class="gradeBox"><span class="ey">ОКОЛО ОПТИМАЛЬНЫХ</span><b>${vm.nearOptimalCount != null ? vm.nearOptimalCount : '—'} / ${vm.solved}</b></div>
    </div>
    <p class="mut small">Главная тема: ${esc(vm.primaryLabel || '—')}</p>
    ${trendHtml}
    ${reviewBtn}
    <div class="grid2" style="margin-top:14px">
      <button type="button" class="secondary" id="trMore">ЕЩЁ 5 РАЗДАЧ</button>
      <button type="button" class="primary" id="trBack">НАЗАД</button>
    </div>
  </div>`;
  const more = root.querySelector('#trMore');
  const back = root.querySelector('#trBack');
  const rev = root.querySelector('#trReviewMistakes');
  if (more && typeof h.more === 'function') more.onclick = () => h.more();
  if (back && typeof h.back === 'function') back.onclick = () => h.back();
  if (rev && typeof h.reviewMistakes === 'function') rev.onclick = () => h.reviewMistakes();
};

export const renderMistakeReview = (root, { items = [], index = 0 }, handlers = {}) => {
  if (!root) return;
  const h = handlers;
  const vm = mistakeReviewScreenViewModel({ items, index });
  const m = vm.current;
  if (!m) {
    renderMistakeReviewEmpty(root, handlers);
    return;
  }
  const cls = m.gradeClass || 'r';
  root.innerHTML = `<div class="panel dailyStage trMistakeReview" aria-live="polite">
    <span class="ey">РАЗБОР ОШИБОК · ${esc(vm.positionLabel)}</span>
    <h2 class="trMistakeTitle" id="trMistakeFocus" tabindex="-1">${esc(m.title)}</h2>
    ${m.streetRu ? `<p class="mut small">${esc(m.streetRu)}</p>` : ''}
    <div class="gradeBox ${cls}" style="margin:10px 0"><span class="ey">ОЦЕНКА</span><b>${esc(m.grade || '—')}</b></div>
    ${feedbackSectionsHtml({
      chosenAction: m.chosenAction,
      correctAction: m.correctAction,
      why: m.why,
      keyTakeaway: m.keyTakeaway,
      userMistake: m.userMistake,
      strategy: m.feedback && m.feedback.strategy
    }, cls)}
    <div class="trMistakeNav pgControls">
      <button type="button" class="secondary" id="trReviewBack">К ИТОГАМ</button>
      <button type="button" class="primary" id="trReviewNext">${vm.isLast ? 'ГОТОВО →' : 'СЛЕДУЮЩАЯ ОШИБКА →'}</button>
    </div>
  </div>`;
  root.querySelector('#trReviewBack')?.addEventListener('click', () => h.backToSummary?.());
  root.querySelector('#trReviewNext')?.addEventListener('click', () => {
    if (vm.isLast) h.finishReview?.();
    else h.nextMistake?.();
  });
  const focusEl = root.querySelector('#trMistakeFocus');
  try { focusEl?.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
};

export const renderMistakeReviewEmpty = (root, handlers = {}) => {
  if (!root) return;
  root.innerHTML = `<div class="panel dailyStage">
    <span class="ey">РАЗБОР ОШИБОК</span>
    <h1 class="impact">НЕТ<br><span class="pink">ОШИБОК.</span></h1>
    <p class="mut">В этой сессии нечего разбирать — все решения в зелёной зоне.</p>
    <button type="button" class="primary" id="trReviewBack">К ИТОГАМ →</button>
  </div>`;
  root.querySelector('#trReviewBack')?.addEventListener('click', () => handlers.backToSummary?.());
};

export const renderMistakeReviewDone = (root, handlers = {}) => {
  if (!root) return;
  root.innerHTML = `<div class="panel dailyStage">
    <span class="ey">РАЗБОР ЗАВЕРШЁН</span>
    <h1 class="impact">ОШИБКИ<br><span class="pink">ПРОСМОТРЕНЫ.</span></h1>
    <p class="mut small">Вернись к итогам или начни новую сессию.</p>
    <button type="button" class="primary" id="trReviewBack">К ИТОГАМ →</button>
  </div>`;
  root.querySelector('#trReviewBack')?.addEventListener('click', () => handlers.backToSummary?.());
};

export const renderError = (root, vm = {}) => {
  if (!root) return;
  root.innerHTML = `<div class="panel dailyStage">
    <span class="ey">ТРЕНИРОВКА · ОШИБКА</span>
    <h1 class="impact">НЕ<br><span class="pink">ПОЛУЧИЛОСЬ.</span></h1>
    <p class="mut">${esc(vm.message || 'Не удалось подготовить раздачи. Попробуй ещё раз.')}</p>
    <div class="grid2">
      <button type="button" class="secondary" id="trErrBack">НА ГЛАВНУЮ</button>
      <button type="button" class="primary" id="trRetry">ЕЩЁ РАЗ →</button>
    </div>
  </div>`;
  const b = root.querySelector('#trRetry');
  if (b && typeof vm.retry === 'function') b.onclick = () => vm.retry();
  const back = root.querySelector('#trErrBack');
  if (back && typeof vm.back === 'function') back.onclick = () => vm.back();
};

export const renderCancelled = (root, vm = {}) => {
  if (!root) return;
  root.innerHTML = `<div class="panel dailyStage">
    <span class="ey">ТРЕНИРОВКА · ОТМЕНЕНО</span>
    <h1 class="impact">ОК.<br><span class="pink">ПОТОМ.</span></h1>
    <button class="primary" id="trBack">НА ГЛАВНУЮ →</button>
  </div>`;
  const b = root.querySelector('#trBack');
  if (b && typeof vm.back === 'function') b.onclick = () => vm.back();
};

// ---- Placement Test V2 (structured MTT context per mini-app mode) ------------

function placementContextHtml(vm) {
  const ctx = vm.context || {};
  const board = (ctx.board || []).map(cardHtml).join('');
  const hero = (ctx.heroCards || []).map((c) => cardHtml(c)).join('');
  const hist = (ctx.actionHistory || []).map((h) =>
    `<div class="row"><span class="mut small">${esc(h.street)}</span><b>${esc(h.text)}</b></div>`
  ).join('');

  return `<div class="dailyPot">
      <div><span class="ey">MTT</span><b>${esc(ctx.formatLine || 'MTT')}</b></div>
      <div><span class="ey">СТАДИЯ</span><b>${esc(ctx.stageLine || '—')}</b></div>
    </div>
    <div class="row"><span class="mut small">${esc(ctx.stacksLine || '')}</span></div>
    ${ctx.opponent ? `<div class="row"><span class="mut small">Соперник</span><b>${esc(ctx.opponent)}</b></div>` : ''}
    ${hist ? `<div class="rangesField" style="margin-top:8px"><span class="ey">ИСТОРИЯ</span>${hist}</div>` : ''}
    ${board ? `<div class="dailyBoard">${board}</div>` : ''}
    ${hero ? `<div class="cards holeCards">${hero}</div>` : ''}`;
}

function placementReviewHtml(vm) {
  const nodes = vm.reviewNodes || [];
  if (!nodes.length) return '';
  return `<div class="timeline">${nodes.map((n) =>
    `<div class="node"><span class="ey">${esc(n.street)}</span><b>${esc(n.text)}</b></div>`
  ).join('')}</div>`;
}

export const renderPlacementTask = (root, vm = {}, handlers = {}) => {
  if (!root || !vm) return;
  const p = vm.progress || {};
  const mode = vm.mode || 'swipe';
  const ctxBlock = placementContextHtml(vm);
  const reviewBlock = mode === 'review' ? placementReviewHtml(vm) : '';
  const sizingHint = mode === 'sizing' && vm.sizingTargetPct != null
    ? `<p class="mut small">Выбери размер относительно банка ${vm.context?.potBb != null ? vm.context.potBb + ' BB' : ''}</p>`
    : '';

  root.innerHTML = `<div class="panel dailyStage placement-${esc(mode)}">
    <span class="ey">${esc(vm.modeLabel || 'PLACEMENT')} · ${esc(vm.streetRu || '')} · ${p.index} / ${p.total}</span>
    <h1 class="impact">${esc(vm.heading || 'ЧТО СДЕЛАЕШЬ?')}</h1>
    ${ctxBlock}
    ${reviewBlock}
    ${sizingHint}
    <h2>${esc(vm.prompt || '')}</h2>
    <div class="grid2">${(vm.choices || []).map((c) =>
      `<button class="choice" data-achoice="${esc(c.id)}">${esc(c.labelRu)}</button>`).join('')}</div>
  </div>`;
  root.querySelectorAll('[data-achoice]').forEach((b) => {
    b.onclick = () => { if (typeof handlers.answer === 'function') handlers.answer(b.dataset.achoice); };
  });
};

// ---- Primary assessment (P0) — delegates to placement V2 renderer ------------

export const renderAssessment = (root, vm = {}, handlers = {}) => {
  if (!root || !vm) return;
  if (vm.context || vm.mode) {
    renderPlacementTask(root, vm, handlers);
    return;
  }
  if (!vm.q) return;
  const p = vm.progress || {};
  root.innerHTML = `<div class="panel dailyStage">
    <span class="ey">УРОВЕНЬ · ${esc(vm.streetRu || '')} · ${p.index} / ${p.total}</span>
    <h1 class="impact">ЧТО<br><span class="pink">СДЕЛАЕШЬ?</span></h1>
    <p class="mut">${esc(vm.q)}</p>
    <div class="grid2">${(vm.choices || []).map((c) =>
      `<button class="choice" data-achoice="${esc(c.id)}">${esc(c.labelRu)}</button>`).join('')}</div>
  </div>`;
  root.querySelectorAll('[data-achoice]').forEach((b) => {
    b.onclick = () => { if (typeof handlers.answer === 'function') handlers.answer(b.dataset.achoice); };
  });
};

// First-run entry to personalised training: offers the 12-question diagnostic
// (which creates the skill profile driving the personal CTA) alongside the
// validated legacy daily. Rendered only when no leak/skill profile exists yet.
export const renderAssessmentIntro = (root, vm = {}, handlers = {}) => {
  if (!root) return;
  root.innerHTML = `<div class="panel dailyStage">
    <span class="ey">ТРЕНИРОВКА · СТАРТ</span>
    <h1 class="impact">ОПРЕДЕЛИМ<br><span class="pink">ТВОЙ УРОВЕНЬ.</span></h1>
    <p class="mut">${esc(vm.copy || '12 игровых ситуаций. По ответам определим твои сильные стороны и основные ошибки.')}</p>
    <button class="primary" id="trAssess">ОПРЕДЕЛИТЬ УРОВЕНЬ →</button>
    <button class="secondary" id="trLegacy">ОБЩАЯ ТРЕНИРОВКА</button>
  </div>`;
  const a = root.querySelector('#trAssess');
  const l = root.querySelector('#trLegacy');
  if (a && typeof handlers.begin === 'function') a.onclick = () => handlers.begin();
  if (l && typeof handlers.legacy === 'function') l.onclick = () => handlers.legacy();
};

export const renderAssessmentSummary = (root, vm = {}, handlers = {}) => {
  if (!root) return;
  root.innerHTML = `<div class="panel dailyStage">
    <span class="ey">УРОВЕНЬ · ГОТОВО</span>
    <h1 class="impact">${vm.overallLabel ? esc(vm.overallLabel) : 'УРОВЕНЬ'}<br><span class="pink">ОПРЕДЕЛЁН.</span></h1>
    <div class="dualGrade">
      <div class="gradeBox"><span class="ey">УРОВЕНЬ</span><b>${vm.overall != null ? vm.overall : '—'}</b></div>
      <div class="gradeBox"><span class="ey">ВЕРНЫХ</span><b>${vm.correct} / ${vm.answered}</b></div>
    </div>
    <div class="row"><span>Слабый навык</span><b>${esc(vm.weakest || '—')}</b></div>
    <div class="row"><span>Сильный навык</span><b>${esc(vm.strongest || '—')}</b></div>
    <p class="mut small">Тренировки теперь подстраиваются под твои слабые места.</p>
    <button class="primary" id="asBack">К ТРЕНИРОВКЕ →</button>
  </div>`;
  const b = root.querySelector('#asBack');
  if (b && typeof handlers.back === 'function') b.onclick = () => handlers.back();
};