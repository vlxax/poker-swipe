// DOM renderer for the personalised training UI. Renders view models into the
// existing #dailyArea container, reusing the product's daily CSS classes and
// visual identity (dark, `.panel.dailyStage`, `.streetDots`, `.dailyPot`,
// `.dualGrade`, `.gradeBox`, `.verdict`). No logic — pure markup + handler wiring.

import { gradeClass, STREET_RU } from './viewModel.js';

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
    root.innerHTML = `<div class="panel dailyStage">
      <span class="ey">ТРЕНИРОВКА</span>
      <h1 class="impact">${esc(vm.title)}</h1>
      <p class="mut">${esc(vm.subtitle)}</p>
      ${profileHtml}
      ${scoresHtml}
      <p class="ey" style="margin-top:16px">${esc(vm.focusHeading)}</p>
      ${focusHtml}
      <p class="ey" style="margin-top:14px">${esc(vm.whyHeading)}</p>
      <p class="mut small">${esc(vm.whyText)}</p>
      <button class="primary" id="trStart" style="margin-top:16px">${esc(vm.cta)} →</button>
    </div>`;
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
  const h = handlers;
  const sc = vm.scenario || {};
  const board = (sc.board || []).map(cardHtml).join('');
  const hero = (sc.heroCards || []).map((c) => cardHtml(c)).join('');
  root.innerHTML = `<div class="panel dailyStage">
    <span class="ey">${esc(vm.streetRu)} · РАЗДАЧА ${vm.progress.index} / ${vm.progress.total}</span>
    ${streetDots(vm.street)}
    <div class="dailyPot">
      <div><span class="ey">POT</span><b>${sc.potBb != null ? Number(sc.potBb).toFixed(1) : '—'} BB</b></div>
      <div><span class="ey">EFF</span><b>${sc.effectiveStackBb != null ? Number(sc.effectiveStackBb).toFixed(1) : '—'} BB</b></div>
    </div>
    <div class="row"><span class="mut small">${posRu(sc.heroPosition)} (ТЫ) vs ${posRu(sc.villainPosition)}</span></div>
    ${vm.contextLine ? `<p class="mut small">${esc(vm.contextLine)}</p>` : ''}
    ${vm.historyLine ? `<p class="mut small">${esc(vm.historyLine)}</p>` : ''}
    <div class="dailyBoard">${board || ''}</div>
    ${hero ? `<div class="cards">${hero}</div>` : ''}
    ${vm.confidence && vm.confidence.available
      ? `<p class="mut small">УВЕРЕННОСТЬ В РАЗБОРЕ ${vm.confidence.score}%${vm.confidence.note ? ' — ' + esc(vm.confidence.note) : ''}</p>` : ''}
    <h2>${esc(vm.prompt)}</h2>
    <div class="grid2">${vm.options.map((o) =>
      `<button class="choice" data-option="${esc(o.id)}">${esc(o.labelRu)}</button>`).join('')}</div>
  </div>`;
  root.querySelectorAll('[data-option]').forEach((b) => {
    b.onclick = () => { if (typeof h.answer === 'function') h.answer(b.dataset.option); };
  });
};

export const renderFeedback = (root, vm, handlers = {}) => {
  if (!root) return;
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
      <span class="ey">ВСКРЫТИЕ · РАЗБОР</span>
      <h1 class="impact">${esc(vm.verdict || vm.gradeTitle || 'Результат')}</h1>
      <div class="dualGrade">
        <div class="gradeBox ${cls}"><span class="ey">РЕШЕНИЕ</span><b>${esc(vm.correctLine || '—')}</b></div>
        <div class="gradeBox ${cls}"><span class="ey">ПОТЕРЯ EV</span><b>${vm.evLossBb != null ? Number(vm.evLossBb).toFixed(2) : '—'} BB</b></div>
      </div>
      <div class="verdict"><span class="ey">ПОЧЕМУ</span><p class="mut small">${esc(vm.why || '')}</p></div>
      <div class="verdict"><span class="ey">${vm.chosenRecommended ? 'ПОЧЕМУ ТЫ ПРАВ' : 'ТВОЯ ОШИБКА'}</span><p>${esc(vm.userMistake || '')}</p></div>
      <div class="verdict"><span class="ey">ЧТО ЗАПОМНИТЬ</span><p><b>${esc(vm.remember || '—')}</b>${vm.alternative ? `<br><span class="mut small">${esc(vm.alternative)}</span>` : ''}</p></div>
      ${vm.tip ? `<p class="mut small">${esc(vm.tip)}</p>` : ''}
      ${detailHtml}
      <button class="primary" id="trNext">СЛЕДУЮЩАЯ РАЗДАЧА →</button>
    </div>`;
    const b = root.querySelector('#trNext');
    if (b && typeof h.next === 'function') b.onclick = () => h.next();
    return;
  }

  const freq = vm.strategy && vm.strategy.recommendedFrequency != null
    ? Math.round(vm.strategy.recommendedFrequency * 100) + '%'
    : '—';
  const rec = vm.strategy && vm.strategy.recommendedActionLabel ? vm.strategy.recommendedActionLabel : '—';
  root.innerHTML = `<div class="panel dailyStage">
    <span class="ey">ВСКРЫТИЕ · ОЦЕНКА</span>
    <h1 class="impact">${esc(vm.gradeTitle || 'Результат')}</h1>
    <div class="dualGrade">
      <div class="gradeBox ${cls}"><span class="ey">ОЦЕНКА</span><b>${esc(vm.grade)}</b></div>
      <div class="gradeBox ${cls}"><span class="ey">ПОТЕРЯ EV</span><b>${vm.evLossBb != null ? Number(vm.evLossBb).toFixed(2) : '—'} BB</b></div>
    </div>
    <div class="regReport"><span class="ey">СТРАТЕГИЯ</span><p>Рекомендация: ${esc(rec)} · частота ${freq}${vm.mixedStrategy ? ' · можно миксовать линии' : ''}</p></div>
    <div class="verdict"><span class="ey">ПОЧЕМУ</span><p class="mut small">${esc(vm.summary || '')}</p><p>${esc(vm.tip || '')}</p></div>
    <p class="mut small">ТРЕНИРУЕМ: ${esc(vm.concept || '—')}</p>
    <button class="primary" id="trNext">СЛЕДУЮЩАЯ РАЗДАЧА →</button>
  </div>`;
  const b = root.querySelector('#trNext');
  if (b && typeof h.next === 'function') b.onclick = () => h.next();
};

export const renderSummary = (root, vm, handlers = {}) => {
  if (!root) return;
  const h = handlers;
  const trendHtml = vm.trend && vm.trend.available
    ? `<div class="verdict"><span class="ey">ПРОГРЕСС (${esc(vm.primaryLabel || '')})</span><p>До: ${vm.trend.beforeAvg.toFixed(2)} BB · После: ${vm.trend.afterAvg.toFixed(2)} BB · разница ${vm.trend.delta > 0 ? '+' : ''}${vm.trend.delta.toFixed(2)} BB</p></div>`
    : `<p class="mut small">Нужно больше решений для оценки прогресса.</p>`;
  root.innerHTML = `<div class="panel dailyStage">
    <span class="ey">СЕССИЯ ЗАВЕРШЕНА</span>
    <h1 class="impact">${vm.solved} РЕШЕНИЙ.<br><span class="pink">ГОТОВО.</span></h1>
    <div class="dualGrade">
      <div class="gradeBox"><span class="ey">СРЕДНЯЯ ПОТЕРЯ EV</span><b>${vm.avgLossBb != null ? Number(vm.avgLossBb).toFixed(2) : '—'} BB</b></div>
      <div class="gradeBox"><span class="ey">ОКОЛО ОПТИМАЛЬНЫХ</span><b>${vm.nearOptimalCount} / ${vm.solved}</b></div>
    </div>
    <p class="mut small">Главная тема: ${esc(vm.primaryLabel || '—')}</p>
    ${trendHtml}
    <div class="grid2">
      <button class="secondary" id="trMore">ЕЩЁ 5 РАЗДАЧ</button>
      <button class="primary" id="trBack">НАЗАД</button>
    </div>
  </div>`;
  const more = root.querySelector('#trMore');
  const back = root.querySelector('#trBack');
  if (more && typeof h.more === 'function') more.onclick = () => h.more();
  if (back && typeof h.back === 'function') back.onclick = () => h.back();
};

export const renderError = (root, vm = {}) => {
  if (!root) return;
  root.innerHTML = `<div class="panel dailyStage">
    <span class="ey">ТРЕНИРОВКА · ОШИБКА</span>
    <h1 class="impact">НЕ<br><span class="pink">ПОЛУЧИЛОСЬ.</span></h1>
    <p class="mut">${esc(vm.message || 'Не удалось подготовить раздачи. Попробуй ещё раз.')}</p>
    <button class="primary" id="trRetry">ЕЩЁ РАЗ →</button>
  </div>`;
  const b = root.querySelector('#trRetry');
  if (b && typeof vm.retry === 'function') b.onclick = () => vm.retry();
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

// ---- Primary assessment (P0) -------------------------------------------------

export const renderAssessment = (root, vm = {}, handlers = {}) => {
  if (!root || !vm || !vm.q) return;
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