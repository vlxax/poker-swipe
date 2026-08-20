// Russian copy helpers for the personalised training home card. Maps internal
// plan/profile data to player-facing poker language — no leak keys or bucket names.

import { skillLabelRu, leakLabelRu } from '../solver/src/index.js';

const FOCUS_PATTERNS = [
  { re: /icm|баббл|bubble|itm|финальн|pko|баунти/i, label: 'ICM' },
  { re: /bluffcatch|bluff catch|bluff-catch|блеф-кетч|price defence|price defense|overbet fold/i, label: 'защита ривера' },
  { re: /thin value|тонк/i, label: 'тонкое вэлью' },
  { re: /river|ривер/i, label: 'ривер' },
  { re: /barrel|баррел/i, label: 'баррелинг' },
  { re: /bb defence|bb defend|защита bb|defend|defence/i, label: 'защита блайндов' },
  { re: /rfi|preflop|префлоп|push-fold|пуш/i, label: 'префлоп' },
  { re: /c-bet|cbet|с-бет/i, label: 'конт-бет' },
  { re: /exploit|эксплойт|nit|station|маниак|любитель/i, label: 'эксплойт' },
  { re: /bluff|блеф/i, label: 'блеф' },
  { re: /sizing|сайзинг|overbet|овербет/i, label: 'сайзинг' },
  { re: /range|диапазон/i, label: 'чтение диапазонов' }
];

export function humanFocusLabel(raw) {
  const text = String(raw || '').trim();
  if (!text) return null;
  for (const { re, label } of FOCUS_PATTERNS) {
    if (re.test(text)) return label;
  }
  if (text.length > 28) return text.slice(0, 28).trim() + '…';
  return text.charAt(0).toUpperCase() + text.slice(1);
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

  const fromSkills = weakestSkillLabels(skillProfile, limit);
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

  if (!fromPlan.length) return ['развитие и новые линии'];
  return fromPlan.slice(0, limit);
}

export function whyTextForTraining({ skillProfile, leaks = [], focusItems = [] } = {}) {
  const leakLabels = (leaks || [])
    .slice(0, 3)
    .map((l) => (l.label || leakLabelRu(l.concept) || '').toLowerCase())
    .filter(Boolean);

  if (leakLabels.length >= 2) {
    return `Ты чаще ошибаешься в решениях на ${leakLabels[0]} и в ${leakLabels[1]}.`;
  }
  if (leakLabels.length === 1) {
    const one = leakLabels[0];
    if (/icm|баббл/.test(one)) return 'Ты чаще ошибаешься в решениях на баббле и в ICM-спотах.';
    if (/блеф|bluff|кетч|catch/.test(one)) return 'Ты чаще ошибаешься в блеф-кетчах и защите на ривере.';
    return `Ты чаще ошибаешься в ${one}.`;
  }

  const weak = weakestSkillLabels(skillProfile, 2);
  if (weak.length >= 2) {
    const a = weak[0];
    const b = weak[1];
    if (/ICM|баббл/i.test(a) && /ривер|блеф|кэтч/i.test(b)) {
      return 'Ты чаще ошибаешься в решениях на баббле и в блеф-кетчах.';
    }
    return `Сейчас больше всего теряешь EV в ${a} и в ${b}.`;
  }
  if (weak.length === 1) {
    return `Сейчас больше всего теряешь EV в ${weak[0]}.`;
  }

  if (focusItems.length >= 2) {
    return `Сегодня собрали споты под ${focusItems[0].toLowerCase()} и ${focusItems[1].toLowerCase()}.`;
  }
  if (focusItems.length === 1 && focusItems[0] !== 'развитие и новые линии') {
    return `Сегодня собрали споты под ${focusItems[0].toLowerCase()}.`;
  }
  return 'Сегодня — развитие новых линий и поддержание сильных навыков.';
}

export function estimateMinutes(spotCount) {
  const n = Number(spotCount) || 7;
  return Math.max(3, Math.round(n * 0.75));
}

export function trainingSubtitle(total) {
  const n = total || 7;
  return `${n} спотов · ~${estimateMinutes(n)} минут`;
}
