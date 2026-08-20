// DOM renderer for range narrowing trainer.

import { MATRIX_RANKS_EXPORT as RANKS, policySegments } from './matrix.js';

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

function hintsHtml(hints) {
  if (!hints?.length) return '';
  return hints.map((h) => `<div class="rangesHint">${esc(h.text)}</div>`).join('');
}

function mixBarsHtml(policy = {}) {
  const segs = policySegments(policy);
  if (!segs.length) return '';
  return `<span class="rangesMix" aria-hidden="true">${segs.map((seg) => {
    const cls = seg.action.toLowerCase();
    return `<span class="rangesMixSeg ${cls}" style="flex:${seg.frac.toFixed(4)}"></span>`;
  }).join('')}</span>`;
}

function matrixGrid(rows, { interactive = false, selectedHand = null } = {}) {
  const cells = [];
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      let hand;
      if (r === c) hand = RANKS[r] + RANKS[c];
      else if (r < c) hand = RANKS[r] + RANKS[c] + 's';
      else hand = RANKS[c] + RANKS[r] + 'o';

      const cell = rows.find((x) => x.hand === hand) || { hand, state: 'dead', candidate: false };
      const cls = cell.state || 'dead';
      const mix = cell.mixed ? mixBarsHtml(cell.policy) : '';
      const sel = selectedHand === hand ? ' selected' : '';
      const disabled = !interactive || !cell.candidate ? ' disabled' : '';
      const tag = interactive && cell.candidate ? 'button' : 'div';
      cells.push(
        `<${tag} ${interactive && cell.candidate ? 'type="button"' : ''} class="rangesCell ${cls}${sel}${disabled ? ' isDisabled' : ''}" ${interactive && cell.candidate ? `data-rhand="${esc(hand)}"` : ''} aria-label="${esc(hand)}"><span class="rangesCellLabel">${esc(hand)}</span>${mix}</${tag}>`
      );
    }
  }
  return `<div class="rangesMatrixWrap"><div class="rangesMatrix">${cells.join('')}</div></div>`;
}

function legendHtml() {
  return `<div class="rangesLegendBar">
    <span class="rangesLegendItem"><i class="rangesLegendSwatch kept"></i>Оставил</span>
    <span class="rangesLegendItem"><i class="rangesLegendSwatch out"></i>Убрал</span>
    <span class="rangesLegendItem"><i class="rangesLegendSwatch dead"></i>Вне задачи</span>
    <span class="rangesLegendItem"><i class="rangesLegendSwatch mixed"></i>Смешанная</span>
  </div>`;
}

function reviewLegendHtml() {
  return `<div class="rangesLegendBar">
    <span class="rangesLegendItem"><i class="rangesLegendSwatch ok"></i>Верно</span>
    <span class="rangesLegendItem"><i class="rangesLegendSwatch bad"></i>Ошибка</span>
    <span class="rangesLegendItem"><i class="rangesLegendSwatch mixed"></i>Mixed</span>
  </div>`;
}

function situationCard(vm) {
  const rows = [
    vm.formatLabel ? `<div class="rangesSitRow"><span>Формат</span><b>${esc(vm.formatLabel)}</b></div>` : '',
    vm.heroLabel ? `<div class="rangesSitRow"><span>Ты</span><b>${esc(vm.heroLabel)}</b></div>` : '',
    vm.villainLabel ? `<div class="rangesSitRow"><span>Оппонент</span><b>${esc(vm.villainLabel)}</b></div>` : '',
    vm.potLabel ? `<div class="rangesSitRow"><span>Банк</span><b>${esc(vm.potLabel)}</b></div>` : ''
  ].filter(Boolean).join('');

  const timeline = (vm.steps || []).map((s) =>
    `<li><b>${esc(s.actionLabel)}</b><span>${esc(s.actionLine)}</span></li>`
  ).join('');

  return `<div class="rangesSitCard">${rows}
    ${timeline ? `<ol class="rangesTimeline">${timeline}</ol>` : ''}
  </div>`;
}

export function renderIntro(root, vm, handlers = {}) {
  if (!root) return;
  root.innerHTML = `<div class="panel rangesStage dailyStage">
    <span class="ey">ТРЕНАЖЁР</span>
    <h1 class="impact">${esc(vm.title)}</h1>
    <p class="rangesLead">${esc(vm.headline)}</p>
    <p class="mut">${esc(vm.subtitle)}</p>
    ${hintsHtml(vm.hints)}
    ${situationCard(vm)}
    <p class="rangesStepMeta">${vm.stepCount} шаг${vm.stepCount > 1 ? 'а' : ''} · hand reading</p>
    <button type="button" class="primary rangesCta" id="rangesStart">${esc(vm.cta)}</button>
    <button type="button" class="rangesHelpBtn" id="rangesHelp">Как проходить?</button>
  </div>`;

  root.querySelector('#rangesStart').onclick = () => handlers.begin?.();
  const help = root.querySelector('#rangesHelp');
  if (help) help.onclick = () => handlers.help?.();
}

export function renderPlay(root, vm, handlers = {}) {
  if (!root) return;
  root.innerHTML = `<div class="panel rangesStage dailyStage">
    <div class="rangesPlayTop">
      <span class="ey">${esc(vm.stepLabel)}</span>
      <span class="rangesCounter">${vm.keptCount}/${vm.candidateCount}</span>
    </div>
    <h2 class="rangesQuestion">${esc(vm.question)}</h2>
    <div class="rangesActionChip">${esc(vm.actionLine)}</div>
    <p class="mut rangesNarrative">${esc(vm.narrative)}</p>
    ${hintsHtml(vm.hints)}
    ${legendHtml()}
    ${matrixGrid(vm.matrix, { interactive: true })}
    <button type="button" class="primary rangesCta" id="rangesConfirm">${esc(vm.cta)}</button>
    <button type="button" class="rangesHelpBtn" id="rangesHelp">Как проходить?</button>
  </div>`;

  root.querySelectorAll('[data-rhand]').forEach((b) => {
    b.onclick = () => handlers.toggle?.(b.dataset.rhand);
  });
  root.querySelector('#rangesConfirm').onclick = () => handlers.confirm?.();
  const help = root.querySelector('#rangesHelp');
  if (help) help.onclick = () => handlers.help?.();
}

export function renderSummary(root, vm, handlers = {}) {
  if (!root) return;
  const stepsHtml = (vm.steps || []).map((step) => {
    const fb = (step.feedback || []).map((line) => `<p class="rangesFeedbackLine">${esc(line)}</p>`).join('');
    const wrong = [
      step.keptWrong.length ? `<p class="rangesWrong">Лишние: ${esc(step.keptWrong.slice(0, 8).join(', '))}${step.keptWrong.length > 8 ? '…' : ''}</p>` : '',
      step.removedWrong.length ? `<p class="rangesWrong">Убрал зря: ${esc(step.removedWrong.slice(0, 8).join(', '))}${step.removedWrong.length > 8 ? '…' : ''}</p>` : ''
    ].filter(Boolean).join('');
    return `<section class="rangesReviewStep">
      <div class="rangesReviewHead"><b>Шаг ${step.index}: ${esc(step.actionLabel)}</b><span>${step.accuracy}%</span></div>
      <p class="mut">${esc(step.question)}</p>
      ${reviewLegendHtml()}
      ${matrixGrid(step.matrix, { interactive: false })}
      ${wrong}
      ${fb}
    </section>`;
  }).join('');

  const summaryLines = (vm.summaryLines || []).map((line) => `<p class="rangesSummaryLine">${esc(line)}</p>`).join('');

  root.innerHTML = `<div class="panel rangesStage dailyStage">
    <span class="ey">РАЗБОР</span>
    <h1 class="impact">${esc(vm.title)}</h1>
    <div class="rangesScoreBadge">${vm.avgAccuracy}%</div>
    <p class="rangesLead">${esc(vm.headline)}</p>
    ${summaryLines}
    ${stepsHtml}
    <button type="button" class="primary rangesCta" id="rangesNext">${esc(vm.cta)}</button>
  </div>`;

  root.querySelector('#rangesNext').onclick = () => handlers.next?.();
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
    handlers.close?.();
  };
  host.onclick = (e) => { if (e.target === host) { host.remove(); handlers.close?.(); } };
  root.appendChild(host);
}

// Legacy no-op exports for older test imports.
export function renderSelector(root, vm, handlers) {
  renderIntro(root, vm, { begin: handlers.show, help: handlers.help });
}

export function renderResult(root, vm, handlers) {
  if (vm.phase === 'unsupported') {
    root.innerHTML = `<div class="panel rangesStage dailyStage rangesEmpty"><p>${esc(vm.unsupportedMessage || 'Нет данных')}</p><button type="button" class="primary" id="rangesBack">НАЗАД</button></div>`;
    root.querySelector('#rangesBack').onclick = () => handlers.back?.();
    return;
  }
  renderPlay(root, vm, { toggle: handlers.selectHand, confirm: handlers.show, help: handlers.help });
}

export function paint(root, vm, handlers) {
  if (!root || !vm) return;
  if (vm.phase === 'help' || vm.overlay) {
    renderHelpOverlay(document.body, vm, handlers);
    return;
  }
  document.querySelectorAll('.rangesOverlay').forEach((el) => el.remove());

  if (vm.phase === 'intro') renderIntro(root, vm, handlers);
  else if (vm.phase === 'play') renderPlay(root, vm, handlers);
  else if (vm.phase === 'summary') renderSummary(root, vm, handlers);
  else renderIntro(root, vm, handlers);
}
