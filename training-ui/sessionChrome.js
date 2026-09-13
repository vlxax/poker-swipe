// Shared session progress + feedback layout (presentation only).

function esc(s) {
  return typeof window !== 'undefined' && typeof window.esc === 'function'
    ? window.esc(s)
    : String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function sessionProgressHtml(sp) {
  if (!sp || !sp.total) return '';
  const pct = Math.min(100, Math.round((sp.index / sp.total) * 100));
  const scoreLine = sp.correct != null && sp.answered
    ? `<span class="trSessionScore">${sp.correct} из ${sp.answered} верно</span>`
    : (sp.remaining != null ? `<span class="trSessionScore">осталось ~${sp.remaining}</span>` : '');
  return `<div class="trSessionHead">
    <div class="trSessionProgress" role="progressbar" aria-valuenow="${sp.index}" aria-valuemin="1" aria-valuemax="${sp.total}" aria-label="Прогресс тренировки">
      <div class="trSessionProgressFill" style="width:${pct}%"></div>
    </div>
    <div class="trSessionMeta">
      <span class="ey">РАЗДАЧА ${sp.index} / ${sp.total}</span>
      ${scoreLine}
    </div>
  </div>`;
}

export function feedbackSectionsHtml(vm, cls) {
  const chosen = vm.chosenAction || '—';
  const correct = vm.correctAction || vm.correctLine || (vm.strategy && vm.strategy.recommendedActionLabel) || '—';
  let freqLine = '';
  if (vm.strategy && vm.strategy.recommendedFrequency != null) {
    freqLine = `<p class="mut small">Частота ${Math.round(vm.strategy.recommendedFrequency * 100)}%</p>`;
  } else if (vm.mixedStrategy) {
    freqLine = '<p class="mut small">Допустим микс линий</p>';
  }
  const why = vm.why || vm.summary || '';
  const takeaway = vm.keyTakeaway || vm.remember || vm.concept || '';
  const mistake = vm.userMistake || '';
  return `<div class="trFeedbackSections" aria-live="polite">
    <div class="trFeedbackBlock trFbYour">
      <span class="ey">ТВОЙ ХОД</span>
      <b>${esc(chosen)}</b>
    </div>
    <div class="trFeedbackBlock trFbCorrect ${cls}">
      <span class="ey">ВЕРНАЯ ЛИНИЯ</span>
      <b>${esc(correct)}</b>
      ${freqLine}
    </div>
    ${why ? `<div class="trFeedbackBlock"><span class="ey">ПОЧЕМУ</span><p class="mut small">${esc(why)}</p></div>` : ''}
    ${mistake && !vm.chosenRecommended ? `<div class="trFeedbackBlock"><span class="ey">РАЗБОР ОШИБКИ</span><p class="mut small">${esc(mistake)}</p></div>` : ''}
    ${takeaway ? `<div class="trFeedbackBlock"><span class="ey">ЗАПОМНИ</span><p><b>${esc(takeaway)}</b>${vm.alternative ? `<br><span class="mut small">${esc(vm.alternative)}</span>` : ''}</p></div>` : ''}
  </div>`;
}

export function choiceClass(o, vm) {
  const parts = ['choice', 'pgBubblePress'];
  if (vm.isAnswering && vm.pendingOptionId === o.id) parts.push('is-pending');
  if (vm.reviewChoiceId === o.id) {
    parts.push(vm.reviewChoiceCorrect ? 'is-correct' : 'is-incorrect');
  }
  if (vm.selectedOptionId === o.id) parts.push('selected');
  return parts.join(' ');
}

export function wireFeedbackNext(root, h) {
  const b = root.querySelector('#trNext');
  if (!b || typeof h.next !== 'function') return;
  const go = () => h.next();
  b.onclick = go;
  try { b.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
  const onKey = (ev) => {
    if (ev.key === 'Enter' && !ev.repeat && document.activeElement !== b) {
      ev.preventDefault();
      go();
    }
  };
  root.addEventListener('keydown', onKey, { once: true });
}
