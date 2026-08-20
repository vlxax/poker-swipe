// Russian copy helpers for the personalised training home card. Maps internal
// plan/profile data to player-facing poker language — no leak keys or bucket names.

import { skillLabelRu, leakLabelRu } from '../solver/src/index.js';

export const FALLBACK_FOCUS = 'разные игровые ситуации';

const FOCUS_PATTERNS = [
  { re: /icm|баббл|bubble|itm|финальн|pko|баунти/i, label: 'решения на баббле' },
  { re: /bluffcatch|bluff catch|bluff-catch|блеф-кетч|блеф-кэтч|price defence|price defense|overbet fold/i, label: 'блеф-кетчи на ривере' },
  { re: /thin value|тонк/i, label: 'тонкое вэлью' },
  { re: /river|ривер/i, label: 'игра на ривере' },
  { re: /barrel|баррел/i, label: 'баррели' },
  { re: /bb defence|bb defend|защита bb|defend|defence/i, label: 'защита блайндов' },
  { re: /rfi|preflop|префлоп|push-fold|пуш/i, label: 'префлоп' },
  { re: /c-bet|cbet|с-бет|конт-бет|контбет/i, label: 'контбет' },
  { re: /exploit|эксплойт|nit|station|маниак|любитель/i, label: 'адаптация под оппонента' },
  { re: /bluff|блеф/i, label: 'блеф' },
  { re: /sizing|сайзинг|overbet|овербет/i, label: 'сайзинг' },
  { re: /range|диапазон/i, label: 'чтение диапазонов' }
];

function skillPhraseForWhy(label) {
  const t = String(label || '').trim();
  if (/icm|баббл/i.test(t)) return 'решения на баббле';
  if (/блеф|кэтч|кетч/i.test(t)) return 'блеф-кетчи на ривере';
  if (/ривер/i.test(t)) return 'игра на ривере';
  if (/префлоп/i.test(t)) return 'префлоп';
  if (/постфлоп/i.test(t)) return 'постфлоп';
  if (/сайзинг/i.test(t)) return 'сайзинг';
  if (/эксплойт/i.test(t)) return 'адаптация под оппонента';
  if (/контбет|конт-бет/i.test(t)) return 'контбет';
  return t.toLowerCase();
}

export function humanFocusLabel(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  for (const { re, label } of FOCUS_PATTERNS) {
    if (re.test(text)) return label;
  }
  if (text.length > 28) return text.slice(0, 28).trim() + '…';
  return text.charAt(0).toLowerCase() + text.slice(1);
}

export function focusItemsFromPlan(plan, limit = 2) {
  const session = (plan && plan.sessionPlan) || {};
  const raw = [
    ...(session.primaryTargets || []),
    ...(session.exploration || []).slice(0, 1)
  ];
  const out = [];
  for (const item of raw) {
    const label = humanFocusLabel(item);
    if (label && !out.includes(label)) out.push(label);
    if (out.length >= limit) break;
  }
  return out;
}

export function weakestSkillLabels(skillProfile, limit = 2) {
  if (!skillProfile || !skillProfile.skills) return [];
  const ranked = Object.values(skillProfile.skills)
    .filter((s) => s && s.score != null)
    .sort((a, b) => a.score - b.score);
  return ranked.slice(0, limit).map((s) => s.labelRu || skillLabelRu(s.skill));
}

export function focusItemsFromProfile({ skillProfile, leaks = [], plan = null, limit = 2 } = {}) {
  const fromPlan = focusItemsFromPlan(plan, limit);
  if (fromPlan.length >= limit) return fromPlan;

  const fromSkills = weakestSkillLabels(skillProfile, limit)
    .map((s) => humanFocusLabel(s) || s);
  for (const s of fromSkills) {
    if (!fromPlan.includes(s)) fromPlan.push(s);
    if (fromPlan.length >= limit) return fromPlan.slice(0, limit);
  }

  for (const leak of (leaks || []).slice(0, limit)) {
    const label = leak.label || leakLabelRu(leak.concept);
    const short = humanFocusLabel(label) || label;
    if (short && !fromPlan.includes(short)) fromPlan.push(short);
    if (fromPlan.length >= limit) break;
  }

  if (!fromPlan.length) return [FALLBACK_FOCUS];
  return fromPlan.slice(0, limit);
}

export function whyTextForTraining({ skillProfile, leaks = [], focusItems = [] } = {}) {
  const hasLeaks = (leaks || []).length > 0;
  if (hasLeaks) {
    return 'Именно здесь ты сейчас чаще всего теряешь фишки.';
  }

  const weak = weakestSkillLabels(skillProfile, 2);
  if (weak.length >= 2) {
    const a = skillPhraseForWhy(weak[0]);
    const b = skillPhraseForWhy(weak[1]);
    return `Главные потери сейчас — ${a} и ${b}.`;
  }
  if (weak.length === 1) {
    return `Главные потери сейчас — ${skillPhraseForWhy(weak[0])}.`;
  }

  const meaningfulFocus = (focusItems || []).filter((f) => f && f !== FALLBACK_FOCUS);
  if (meaningfulFocus.length >= 1) {
    return 'Именно здесь ты сейчас чаще всего теряешь фишки.';
  }

  return 'Здесь следующий запас роста для твоего уровня.';
}

export function estimateMinutes(spotCount) {
  const n = Number(spotCount) || 7;
  return Math.max(3, Math.round(n * 0.75));
}

export function trainingSubtitle(total) {
  const n = total || 7;
  return `${n} раздач · около ${estimateMinutes(n)} минут`;
}
