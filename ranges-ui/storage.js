// Onboarding persistence for the ranges section.

const KEY = 'ps_ranges_onboarding_v1';

export function loadOnboarding(storage) {
  try {
    const raw = storage && storage.getItem(KEY);
    if (!raw) return { completed: false, hintsSeen: [] };
    const data = JSON.parse(raw);
    return {
      completed: !!data.completed,
      hintsSeen: Array.isArray(data.hintsSeen) ? data.hintsSeen : []
    };
  } catch (e) {
    return { completed: false, hintsSeen: [] };
  }
}

export function saveOnboarding(storage, data) {
  if (!storage) return;
  storage.setItem(KEY, JSON.stringify({
    completed: !!data.completed,
    hintsSeen: data.hintsSeen || []
  }));
}

export function markHintSeen(storage, hintId) {
  const cur = loadOnboarding(storage);
  if (!cur.hintsSeen.includes(hintId)) cur.hintsSeen.push(hintId);
  saveOnboarding(storage, cur);
  return cur;
}

export function completeOnboarding(storage) {
  const cur = loadOnboarding(storage);
  cur.completed = true;
  saveOnboarding(storage, cur);
  return cur;
}

export const HINTS = [
  { id: 'position', text: 'Сначала выбери позицию' },
  { id: 'stack', text: 'Теперь выбери стек' },
  { id: 'hand', text: 'Нажми на руку, чтобы увидеть действие' }
];
