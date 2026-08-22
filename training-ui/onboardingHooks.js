// Wire production index.html onboarding (#story) to AssessmentController +
// buildAssessmentSet (12-question personalized diagnostic). Keeps existing
// onboarding visuals; bypasses legacy DIAG / D25 fixed-array runtime when the
// shared training profile should drive the app.

import { placementViewModel, assessmentSummaryViewModel } from './viewModel.js';
import { skillLabelRu } from '../solver/src/index.js';

export function installOnboardingHooks({ assessment, appWindow = null } = {}) {
  if (!assessment) return { assessment: null };
  const root = appWindow || (typeof window !== 'undefined' ? window : globalThis.window);

  function dom() {
    return {
      $: typeof root.$ === 'function' ? root.$ : (sel) => root.document.querySelector(sel),
      $$: typeof root.$$ === 'function' ? root.$$ : (sel) => [...root.document.querySelectorAll(sel)],
      esc: typeof root.esc === 'function' ? root.esc : (s) => String(s == null ? '' : s)
    };
  }

  function assignGlobal(name, fn) {
    const desc = Object.getOwnPropertyDescriptor(root, name);
    if (desc && typeof desc.set === 'function') {
      root[name] = fn;
      return true;
    }
    return false;
  }

  function syncLegacyFromAssessment() {
    const res = assessment.result;
    if (!res || !root.S) return;
    const S = root.S;
    S.diagDone = true;
    S.diagVersion = 12;
    S.diagnostic = (res.results || []).map((r) => ({
      concept: r.concept,
      ok: !!(r.correct || r.nearOptimal),
      score: r.score,
      skill: r.skillTag || null,
      action: r.choice || null,
      street: r.street || null
    }));
    S.diagnosticProfile25 = null;
    S.diagnosticProfile31 = null;
    S.events = (S.events || []).filter((e) => e.mode !== 'diagnostic');
    for (const r of res.results || []) {
      if (typeof root.recordEvent === 'function') {
        root.recordEvent({
          mode: 'diagnostic',
          diagVersion: 12,
          baseline: true,
          concept: r.concept,
          street: r.street,
          action: r.choice,
          grade: r.correct ? 'g' : r.nearOptimal ? 'y' : 'r',
          spotId: r.id,
          policyScore: r.score
        });
      }
    }
    const real = (S.events || []).filter((e) => e.mode !== 'diagnostic' && !e.excludeFromProfile).length;
    if (real < 20 && res.overall != null) S.skill = res.overall;
    if (typeof root.save === 'function') root.save();
  }

  function enterMainApp() {
    const { $ } = dom();
    $('#onboarding')?.classList.add('hidden');
    $('#mainApp')?.classList.remove('hidden');
    root.document.body.classList.add('home-context');
    if (typeof root.renderHome === 'function') root.renderHome();
  }

  function renderQuestion() {
    const { $, $$, esc } = dom();
    const vm = {
      ...placementViewModel({
        item: assessment.current(),
        index: assessment.progress().index,
        total: assessment.progress().total
      }),
      phase: 'question'
    };
    if (!vm.prompt && !vm.q) return;

    const total = vm.progress.total || 12;
    const index = vm.progress.index || 1;
    const pct = total ? ((index - 1) / total) * 100 : 0;
    const ctx = vm.context || {};
    const board = (ctx.board || []).map((c) => (typeof root.card === 'function' ? root.card(c, true) : c)).join('');
    const hero = (ctx.heroCards || []).map((c) => (typeof root.card === 'function' ? root.card(c, true) : c)).join('');
    const hist = (ctx.actionHistory || []).map((h) =>
      `<div style="display:flex;gap:8px;margin:4px 0"><span style="font-size:9px;color:#827b86;min-width:52px">${esc(h.street)}</span><span style="font-size:11px">${esc(h.text)}</span></div>`
    ).join('');
    const reviewNodes = vm.mode === 'review' && vm.reviewNodes
      ? `<div class="timeline" style="margin:12px 0">${vm.reviewNodes.map((n) =>
        `<div class="node" style="text-align:left;padding:8px;margin:4px 0;border:1px solid #2a2830;border-radius:10px"><span class="ey">${esc(n.street)}</span><b style="display:block;margin-top:4px;font-size:11px">${esc(n.text)}</b></div>`
      ).join('')}</div>`
      : '';

    $('#story').onclick = null;
    $('#story').innerHTML = `<div class="v31DiagWrap">
      <div class="v31DiagCard">
        <div style="display:flex;justify-content:space-between;gap:10px;align-items:center">
          <span class="ey">${esc(vm.modeLabel || 'PLACEMENT')} · ${index}/${total}</span>
          <b style="font-size:10px;color:#ff82b4">${esc(vm.streetRu || '')}</b>
        </div>
        <div class="d25Bar" style="margin:10px 0 14px"><i style="width:${pct}%"></i></div>
        <div style="font-size:10px;color:#a69fa8;margin-bottom:8px">${esc(ctx.formatLine || 'MTT')} · ${esc(ctx.stageLine || '')}</div>
        <div style="font-size:11px;margin-bottom:6px">${esc(ctx.stacksLine || '')}</div>
        ${hist ? `<div style="margin:10px 0;padding:10px;border:1px solid #2a2830;border-radius:12px"><span class="ey">ИСТОРИЯ</span>${hist}</div>` : ''}
        ${board ? `<div class="dailyBoard cards" style="display:flex;gap:4px;justify-content:center;margin:8px 0">${board}</div>` : ''}
        ${hero ? `<div class="cards holeCards" style="display:flex;gap:7px;justify-content:center;margin:8px 0">${hero}</div>` : ''}
        ${reviewNodes}
        <h2 class="v31Question">${esc(vm.prompt || vm.q)}</h2>
        <div id="psAssessChoices">${(vm.choices || []).map((c, i) =>
          `<button type="button" class="v31DiagChoice" data-ps-choice-idx="${i}"><span>${esc(c.labelRu)}</span><span>→</span></button>`
        ).join('')}</div>
      </div>
      <p style="font-size:10px;color:#7f7882;text-align:center;margin:10px 20px">MTT placement · ${total} задач · разные механики</p>
    </div>`;

    $$('[data-ps-choice-idx]').forEach((b) => {
      b.onclick = () => {
        const idx = Number(b.dataset.psChoiceIdx);
        const choice = (vm.choices[idx] && vm.choices[idx].id) || null;
        if (!choice) return;
        $$('[data-ps-choice-idx]').forEach((x) => { x.disabled = true; x.style.opacity = x === b ? '1' : '.35'; });
        const item = assessment.current();
        assessment.answer(choice);
        if (item && typeof root.recordEvent === 'function') {
          const correct = choice === item.correct;
          const near = !correct && (item.alsoOk || []).includes(choice);
          root.recordEvent({
            mode: 'diagnostic',
            diagVersion: 12,
            baseline: true,
            concept: item.concept,
            street: item.street,
            action: choice,
            grade: correct ? 'g' : near ? 'y' : 'r',
            spotId: item.id
          });
        }
        setTimeout(() => renderProductionDiagnostic(), 80);
      };
    });
  }

  function renderSummary() {
    const { $, esc } = dom();
    syncLegacyFromAssessment();
    const vm = assessmentSummaryViewModel({ result: assessment.result });
    const weakest = vm.weakest || (assessment.result?.weakestSkill ? skillLabelRu(assessment.result.weakestSkill) : '—');
    const strongest = vm.strongest || (assessment.result?.strongestSkill ? skillLabelRu(assessment.result.strongestSkill) : '—');

    $('#story').innerHTML = `<div class="v31Result">
      <div class="v31ResultHero">
        <span class="ey">ПЕРВЫЙ ПОКЕРНЫЙ ПРОФИЛЬ · ${vm.answered}/${vm.total}</span>
        <h1>${esc(vm.overallLabel || 'УРОВЕНЬ')}</h1>
        <span class="v31RankBadge">${vm.overall != null ? `${vm.overall}/100` : 'ГОТОВО'}</span>
        <p class="v31Human">Сильнее: ${esc(strongest)}. Слабее: ${esc(weakest)}. Дальше тренировки подстроятся под эти зоны.</p>
      </div>
      <div class="v31ResultBlock">
        <h3>Что дальше</h3>
        <div class="v31Evidence">Swipe, Sizing, Review, X-Ray и Quick5 будут подбирать задачи из общего профиля — с анти-повтором и адаптивной сложностью.</div>
      </div>
      <button class="primary" id="psAssessEnter">ВОЙТИ В POKER SWIPE →</button>
    </div>`;

    $('#psAssessEnter').onclick = () => {
      assessment.acknowledgeCompletion();
      enterMainApp();
    };
  }

  function renderProductionDiagnostic() {
    if (!root.S?.onboarded) return;

    if (assessment.state === 'idle' && !assessment.set.length) {
      assessment.begin();
    }

    if (assessment.state === 'answering') {
      renderQuestion();
      return;
    }

    if (assessment.state === 'done' && assessment.shouldShowSummary()) {
      renderSummary();
      return;
    }

    if (root.S.diagDone) enterMainApp();
  }

  function resetAssessment() {
    root.S.diagDone = false;
    assessment.state = 'idle';
    assessment.set = [];
    assessment.answers = [];
    assessment.index = 0;
    assessment.result = null;
    assessment._pendingSummary = false;
  }

  function startProductionDiagnostic({ force = false } = {}) {
    if (force) resetAssessment();
    const { $ } = dom();
    $('#onboarding')?.classList.remove('hidden');
    $('#mainApp')?.classList.add('hidden');
    root.document.body.classList.remove('home-context');
    if (root.D25) root.D25.active = false;
    renderProductionDiagnostic();
  }

  function wrap(name, fn) {
    if (typeof root[name] !== 'function') return;
    const orig = root[name];
    assignGlobal(name, (...args) => fn(orig, ...args));
  }

  wrap('renderDiagnostic', (orig) => {
    if (!root.S?.onboarded) return orig();
    if (root.D25?.active && root.S.diagDone) resetAssessment();
    if (!root.S.diagDone || assessment.state === 'answering' || assessment.shouldShowSummary()) {
      if (root.D25) root.D25.active = false;
      renderProductionDiagnostic();
      return;
    }
    return orig();
  });

  root.startDiagnostic25 = (force = false) => startProductionDiagnostic({ force: !!force });
  root.__renderProductionDiagnostic = () => renderProductionDiagnostic();

  return { assessment, renderProductionDiagnostic };
}
