// Onboarding and progress for range narrowing trainer.

const KEY = 'ps_narrowing_progress_v1';

export function loadProgress(storage) {
  try {
    const raw = storage && storage.getItem(KEY);
    if (!raw) return { completed: false, hintsSeen: [], runs: 0 };
    const data = JSON.parse(raw);
    return {
      completed: !!data.completed,
      hintsSeen: Array.isArray(data.hintsSeen) ? data.hintsSeen : [],
      runs: Number(data.runs) || 0,
      lastScenarioId: data.lastScenarioId || null,
      lastAccuracy: data.lastAccuracy ?? null
    };
  } catch (e) {
    return { completed: false, hintsSeen: [], runs: 0 };
  }
}

export function saveProgress(storage, data) {
  const next = {
    completed: !!data.completed,
    hintsSeen: data.hintsSeen || [],
    runs: Number(data.runs) || 0,
    lastScenarioId: data.lastScenarioId || null,
    lastAccuracy: data.lastAccuracy ?? null
  };
  if (storage) storage.setItem(KEY, JSON.stringify(next));
  return next;
}

export function markHintSeen(storage, hintId) {
  const cur = loadProgress(storage);
  if (!cur.hintsSeen.includes(hintId)) cur.hintsSeen.push(hintId);
  return saveProgress(storage, cur);
}

export function completeOnboarding(storage) {
  const cur = loadProgress(storage);
  cur.completed = true;
  return saveProgress(storage, cur);
}

export const HINTS = [
  { id: 'start', text: 'Прочитай ситуацию и нажми «Начать задачу».' },
  { id: 'toggle', text: 'Убирай из диапазона руки, которые не подходят под действие соперника.' },
  { id: 'step', text: 'Диапазон сузился — следующее действие фильтрует его ещё раз.' }
];

// Legacy aliases for older tests.
export const loadOnboarding = loadProgress;
export const saveOnboarding = saveProgress;
