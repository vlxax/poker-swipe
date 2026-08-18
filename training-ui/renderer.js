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
  if (vm.type === 'personalized') {
    root.innerHTML = `<div class="panel dailyStage">
      <span class="ey">ТРЕНИРОВКА · ПЕРСОНАЛЬНАЯ</span>
      <h1 class="impact">${esc(vm.title)}<br><span class="pink">${esc(vm.label)}</span></h1>
      <p class="mut">${esc(vm.definition)}</p>
      <div class="row"><span>${esc(vm.spots)} ${vm.spots === 1 ? 'концепция' : 'концепций'}</span><b>${esc(vm.total)} спотов</b></div>
      <div class="row"><span>Средняя сложность</span><b>${vm.difficulty != null ? vm.difficulty + ' / 5' : '—'}</b></div>
      <h3 style="margin-top:16px">${esc(vm.why)}</h3>
      <p class="mut small">${esc(vm.evidence)}</p>
      <button class="primary" id="trStart">${esc(vm.cta)} →</button>
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
    <span class="ey">ТРЕНИРОВКА · ГЕНЕРАЦИЯ</span>
    <h1 class="impact">СЧИТАЮ<br><span class="pink">СПОТЫ.</span></h1>
    <p class="mut">Солвер пересчитывает твои решения по диапазону и собирает персональные споты. Несколько секунд…</p>
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
    <span class="ey">${esc(vm.streetRu)} · СПОТ ${vm.progress.index} / ${vm.progress.total}</span>
    ${streetDots(vm.street)}
    <div class="dailyPot">
      <div><span class="ey">POT</span><b>${sc.potBb != null ? Number(sc.potBb).toFixed(1) : '—'} BB</b></div>
      <div><span class="ey">EFF</span><b>${sc.effectiveStackBb != null ? Number(sc.effectiveStackBb).toFixed(1) : '—'} BB</b></div>
    </div>
    <div class="row"><span class="mut small">${posRu(sc.heroPosition)} (ТЫ) vs ${posRu(sc.villainPosition)}</span></div>
    <div class="dailyBoard">${board || ''}</div>
    ${hero ? `<div class="cards">${hero}</div>` : ''}
    ${vm.confidence && vm.confidence.available
      ? `<p class="mut small">ТОЧНОСТЬ АНАЛИЗА ${vm.confidence.score}%${vm.confidence.note ? ' — ' + esc(vm.confidence.note) : ''}</p>` : ''}
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
    <div class="regReport"><span class="ey">СТРАТЕГИЯ</span><p>Рекомендация: ${esc(rec)} · частота ${freq}${vm.mixedStrategy ? ' · смешанная стратегия' : ''}</p></div>
    <div class="verdict"><span class="ey">ПОЧЕМУ</span><p class="mut small">${esc(vm.summary || '')}</p><p>${esc(vm.tip || '')}</p></div>
    <p class="mut small">ТРЕНИРУЕМ: ${esc(vm.concept || '—')}</p>
    <button class="primary" id="trNext">СЛЕДУЮЩИЙ СПОТ →</button>
  </div>`;
  const b = root.querySelector('#trNext');
  if (b && typeof h.next === 'function') b.onclick = () => h.next();
};

export const renderSummary = (root, vm, handlers = {}) => {
  if (!root) return;
  const h = handlers;
  const trendHtml = vm.trend && vm.trend.available
    ? `<div class="verdict"><span class="ey">ПРОГРЕСС (${esc(vm.primaryLabel || '')})</span><p>До: ${vm.trend.beforeAvg.toFixed(2)} BB · После: ${vm.trend.afterAvg.toFixed(2)} BB · Δ ${vm.trend.delta > 0 ? '+' : ''}${vm.trend.delta.toFixed(2)} BB</p></div>`
    : `<p class="mut small">Нужно больше решений для оценки прогресса.</p>`;
  root.innerHTML = `<div class="panel dailyStage">
    <span class="ey">СЕССИЯ ЗАВЕРШЕНА</span>
    <h1 class="impact">${vm.solved} РЕШЕНИЙ.<br><span class="pink">ГОТОВО.</span></h1>
    <div class="dualGrade">
      <div class="gradeBox"><span class="ey">СРЕДНЯЯ ПОТЕРЯ EV</span><b>${vm.avgLossBb != null ? Number(vm.avgLossBb).toFixed(2) : '—'} BB</b></div>
      <div class="gradeBox"><span class="ey">ОКОЛО ОПТИМАЛЬНЫХ</span><b>${vm.nearOptimalCount} / ${vm.solved}</b></div>
    </div>
    <p class="mut small">Главный концепт: ${esc(vm.primaryLabel || '—')}</p>
    ${trendHtml}
    <div class="grid2">
      <button class="secondary" id="trMore">ЕЩЁ 5 СПОТОВ</button>
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
    <p class="mut">${esc(vm.message || 'Не удалось собрать споты. Попробуй ещё раз.')}</p>
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