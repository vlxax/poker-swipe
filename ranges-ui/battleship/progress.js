// Namespaced Battleship progress — does not touch unrelated PokerSwipe storage.

const STORAGE_KEY = 'pokerSwipe_rangeBattle_v1';
const ONBOARDING_KEY = 'pokerSwipe_rangeBattle_onboarding_v1';

export function createProgressStore(storage = null) {
  const st = storage || (typeof localStorage !== 'undefined' ? localStorage : null);

  function load() {
    if (!st) return null;
    try {
      const raw = st.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function save(data) {
    if (!st) return;
    try { st.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* quota */ }
  }

  function loadOnboarding() {
    if (!st) return false;
    try { return st.getItem(ONBOARDING_KEY) === 'true'; } catch (e) { return false; }
  }

  function saveOnboarding() {
    if (!st) return;
    try { st.setItem(ONBOARDING_KEY, 'true'); } catch (e) { /* ignore */ }
  }

  function ensureCourse(courseId, chartId) {
    const data = load() || { courses: {}, rangeMastery: {} };
    if (!data.courses[courseId]) {
      data.courses[courseId] = { chartId, courseId, missions: [], lastPlayed: null };
    }
    if (!data.rangeMastery[chartId]) {
      data.rangeMastery[chartId] = {
        pocketPairs: 0, suitedAx: 0, offsuitAx: 0, suitedKx: 0,
        broadway: 0, connectors: 0, overall: 0
      };
    }
    return data;
  }

  function saveMissionResult(courseId, chartId, missionId, result, missionIds) {
    if (missionIds && !missionIds.includes(missionId)) return load();
    const data = ensureCourse(courseId, chartId);
    const course = data.courses[courseId];
    const existing = course.missions.find((m) => m.missionId === missionId);
    const row = { missionId, ...result, completed: true, savedAt: Date.now() };
    if (existing) Object.assign(existing, row);
    else course.missions.push(row);
    course.lastPlayed = Date.now();
    data.lastCourseId = courseId;
    data.lastChartId = chartId;

    const mastery = data.rangeMastery[chartId] || {};
    const sector = missionId.replace(/-.*$/, '').replace('connectors', 'connectors');
    const sectorKey = {
      'pocket-pairs': 'pocketPairs',
      'suited-ax': 'suitedAx',
      'offsuit-ax': 'offsuitAx',
      'suited-kx': 'suitedKx',
      broadway: 'broadway',
      'connectors-gappers': 'connectors'
    }[missionId];
    if (sectorKey) mastery[sectorKey] = Math.max(mastery[sectorKey] || 0, result.accuracy || 0);
    const accs = course.missions.filter((m) => m.completed).map((m) => m.accuracy || 0);
    mastery.overall = accs.length ? Math.round(accs.reduce((a, b) => a + b, 0) / accs.length) : 0;
    data.rangeMastery[chartId] = mastery;

    save(data);
    return data;
  }

  function clearCourseProgress(courseId, missionIds) {
    const data = load() || { courses: {} };
    const course = data.courses?.[courseId];
    if (!course) return data;
    course.missions = (course.missions || []).filter((m) => !missionIds.includes(m.missionId));
    save(data);
    return data;
  }

  function getCourseMissions(courseId, missionIds) {
    const data = load();
    if (!data?.courses?.[courseId]) return [];
    return (data.courses[courseId].missions || []).filter((m) => missionIds.includes(m.missionId));
  }

  function getWeakestMission(courseId, missionIds) {
    const stats = getCourseMissions(courseId, missionIds).filter((m) => m.completed);
    if (!stats.length) return null;
    let worst = stats[0];
    for (const m of stats.slice(1)) {
      const a = m.accuracy || 0;
      const w = worst.accuracy || 0;
      if (a < w) worst = m;
      else if (a === w) {
        const me = (m.mistakes || []).length + (m.missedOpens || []).length;
        const we = (worst.mistakes || []).length + (worst.missedOpens || []).length;
        if (me > we) worst = m;
      }
    }
    return worst;
  }

  function resetAllBattleshipProgress() {
    if (!st) return;
    try {
      st.removeItem(STORAGE_KEY);
      st.removeItem(ONBOARDING_KEY);
    } catch (e) { /* ignore */ }
  }

  function getLastCourse() {
    const data = load();
    if (!data?.lastCourseId) return null;
    return { courseId: data.lastCourseId, chartId: data.lastChartId, course: data.courses?.[data.lastCourseId] };
  }

  return {
    STORAGE_KEY,
    ONBOARDING_KEY,
    load,
    save,
    loadOnboarding,
    saveOnboarding,
    saveMissionResult,
    clearCourseProgress,
    getCourseMissions,
    getWeakestMission,
    resetAllBattleshipProgress,
    getLastCourse,
    getRangeMastery(chartId) {
      const data = load();
      return data?.rangeMastery?.[chartId] || null;
    }
  };
}
