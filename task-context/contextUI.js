// task-context/contextUI.js
// Единый компонент условий задачи для мини-апок первого раздела.
// Два уровня информации:
//   level 1 — компактный блок на первом экране + кнопка «ВСЕ УСЛОВИЯ»;
//   level 2 — полный контекст в модальном окне (паспорт спота).
// Чистый генератор HTML-строк (без DOM) — тестируется в Node и работает в браузере.
// Стили переиспользуют существующие классы spot30 (см. index.html).

import { positionLabel, blindsLabel } from './schema.js';

const registry = new Map();

export function registerTask(t) {
  if (t && t.id) registry.set(t.id, t);
}
export function getTask(id) {
  return registry.get(id);
}

// Минимальное экранирование пользовательского текста.
export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Стек в ББ: 20 ББ / 20.5 ББ (числа со значением после запятой).
export function bb(n) {
  if (n == null || !(n > 0)) return '—';
  const v = Math.round(n * 10) / 10;
  return (Number.isInteger(v) ? String(v) : String(v).replace('.', ',')) + ' ББ';
}

const FORMAT_LABEL = {
  MTT: 'МТТ', PKO: 'ПКО', SNG: 'СНГ', CASH: 'КЭШ', '3MAX': '3-МАКС', HU: 'ХА'
};
export function formatLabel(f) {
  return FORMAT_LABEL[f] || f;
}

const STREET_LABEL = {
  ПРЕФЛОП: 'ПРЕФЛОП', ФЛОП: 'ФЛОП', ТЁРН: 'ТЁРН', РИВЕР: 'РИВЕР'
};
export function streetLabel(s) {
  return STREET_LABEL[s] || s;
}

function blindText(spot) {
  if (!spot) return '';
  const base = blindsLabel(spot);
  return base;
}

function boardText(spot) {
  return (spot.board || []).join(' ');
}

// --- Уровень 1: компактный блок условий + кнопка «ВСЕ УСЛОВИЯ» ---
export function compactConditions(spot) {
  if (!spot) return '';
  const opp = spot.opp;
  const tags = [
    formatLabel(spot.format),
    spot.stage,
    spot.table,
    spot.left
  ].filter(Boolean);
  const board = boardText(spot);
  return `<div class="spot30 ctxCard">
  <div class="spot30Top">
    <span class="spot30Field">${streetLabel(spot.street)} · УСЛОВИЯ</span>
    <span class="ey">${formatLabel(spot.format)}</span>
  </div>
  <div class="spot30Tags">${tags.map(t => `<span class="spot30Tag">${esc(t)}</span>`).join('')}</div>
  <div class="spot30Grid">
    <div><span>БЛАЙНДЫ</span><b>${esc(blindText(spot))}</b></div>
    <div><span>БАНК</span><b>${bb(spot.pot)}</b></div>
    <div><span>ЭФФ. СТЕК</span><b>${bb(spot.effStack || spot.heroStack)}</b></div>
    <div><span>УЛИЦА</span><b>${esc(streetLabel(spot.street))}</b></div>
    <div><span>ТЫ</span><b>${esc(positionLabel(spot.position))} · ${bb(spot.heroStack)}</b></div>
    <div><span>СОПЕРНИК</span><b>${esc(positionLabel(spot.villain))}${opp ? ' · ' + esc(opp.name) : ''}</b></div>
  </div>
  ${board ? `<div class="spot30Rule"><b>Доска:</b> ${esc(board)}</div>` : ''}
  <button type="button" class="secondary ctxFullBtn" data-ctx-full="${esc(spot.id)}">ВСЕ УСЛОВИЯ →</button>
</div>`;
}

// --- Уровень 2: полный контекст для модального окна ---
export function fullConditions(spot) {
  if (!spot) return '';
  const opp = spot.opp;
  const tags = [
    formatLabel(spot.format),
    spot.stage,
    spot.table,
    spot.left
  ].filter(Boolean);
  const board = boardText(spot);
  const oppRow = opp
    ? `${opp.name} · VPIP ${opp.vpip}% · PFR ${opp.pfr}% · выборка ${opp.sample}`
    : '';
  const history = (spot.history || []).map(h =>
    `<div class="ctxHist"><span class="ctxHistStreet">${esc(streetLabel(h.street))}</span><span class="ctxHistText">${esc(h.text)}</span></div>`
  ).join('');
  return `<div class="spot30 ctxFull">
  <div class="spot30Top">
    <span class="spot30Field">ВСЕ УСЛОВИЯ</span>
    <span class="ey">ПАСПОРТ СПОТА</span>
  </div>
  <div class="spot30Tags">${tags.map(t => `<span class="spot30Tag">${esc(t)}</span>`).join('')}</div>
  <div class="spot30Grid">
    <div><span>ФОРМАТ</span><b>${esc(formatLabel(spot.format))}</b></div>
    <div><span>СТАДИЯ</span><b>${esc(spot.stage)}</b></div>
    <div><span>СТОЛ</span><b>${esc(spot.table)}</b></div>
    <div><span>В ИГРЕ</span><b>${esc(spot.left)}</b></div>
    <div><span>БЛАЙНДЫ</span><b>${esc(blindText(spot))}</b></div>
    <div><span>УЛИЦА</span><b>${esc(streetLabel(spot.street))}</b></div>
    <div><span>ТЫ</span><b>${esc(positionLabel(spot.position))} · ${bb(spot.heroStack)}</b></div>
    <div><span>ТВОИ КАРТЫ</span><b>${esc((spot.hero || []).join(' '))}</b></div>
    <div><span>СОПЕРНИК</span><b>${esc(positionLabel(spot.villain))} · ${bb(spot.villainStack)}</b></div>
    <div><span>ЭФФ. СТЕК</span><b>${bb(spot.effStack || spot.heroStack)}</b></div>
    <div><span>БАНК</span><b>${bb(spot.pot)}</b></div>
    <div><span>СЛОЖНОСТЬ</span><b>${'●'.repeat(spot.difficulty || 1)}${'○'.repeat(Math.max(0, 3 - (spot.difficulty || 1)))}</b></div>
  </div>
  ${board ? `<div class="spot30Rule"><b>Доска:</b> ${esc(board)}</div>` : ''}
  ${oppRow ? `<div class="spot30Rule"><b>Соперник:</b> ${esc(oppRow)}${opp.sample ? ` · ${esc(opp.sample)} раздач` : ''}</div>` : ''}
  ${opp && opp.note ? `<div class="spot30Rule"><b>О нём:</b> ${esc(opp.note)}</div>` : ''}
  ${history ? `<div class="spot30Rule"><b>История раздачи:</b><div class="ctxHistList">${history}</div></div>` : ''}
  ${spot.question ? `<div class="spot30Rule"><b>Вопрос:</b> ${esc(spot.question)}</div>` : ''}
  ${spot.concept ? `<div class="spot30Rule"><b>Концепция:</b> ${esc(spot.concept)}</div>` : ''}
</div>`;
}

// Обёртка полного контекста + кнопка закрытия (вставляется в openModal).
export function fullContextModal(spot) {
  return `<div class="ctxModal">
  ${fullConditions(spot)}
  <button type="button" class="primary ctxCloseBtn">ПОНЯТНО →</button>
</div>`;
}

// Обработчик кликов по кнопкам «ВСЕ УСЛОВИЯ» внутри root.
// lookup(id) — функция получения задачи по id; openModal/closeModal — DOM-функции приложения.
export function wireContextButtons(root, { lookup = getTask, openModal, closeModal } = {}) {
  if (!root || !root.querySelectorAll) return;
  root.querySelectorAll('[data-ctx-full]').forEach(btn => {
    btn.onclick = () => {
      const spot = lookup(btn.dataset.ctxFull);
      if (!spot) return;
      if (openModal) {
        openModal(fullContextModal(spot));
        setTimeout(() => {
          const m = root.querySelector('.ctxCloseBtn');
          if (m) m.onclick = () => closeModal && closeModal();
        }, 0);
      }
    };
  });
}