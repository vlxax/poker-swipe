// DOM renderer for range narrowing trainer — game interface: HUD + matrix arena.

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

function headWithBack(titleHtml, app) {
  const nav = window.MiniAppNav;
  if (!nav) return titleHtml;
  const disabled = !nav.canBack(app);
  return nav.headRow(app, titleHtml, { disabled });
}

function wireRangesBack(root, handlers) {
  window.MiniAppNav?.wire(root, 'ranges', () => handlers.back?.());
}

/** Compact HUD strip — no timeline, no paragraphs */
function hudStrip(vm) {
  const chips = [vm.formatLabel, vm.stageLabel, vm.tableLabel].filter(Boolean)
    .map((t) => `<span class="pgChip">${esc(t)}</span>`).join('');
  const stats = [
    vm.heroLabel ? `<div class="pgStat"><span>ТЫ</span><b>${esc(vm.heroLabel)}</b></div>` : '',
    vm.villainLabel ? `<div class="pgStat"><span>VILL</span><b>${esc(vm.villainLabel)}</b></div>` : '',
    vm.potLabel ? `<div class="pgStat"><span>БАНК</span><b>${esc(vm.potLabel)}</b></div>` : '',
    vm.stackLabel ? `<div class="pgStat"><span>ЭФФ.</span><b>${esc(vm.stackLabel)}</b></div>` : ''
  ].filter(Boolean).join('');
  return `<div class="pgHud">${chips}${stats}</div>`;
}

export function renderIntro(root, vm, handlers = {}) {
  if (!root) return;
  root.innerHTML = `<div class="panel pgShell pgRanges">
    <div class="pgHud">${headWithBack(`<div class="pgHudTitle"><h1 class="impact">${esc(vm.title)}</h1><span class="ey">ТРЕНАЖЁР</span></div>`, 'ranges')}</div>
    ${hudStrip(vm)}
    <div class="pgXrayArena" style="flex:1;padding:12px">
      <p class="rangesLead" style="font-size:11px;margin:0 0 8px">${esc(vm.headline)}</p>
      ${hintsHtml(vm.hints)}
    </div>
    <div class="pgControls">
      <button type="button" class="primary pgCta pgBubblePress" id="rangesStart">${esc(vm.cta)}</button>
      <button type="button" class="rangesHelpBtn" id="rangesHelp">Как проходить?</button>
    </div>
  </div>`;

  wireRangesBack(root, handlers);
  root.querySelector('#rangesStart').onclick = () => handlers.begin?.();
  const help = root.querySelector('#rangesHelp');
  if (help) help.onclick = () => handlers.help?.();
}

export function renderPlay(root, vm, handlers = {}) {
  if (!root) return;
  root.innerHTML = `<div class="panel pgRangesPlay pgShell">
    <div class="pgHud">
      ${headWithBack(`<div class="pgHudTitle"><h2>${esc(vm.question)}</h2><span class="ey">${esc(vm.stepLabel)} · ${vm.keptCount}/${vm.candidateCount}</span></div>`, 'ranges')}
    </div>
    ${hudStrip(vm)}
    <div class="rangesActionChip">${esc(vm.actionLine)}</div>
    ${legendHtml()}
    ${matrixGrid(vm.matrix, { interactive: true })}
    ${hintsHtml(vm.hints)}
    <button type="button" class="primary rangesCta pgCta pgBubblePress" id="rangesConfirm">${esc(vm.cta)}</button>
    <button type="button" class="rangesHelpBtn" id="rangesHelp">Как проходить?</button>
  </div>`;

  wireRangesBack(root, handlers);
  root.querySelectorAll('[data-rhand]').forEach((b) => {
    b.onclick = () => {
      window.PsMotion?.rangesCellFlash(b);
      handlers.toggle?.(b.dataset.rhand);
    };
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
      ${reviewLegendHtml()}
      ${matrixGrid(step.matrix, { interactive: false })}
      ${wrong}
      ${fb}
    </section>`;
  }).join('');

  const summaryLines = (vm.summaryLines || []).map((line) => `<p class="rangesSummaryLine">${esc(line)}</p>`).join('');

  root.innerHTML = `<div class="panel rangesStage pgShell">
    <div class="pgHud">${headWithBack(`<div class="pgHudTitle"><h1 class="impact">${esc(vm.title)}</h1><span class="ey">РАЗБОР</span></div>`, 'ranges')}</div>
    <div class="rangesScoreBadge">${vm.avgAccuracy}%</div>
    <p class="rangesLead">${esc(vm.headline)}</p>
    ${summaryLines}
    ${stepsHtml}
    <div class="pgControls"><button type="button" class="primary pgCta pgBubblePress" id="rangesNext">${esc(vm.cta)}</button></div>
  </div>`;

  wireRangesBack(root, handlers);
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

export function renderSelector(root, vm, handlers) {
  renderIntro(root, vm, { begin: handlers.show, help: handlers.help });
}

function chipRow(label, options, field, current, handlerKey) {
  if (!options?.length) return '';
  return `<div class="rangesField"><span class="rangesFieldLabel">${esc(label)}</span><div class="rangesChips">${options.map((o) => {
    const val = typeof o === 'object' ? o.id : o;
    const lbl = typeof o === 'object' ? o.label : o;
    const on = String(current) === String(val) ? ' on' : '';
    return `<button type="button" class="rangesChip${on}" data-field="${esc(field)}" data-value="${esc(val)}">${esc(lbl)}</button>`;
  }).join('')}</div></div>`;
}

function trainerMatrixCellClass(cell) {
  if (!cell?.supported) return 'dead';
  if (cell.trainerActionRaw === 'AI') return 'trainer-ai';
  if (cell.trainerActionRaw === 'RAISE') return 'trainer-raise';
  if (cell.trainerActionRaw === 'UNSELECTED') return 'trainer-unselected';
  if (cell.dataStatus === 'NEEDS_CLARIFICATION') return 'trainer-unknown';
  return 'trainer-partial';
}

function trainerMatrixGrid(cells, { selectedHand = null } = {}) {
  const rows = [];
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      let hand;
      if (r === c) hand = RANKS[r] + RANKS[c];
      else if (r < c) hand = RANKS[r] + RANKS[c] + 's';
      else hand = RANKS[c] + RANKS[r] + 'o';
      const cell = cells[hand] || { hand, supported: false };
      const cls = trainerMatrixCellClass(cell);
      const sel = selectedHand === hand ? ' selected' : '';
      const label = cell.actionLabel || cell.trainerActionRaw || '—';
      rows.push(`<button type="button" class="rangesCell ${cls}${sel}" data-thand="${esc(hand)}" aria-label="${esc(hand)} ${esc(label)}"><span class="rangesCellLabel">${esc(hand)}</span></button>`);
    }
  }
  return `<div class="rangesMatrixWrap"><div class="rangesMatrix">${rows.join('')}</div></div>`;
}

function trainerLegendHtml() {
  return `<div class="rangesLegendBar">
    <span class="rangesLegendItem"><i class="rangesLegendSwatch trainer-ai"></i>AI</span>
    <span class="rangesLegendItem"><i class="rangesLegendSwatch trainer-raise"></i>Рейз</span>
    <span class="rangesLegendItem"><i class="rangesLegendSwatch trainer-unselected"></i>UNSELECTED</span>
    <span class="rangesLegendItem"><i class="rangesLegendSwatch trainer-unknown"></i>?</span>
  </div>`;
}

export function renderTrainerHub(root, vm, handlers = {}) {
  if (!root) return;
  root.innerHTML = `<div class="panel pgShell pgRanges">
    <div class="pgHud">${headWithBack(`<div class="pgHudTitle"><h1 class="impact">${esc(vm.title)}</h1><span class="ey">ТРЕНЕР</span></div>`, 'ranges')}</div>
    <p class="rangesLead">${esc(vm.subtitle || '')}</p>
    <div class="pgControls" style="gap:10px">
      <button type="button" class="primary pgCta pgBubblePress" id="rangesTrainerBtn">ТРЕНЕРСКИЕ РЕНДЖИ</button>
      <button type="button" class="rangesHelpBtn" id="rangesNarrowBtn">Сужение диапазона →</button>
    </div>
  </div>`;
  wireRangesBack(root, handlers);
  root.querySelector('#rangesTrainerBtn').onclick = () => handlers.openTrainer?.();
  root.querySelector('#rangesNarrowBtn').onclick = () => handlers.openNarrowing?.();
}

export function renderTrainerSelector(root, vm, handlers = {}) {
  if (!root) return;
  const sel = vm.selection || {};
  root.innerHTML = `<div class="panel pgShell pgRanges">
    <div class="pgHud">${headWithBack(`<div class="pgHudTitle"><h1 class="impact">${esc(vm.title)}</h1><span class="ey">${esc(vm.subtitle)}</span></div>`, 'ranges')}</div>
    <p class="rangesDisclaimer">${esc(vm.disclaimer || '')}</p>
    ${chipRow('Ситуация', vm.situations, 'situation', sel.situation)}
    ${chipRow('Позиция', vm.positions, 'position', sel.position)}
    ${vm.showStack ? chipRow('Стек', vm.stacks, 'stackBand', sel.stackBand || sel.stack) : ''}
    ${vm.showSpot ? chipRow('Спот', vm.spots, 'trainerSpot', sel.trainerSpot) : ''}
    <div class="pgControls">
      <button type="button" class="primary pgCta pgBubblePress" id="rangesShow" ${vm.complete ? '' : 'disabled'}>${esc(vm.cta)}</button>
    </div>
  </div>`;
  wireRangesBack(root, handlers);
  root.querySelectorAll('[data-field]').forEach((btn) => {
    btn.onclick = () => handlers.setField?.(btn.dataset.field, btn.dataset.value);
  });
  const show = root.querySelector('#rangesShow');
  if (show) show.onclick = () => handlers.showRange?.();
}

export function renderTrainerMatrix(root, vm, handlers = {}) {
  if (!root) return;
  const meta = vm.chartMeta || {};
  const match = vm.matchStatus || 'NO_TRAINER_DATA';
  const mismatch = (vm.mismatches || []).map((m) => `<li>${esc(m)}</li>`).join('');
  const prov = vm.provenanceDebug ? `<p class="rangesProv">${esc(vm.provenanceDebug)}</p>` : '';
  root.innerHTML = `<div class="panel pgRangesPlay pgShell">
    <div class="pgHud">${headWithBack(`<div class="pgHudTitle"><h2>${esc(vm.subtitle)}</h2><span class="ey">${esc(match)}</span></div>`, 'ranges')}</div>
    <div class="rangesActionChip">${esc(meta.sourceMode || '')} · ${esc(meta.rawSpot || 'UO')} · ${esc(meta.stack || '')} · ${esc(meta.heroPosition?.raw || '')}</div>
    ${mismatch ? `<ul class="rangesMismatch">${mismatch}</ul>` : ''}
    ${trainerLegendHtml()}
    ${trainerMatrixGrid(vm.cells || {}, { selectedHand: vm.selectedHand })}
    <p class="rangesStats">gradable: ${vm.stats?.gradable || 0} · unknown: ${vm.stats?.unknown || 0} · UNSELECTED: ${vm.stats?.unselected || 0}</p>
    ${prov}
    <div id="rangesHandDetail"></div>
    <button type="button" class="rangesHelpBtn" id="rangesBackSel">${esc(vm.cta)}</button>
  </div>`;
  wireRangesBack(root, handlers);
  root.querySelectorAll('[data-thand]').forEach((btn) => {
    btn.onclick = () => handlers.selectHand?.(btn.dataset.thand);
  });
  root.querySelector('#rangesBackSel').onclick = () => handlers.back?.();
  if (vm.handDetail) {
    const d = vm.handDetail;
    root.querySelector('#rangesHandDetail').innerHTML = `<div class="rangesHandPanel">
      <b>${esc(d.hand)}</b> → ${esc(d.trainerActionRaw || d.actionLabel || '—')}
      <span class="ey">${esc(d.dataStatus || '')}</span>
      ${d.gradingAllowed ? '' : '<span class="rangesWarn">не для grading</span>'}
    </div>`;
  }
}

export function renderTrainerLoading(root, vm) {
  if (!root) return;
  root.innerHTML = `<div class="panel rangesStage"><p>${esc(vm.message || 'Загрузка…')}</p></div>`;
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

  if (vm.phase === 'hub') renderTrainerHub(root, vm, handlers);
  else if (vm.phase === 'selector') renderTrainerSelector(root, vm, handlers);
  else if (vm.phase === 'matrix') renderTrainerMatrix(root, vm, handlers);
  else if (vm.phase === 'loading') renderTrainerLoading(root, vm);
  else if (vm.phase === 'error') {
    root.innerHTML = `<div class="panel rangesStage"><p>${esc(vm.message)}</p><button type="button" class="primary" id="rangesErrBack">НАЗАД</button></div>`;
    root.querySelector('#rangesErrBack').onclick = () => handlers.back?.();
  }
  else if (vm.phase === 'intro') renderIntro(root, vm, handlers);
  else if (vm.phase === 'play') renderPlay(root, vm, handlers);
  else if (vm.phase === 'summary') renderSummary(root, vm, handlers);
  else renderIntro(root, vm, handlers);
}
