// Training scenarios built from Greenline reference ranges.

import { matrixClasses } from './matrix.js';
import { inventoryReference, lookupReferenceRange } from './referenceRanges.js';
import { selectionFromReference } from './narrowingEngine.js';

const ALL_HANDS = matrixClasses();

function refSel(position, situation, opener = null) {
  return {
    dataSource: 'reference',
    format: '6max',
    position,
    situation,
    opener,
    stack: null
  };
}

function attachTruth(step) {
  const truth = selectionFromReference(step.truthSel);
  return { ...step, truth };
}

function buildIntro(scenario) {
  return {
    formatLabel: '6-max',
    villain: scenario.villainLabel || null,
    hero: scenario.heroLabel || null,
    pot: scenario.potLabel || 'банк формируется',
    stack: scenario.stackLabel || null
  };
}

function rfiReadStep(position) {
  const sel = refSel(position, 'rfi');
  if (!lookupReferenceRange(sel)) return null;

  return attachTruth({
    id: `${position.toLowerCase()}-open`,
    actionLabel: `${position} открывает`,
    actionLine: `${position} открывает 2.2bb`,
    question: `Что остаётся в диапазоне открытия ${position}?`,
    narrative: `Стол дошёл до ${position}. Соперник открывает — какие классы рук ты оставляешь в его диапазоне?`,
    candidateHands: ALL_HANDS,
    truthSel: sel
  });
}

function vsOpenDefenseStep(hero, villain) {
  const sel = refSel(hero, 'vs_open', villain);
  if (!lookupReferenceRange(sel)) return null;

  return attachTruth({
    id: `${hero.toLowerCase()}-defend-vs-${villain.toLowerCase()}-open`,
    actionLabel: `${villain} открыл`,
    actionLine: `${villain} открывает, ты на ${hero} — твой ответ`,
    question: `С чем ${hero} продолжит против открытия ${villain}?`,
    narrative: `Ты на ${hero}. Соперник открыл — отметь руки, с которыми ты реально защищаешься.`,
    candidateHands: ALL_HANDS,
    truthSel: sel
  });
}

function vs3betContinueStep(hero, villain) {
  const openSel = refSel(hero, 'rfi');
  const sel = refSel(hero, 'vs_3bet', villain);
  if (!lookupReferenceRange(openSel) || !lookupReferenceRange(sel)) return null;

  return attachTruth({
    id: `${hero.toLowerCase()}-continue-vs-3bet-${villain.toLowerCase()}`,
    actionLabel: `${villain} 3-бетит`,
    actionLine: `Ты открыл с ${hero}, ${villain} 3-бетит`,
    question: `С чем ${hero} продолжит после 3-бета ${villain}?`,
    narrative: `Ты уже открыл. После 3-бета ${villain} сузь свой диапазон продолжения.`,
    candidateHands: ALL_HANDS,
    truthSel: sel
  });
}

function vs4betContinueStep(hero, villain) {
  const sel = refSel(hero, 'vs_4bet', villain);
  if (!lookupReferenceRange(sel)) return null;

  return attachTruth({
    id: `${hero.toLowerCase()}-continue-vs-4bet-${villain.toLowerCase()}`,
    actionLabel: `${villain} 4-бетит`,
    actionLine: `${villain} 4-бетит против твоего 3-бета`,
    question: `С чем ${hero} продолжит после 4-бета ${villain}?`,
    narrative: `Линия дошла до 4-бета. Какие руки остаются в твоём диапазоне продолжения?`,
    candidateHands: ALL_HANDS,
    truthSel: sel
  });
}

function vsOpenReadStep(hero, villain) {
  const villainSel = refSel(villain, 'rfi');
  if (!lookupReferenceRange(villainSel)) return null;
  const heroSel = refSel(hero, 'vs_open', villain);
  if (!lookupReferenceRange(heroSel)) return null;

  return attachTruth({
    id: `${hero.toLowerCase()}-read-${villain.toLowerCase()}-open`,
    actionLabel: `${villain} открыл`,
    actionLine: `${villain} открывает, ты на ${hero}`,
    question: `Какой диапазон у ${villain} после открытия?`,
    narrative: `Ты на ${hero} и видишь открытие ${villain}. Сузь его стартовый диапазон до реального open-range.`,
    candidateHands: ALL_HANDS,
    truthSel: villainSel
  });
}

function openThenVs3betSteps(opener, threeBettor) {
  const openSel = refSel(opener, 'rfi');
  const contSel = refSel(opener, 'vs_3bet', threeBettor);
  if (!lookupReferenceRange(openSel) || !lookupReferenceRange(contSel)) return null;

  const step1 = attachTruth({
    id: 'open',
    actionLabel: `${opener} открывает`,
    actionLine: `${opener} открывает 2.2bb`,
    question: `Что остаётся в диапазоне открытия ${opener}?`,
    narrative: `Соперник на ${opener} открывает. Сначала зафиксируй его open-range.`,
    candidateHands: ALL_HANDS,
    truthSel: openSel
  });

  const step2 = attachTruth({
    id: 'vs-3bet',
    actionLabel: `${threeBettor} 3-бетит`,
    actionLine: `${threeBettor} 3-бетит против открытия ${opener}`,
    question: `С чем ${opener} продолжит после 3-бета ${threeBettor}?`,
    narrative: `Open-range уже сузился. После 3-бета ${threeBettor} — что остаётся у ${opener}?`,
    candidateHands: [...step1.truth.hands],
    truthSel: contSel,
    dependsOnStep: 0
  });

  return [step1, step2];
}

function openThenVs4betSteps(opener, fourBettor) {
  const openSel = refSel(opener, 'rfi');
  const contSel = refSel(opener, 'vs_4bet', fourBettor);
  if (!lookupReferenceRange(openSel) || !lookupReferenceRange(contSel)) return null;

  const step1 = attachTruth({
    id: 'open',
    actionLabel: `${opener} открывает`,
    actionLine: `${opener} открывает 2.2bb`,
    question: `Что остаётся в диапазоне открытия ${opener}?`,
    narrative: `Соперник на ${opener} открывает — построй его open-range.`,
    candidateHands: ALL_HANDS,
    truthSel: openSel
  });

  const step2 = attachTruth({
    id: 'vs-4bet',
    actionLabel: `${fourBettor} 4-бетит`,
    actionLine: `${fourBettor} 4-бетит, ${opener} решает`,
    question: `С чем ${opener} продолжит после 4-бета ${fourBettor}?`,
    narrative: `После open → 3-bet → 4-bet линия сужается ещё сильнее. Что остаётся у ${opener}?`,
    candidateHands: [...step1.truth.hands],
    truthSel: contSel,
    dependsOnStep: 0
  });

  return [step1, step2];
}

function buildScenario({ id, title, subtitle, steps, heroLabel, villainLabel, potLabel }) {
  const readySteps = steps.filter(Boolean);
  if (!readySteps.length) return null;
  for (const step of readySteps) {
    if (!step.truth?.supported) return null;
  }
  return {
    id,
    title,
    subtitle,
    heroLabel,
    villainLabel,
    potLabel,
    intro: buildIntro({ heroLabel, villainLabel, potLabel }),
    steps: readySteps,
    stepCount: readySteps.length
  };
}

export function buildAllScenarios() {
  const inv = inventoryReference();
  const out = [];
  const seen = new Set();

  for (const pos of inv.rfiPositions) {
    const step = rfiReadStep(pos);
    if (!step) continue;
    const id = `read-open-${pos.toLowerCase()}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(buildScenario({
      id,
      title: `Открытие ${pos}`,
      subtitle: `Прочитай open-range с ${pos}`,
      villainLabel: pos,
      potLabel: '1.5bb + анте',
      steps: [step]
    }));
  }

  for (const [hero, villains] of Object.entries(inv.vsOpenPairs || {})) {
    for (const villain of villains) {
      const readStep = vsOpenReadStep(hero, villain);
      if (readStep) {
        const readId = `read-${villain.toLowerCase()}-open-from-${hero.toLowerCase()}`;
        if (!seen.has(readId)) {
          seen.add(readId);
          out.push(buildScenario({
            id: readId,
            title: `${villain} открывает`,
            subtitle: `Ты на ${hero} — прочитай диапазон оппонента`,
            heroLabel: hero,
            villainLabel: villain,
            potLabel: 'банк ~2.5bb',
            steps: [readStep]
          }));
        }
      }

      const defendStep = vsOpenDefenseStep(hero, villain);
      if (defendStep) {
        const defendId = defendStep.id;
        if (!seen.has(defendId)) {
          seen.add(defendId);
          out.push(buildScenario({
            id: defendId,
            title: `Защита ${hero} vs ${villain}`,
            subtitle: 'Сузь свой диапазон защиты',
            heroLabel: hero,
            villainLabel: villain,
            potLabel: 'банк ~2.5bb',
            steps: [defendStep]
          }));
        }
      }
    }
  }

  for (const hero of inv.vs3betPositions || []) {
    for (const villain of inv.vs3betPairs?.[hero] || []) {
      const step = vs3betContinueStep(hero, villain);
      if (!step) continue;
      const id = step.id;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(buildScenario({
        id,
        title: `${hero} vs 3-bet ${villain}`,
        subtitle: 'Продолжение после 3-бета',
        heroLabel: hero,
        villainLabel: villain,
        potLabel: 'банк после 3-бета',
        steps: [step]
      }));
    }
  }

  for (const hero of inv.vs4betPositions || []) {
    for (const villain of inv.vs4betPairs?.[hero] || []) {
      const step = vs4betContinueStep(hero, villain);
      if (!step) continue;
      const id = step.id;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(buildScenario({
        id,
        title: `${hero} vs 4-bet ${villain}`,
        subtitle: 'Продолжение после 4-бета',
        heroLabel: hero,
        villainLabel: villain,
        potLabel: 'банк после 4-бета',
        steps: [step]
      }));
    }
  }

  for (const opener of inv.vs3betPositions || []) {
    for (const threeBettor of inv.vs3betPairs?.[opener] || []) {
      const steps = openThenVs3betSteps(opener, threeBettor);
      if (!steps) continue;
      const id = `${opener.toLowerCase()}-open-vs-3bet-${threeBettor.toLowerCase()}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(buildScenario({
        id,
        title: `${opener} vs 3-bet ${threeBettor}`,
        subtitle: 'Open-range → продолжение после 3-бета',
        heroLabel: opener,
        villainLabel: threeBettor,
        potLabel: 'банк растёт после 3-бета',
        steps
      }));
    }
  }

  for (const opener of inv.vs4betPositions || []) {
    for (const fourBettor of inv.vs4betPairs?.[opener] || []) {
      const steps = openThenVs4betSteps(opener, fourBettor);
      if (!steps) continue;
      const id = `${opener.toLowerCase()}-open-vs-4bet-${fourBettor.toLowerCase()}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(buildScenario({
        id,
        title: `${opener} vs 4-bet ${fourBettor}`,
        subtitle: 'Open-range → продолжение после 4-бета',
        heroLabel: opener,
        villainLabel: fourBettor,
        potLabel: 'банк после 4-бета',
        steps
      }));
    }
  }

  return out.filter(Boolean);
}

let cached = null;

export function getScenarios() {
  if (!cached) cached = buildAllScenarios();
  return cached;
}

export function getScenarioById(id) {
  return getScenarios().find((s) => s.id === id) || null;
}

export function pickScenario({ storage = null, excludeId = null } = {}) {
  const all = getScenarios();
  if (!all.length) return null;

  let idx = 0;
  try {
    const raw = storage?.getItem('ps_narrowing_idx');
    idx = raw ? (Number(raw) + 1) % all.length : Math.floor(Math.random() * all.length);
    storage?.setItem('ps_narrowing_idx', String(idx));
  } catch (e) {
    idx = Math.floor(Math.random() * all.length);
  }

  let scenario = all[idx];
  if (excludeId && scenario?.id === excludeId && all.length > 1) {
    scenario = all[(idx + 1) % all.length];
  }
  return scenario;
}

export function scenarioCount() {
  return getScenarios().length;
}

export function allScenarioTruthIds() {
  const ids = new Set();
  for (const scenario of getScenarios()) {
    for (const step of scenario.steps) {
      const r = lookupReferenceRange(step.truthSel);
      if (r) ids.add(r.id);
    }
  }
  return ids;
}
