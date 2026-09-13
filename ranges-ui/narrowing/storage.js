// Trainer narrowing progress — namespaced, separate from Battleship.

const KEY = 'pokerSwipe_narrowing_trainer_v1';
const ONBOARD_KEY = 'pokerSwipe_narrowing_onboard_v1';

export function createNarrowingStore(storage = null) {
  const st = storage || (typeof localStorage !== 'undefined' ? localStorage : null);

  function load() {
    if (!st) return { lessons: {}, lastLessonId: null };
    try {
      const raw = st.getItem(KEY);
      return raw ? JSON.parse(raw) : { lessons: {}, lastLessonId: null };
    } catch (e) {
      return { lessons: {}, lastLessonId: null };
    }
  }

  function save(data) {
    if (!st) return;
    try { st.setItem(KEY, JSON.stringify(data)); } catch (e) { /* quota */ }
  }

  function loadOnboardingDone() {
    if (!st) return false;
    try { return st.getItem(ONBOARD_KEY) === 'true'; } catch (e) { return false; }
  }

  function saveOnboardingDone() {
    if (!st) return;
    try { st.setItem(ONBOARD_KEY, 'true'); } catch (e) { /* ignore */ }
  }

  function saveLessonComplete(lessonId, accuracy) {
    const data = load();
    data.lessons[lessonId] = { completed: true, accuracy, at: Date.now() };
    data.lastLessonId = lessonId;
    save(data);
    return data;
  }

  function getLastLesson() {
    const data = load();
    return data.lastLessonId || null;
  }

  return {
    KEY,
    load,
    save,
    loadOnboardingDone,
    saveOnboardingDone,
    saveLessonComplete,
    getLastLesson
  };
}
