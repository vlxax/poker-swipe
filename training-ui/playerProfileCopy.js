// Russian poker-language labels for dynamic player profile output.
// Maps internal diagnosis/mastery/trend enums to player-facing copy.

import { SKILL_DIAGNOSES } from '../solver/src/training/dynamicPlayerProfile.js';

export function masteryStateRu(state) {
  const map = {
    NEW: 'новый',
    LEARNING: 'изучается',
    PRACTICING: 'в работе',
    MASTERED: 'освоен',
    REVIEW_DUE: 'нужно повторить'
  };
  return map[state] || String(state || '—');
}

export function trendRu(trend) {
  if (trend === 'improving') return 'растёт';
  if (trend === 'declining') return 'падает';
  return 'стабильно';
}

export function trendArrow(trend) {
  if (trend === 'improving') return '↑';
  if (trend === 'declining') return '↓';
  return '→';
}

export function diagnosisRu(diagnosis) {
  const map = {
    [SKILL_DIAGNOSES.TRUE_WEAKNESS]: 'слабое место',
    [SKILL_DIAGNOSES.TEMPORARY_MISTAKE]: 'просадка',
    [SKILL_DIAGNOSES.MASTERED]: 'освоено',
    [SKILL_DIAGNOSES.DECAYING]: 'забывается',
    [SKILL_DIAGNOSES.IMPROVING]: 'прогресс',
    [SKILL_DIAGNOSES.STABLE]: 'стабильно',
    [SKILL_DIAGNOSES.LEARNING]: 'в изучении'
  };
  return map[diagnosis] || String(diagnosis || '—');
}

function skillPhrase(label) {
  const t = String(label || '').trim().toLowerCase();
  if (!t) return 'этот навык';
  return t;
}

const FOCUS_DIAGNOSES = new Set([
  SKILL_DIAGNOSES.TRUE_WEAKNESS,
  SKILL_DIAGNOSES.DECAYING,
  SKILL_DIAGNOSES.TEMPORARY_MISTAKE,
  SKILL_DIAGNOSES.LEARNING
]);

export function focusTracksFromProfile(skillProfile, limit = 3) {
  const tracks = skillProfile?.tracks || skillProfile?.dynamic?.tracks;
  if (!tracks) return [];
  return Object.values(tracks)
    .filter((t) => t && t.score != null && FOCUS_DIAGNOSES.has(t.diagnosis))
    .sort((a, b) => (a.score ?? 999) - (b.score ?? 999))
    .slice(0, limit);
}

export function whyTextFromDynamicProfile(skillProfile) {
  const tracks = skillProfile?.tracks || skillProfile?.dynamic?.tracks;
  if (!tracks || !Object.keys(tracks).length) return null;

  const focus = focusTracksFromProfile(skillProfile, 2);
  if (focus.length >= 2) {
    const a = focus[0];
    const b = focus[1];
    const aNote = a.diagnosis === SKILL_DIAGNOSES.DECAYING ? ' — давно не тренировал' : '';
    const bNote = b.diagnosis === SKILL_DIAGNOSES.TEMPORARY_MISTAKE ? ' — недавняя просадка' : '';
    return `Раздачи подобраны под слабые зоны: ${skillPhrase(a.labelRu)}${aNote} и ${skillPhrase(b.labelRu)}${bNote}.`;
  }
  if (focus.length === 1) {
    const t = focus[0];
    if (t.diagnosis === SKILL_DIAGNOSES.DECAYING) {
      return `Сегодня повторим ${skillPhrase(t.labelRu)} — навык просел без практики.`;
    }
    if (t.diagnosis === SKILL_DIAGNOSES.TEMPORARY_MISTAKE) {
      return `Недавние ошибки в ${skillPhrase(t.labelRu)} — отработаем типовые линии.`;
    }
    if (t.diagnosis === SKILL_DIAGNOSES.LEARNING) {
      return `Набираем базу в ${skillPhrase(t.labelRu)} — больше раздач на этот навык.`;
    }
    return `Главная зона роста — ${skillPhrase(t.labelRu)}: там чаще всего теряешь EV.`;
  }

  const weakest = skillProfile.weakest || skillProfile.dynamic?.weakest;
  if (weakest?.labelRu) {
    return `Следующий шаг — ${skillPhrase(weakest.labelRu)}: именно там сейчас больше всего запаса роста.`;
  }
  return null;
}

export function trackRowVm(track) {
  if (!track) return null;
  const mf = track.mistakeFrequency;
  return {
    skill: track.skill,
    label: track.labelRu,
    score: track.score,
    masteryState: masteryStateRu(track.masteryState),
    trend: trendRu(track.trend),
    trendArrow: trendArrow(track.trend),
    mistakeFrequency: mf != null ? `${Math.round(mf * 100)}%` : '—',
    diagnosis: diagnosisRu(track.diagnosis),
    diagnosisKey: track.diagnosis
  };
}

export function skillSummaryVm(track) {
  if (!track) return null;
  return {
    skill: track.skill,
    label: track.labelRu,
    score: track.score,
    diagnosis: diagnosisRu(track.diagnosis)
  };
}
