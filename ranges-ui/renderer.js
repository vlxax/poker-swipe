// DOM renderer for the ranges section. Pure markup + handler wiring.

import { MATRIX_RANKS_EXPORT as RANKS } from './matrix.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function chips(items, selected, field) {
  return `<div class="rangesChips">${items.map((item) => {
    const id = item.id || item;
    const label = item.label || item;
    const val = typeof item === 'object' ? item.id : item;
    const on = String(selected) === String(val);
    return `<button type="button" class="rangesChip${on ? ' on' : ''}" data-rfield="${esc(field)}" data-rval="${esc(val)}">${esc(label)}</button>`;
  }).join('')}</div>`;
}

function matrixGrid(cells, selectedHand) {
  const rows = [];
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      let hand;
      if (r === c) hand = RANKS[r] + RANKS[c];
      else if (r < c) hand = RANKS[r] + RANKS[c] + 's';
      else hand = RANKS[c] + RANKS[r] + 'o';
      const cell = cells[hand] || { bucket: 'never', supported: false };
      const cls = cell.bucket || 'never';
      const sel = selectedHand === hand ? ' selected' : '';
      rows.push(`<button type="button" class="rangesCell ${cls}${sel}" data-rhand="${esc(hand)}" aria-label="${esc(hand)}">${esc(hand)}</button>`);
    }
  }
  return `<div class="rangesMatrixWrap"><div class="rangesMatrix">${rows.join('')}</div></div>`;
}

function hintsHtml(hints) {
  if (!hints || !hints.length) return '';
  return hints.map((h) => `<div class="rangesHint">${esc(h.text)}</div>`).join('');
}

function handDetailHtml(d) {
  if (!d) return '';
  return `<div class="rangesDetail">
    <h3>${esc(d.hand)}</h3>
    <div class="row"><span>Действие</span><b>${esc(d.actionLabel)}</b></div>
    <div class="row"><span>Частота</span><b>${d.freqPct}%</b></div>
    ${d.sizeLabel ? `<div class="row"><span>Размер</span><b>${esc(d.sizeLabel)}</b></div>` : ''}
    <p class="mut small" style="margin-top:8px">${esc(d.bucketLabel)}</p>
  </div>`;
}

export function renderSelector(root, vm, handlers = {}) {
  if (!root) return;
  const s = vm.selection || {};
  root.innerHTML = `<div class="panel rangesStage dailyStage">
    <span class="ey">РЕНДЖИ</span>
    <h1 class="impact">${esc(vm.title)}</h1>
    <p class="mut">${esc(vm.intro)}</p>
    ${hintsHtml(vm.hints)}
    <div class="rangesField"><span class="ey">ФОРМАТ</span>${chips(vm.formats, s.format, 'format')}</div>
    <div class="rangesField"><span class="ey">ПОЗИЦИЯ</span>${chips(vm.positions, s.position, 'position')}</div>
    ${vm.showSituation ? `<div class="rangesField"><span class="ey">СИТУАЦИЯ</span>${chips(vm.situations, s.situation, 'situation')}</div>` : ''}
    ${vm.needsOpener && vm.openers && vm.openers.length ? `<div class="rangesField"><span class="ey">ОТКРЫТИЕ С</span>${chips(vm.openers, s.opener, 'opener')}</div>` : ''}
    ${vm.showStack ? `<div class="rangesField"><span class="ey">СТЕК</span>${chips(vm.stacks, s.stack, 'stack')}</div>` : ''}
    <button type="button" class="primary rangesCta" id="rangesShow" ${vm.ctaEnabled ? '' : 'disabled'}>${esc(vm.cta)} →</button>
    ${vm.unavailableNote ? `<p class="mut small rangesNote">Пока недоступно: ${esc(vm.unavailableNote)}.</p>` : ''}
    ${vm.xrayLink ? `<div class="rangesLinkRow"><button type="button" class="secondary" id="rangesXray">СУЗИТЬ ДИАПЗОН ПО УЛИЦАМ →</button></div>` : ''}
  </div>`;
  const show = root.querySelector('#rangesShow');
  if (show) show.onclick = () => { if (vm.ctaEnabled && handlers.show) handlers.show(); };
  const xr = root.querySelector('#rangesXray');
  if (xr && handlers.xray) xr.onclick = () => handlers.xray();
  root.querySelectorAll('[data-rfield]').forEach((b) => {
    b.onclick = () => { if (handlers.setField) handlers.setField(b.dataset.rfield, b.dataset.rval); };
  });
}

export function renderResult(root, vm, handlers = {}) {
  if (!root) return;
  if (vm.phase === 'unsupported') {
    const sug = (vm.suggestions || []).map((x) => x.value).join(', ');
    root.innerHTML = `<div class="panel rangesStage dailyStage rangesEmpty">
      <span class="ey">РЕНДЖ</span>
      <h1 class="impact">НЕТ<br><span class="pink">ДАННЫХ.</span></h1>
      <p>${esc(vm.unsupportedMessage)}</p>
      ${sug ? `<p class="mut small">Попробуй: ${esc(sug)}</p>` : ''}
      <button type="button" class="primary" id="rangesBack" style="margin-top:16px">ИЗМЕНИТЬ СИТУАЦИЮ →</button>
    </div>`;
    const back = root.querySelector('#rangesBack');
    if (back && handlers.back) back.onclick = () => handlers.back();
    return;
  }

  root.innerHTML = `<div class="panel rangesStage dailyStage">
    <span class="ey">РЕНДЖ</span>
    <div class="rangesHeader">
      <b>${esc(vm.contextLine)}</b>
      <span class="mut">${esc(vm.situationLine)}</span>
    </div>
    ${vm.statsLine ? `<p class="rangesStats">${esc(vm.statsLine)}</p>` : ''}
    ${vm.sourceLabel ? `<p class="mut small rangesSource">Источник: ${esc(vm.sourceLabel)}</p>` : ''}
    <p class="rangesLegend">${esc(vm.legend)}<br>Жёлтые — играем иногда.</p>
    ${vm.sourceNote ? `<p class="mut small rangesNote">${esc(vm.sourceNote)}</p>` : ''}
    <button type="button" class="rangesHelpBtn" id="rangesHelp">Как читать таблицу?</button>
    ${hintsHtml(vm.hints)}
    ${matrixGrid(vm.cells, vm.handDetail && vm.handDetail.hand)}
    ${handDetailHtml(vm.handDetail)}
    <button type="button" class="secondary" id="rangesBack" style="margin-top:12px">ИЗМЕНИТЬ СИТУАЦИЮ</button>
  </div>`;

  root.querySelectorAll('[data-rhand]').forEach((b) => {
    b.onclick = () => { if (handlers.selectHand) handlers.selectHand(b.dataset.rhand); };
  });
  const help = root.querySelector('#rangesHelp');
  if (help && handlers.help) help.onclick = () => handlers.help();
  const back = root.querySelector('#rangesBack');
  if (back && handlers.back) back.onclick = () => handlers.back();
}

export function renderHelpOverlay(root, vm, handlers = {}) {
  if (!root) return;
  const host = document.createElement('div');
  host.className = 'rangesOverlay';
  host.innerHTML = `<div class="rangesHelpSheet" role="dialog" aria-modal="true">
    <h2>${esc(vm.title)}</h2>
    ${vm.lines.map((line) => line ? `<p>${esc(line)}</p>` : '<br>').join('')}
    <button type="button" class="primary" id="rangesHelpClose" style="margin-top:14px;width:100%">ПОНЯТНО</button>
  </div>`;
  host.querySelector('#rangesHelpClose').onclick = () => {
    host.remove();
    if (handlers.close) handlers.close();
  };
  host.onclick = (e) => { if (e.target === host) { host.remove(); if (handlers.close) handlers.close(); } };
  root.appendChild(host);
}

export function paint(root, vm, handlers) {
  if (!root || !vm) return;
  if (vm.phase === 'help' || vm.overlay) {
    renderHelpOverlay(document.body, vm, handlers);
    return;
  }
  document.querySelectorAll('.rangesOverlay').forEach((el) => el.remove());
  if (vm.phase === 'selector') renderSelector(root, vm, handlers);
  else renderResult(root, vm, handlers);
}
