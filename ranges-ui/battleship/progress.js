import { migratePersistedRangeIds } from '../../trainer-knowledge/rangeIdAlias.js';

const STORAGE_KEY = 'pokerSwipe_rangeBattle_v1';
const TUTORIAL_KEY = 'pokerSwipe_rangeBattle_tutorial_v1';

const SECTOR_LABELS = {
  pocketPairs: 'Карманки',
  suitedAx: 'Suited Ax',
  offsuitAx: 'Offsuit Ax',
  suitedKx: 'Suited Kx',
  offsuitKx: 'Offsuit Kx',
  broadway: 'Broadway',
  suitedConnectors: 'Коннекторы',
  suitedGappers: 'Гапперы',
  other: 'Другое'
};

export function createProgressStore(storage = null) {
  const st = storage || (typeof localStorage !== 'undefined' ? localStorage : null);

  function load() {
    if (!st) return null;
    try {
      const raw = st.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      const { data, changed } = migratePersistedRangeIds(parsed);
      if (changed > 0) save(data);
      return data;
    } catch (e) {
      return null;
    }
  }

  function save(data) {
    if (!st) return;
    try { st.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* quota */ }
  }

  function loadTutorialCompleted() {
    if (!st) return false;
    try { return st.getItem(TUTORIAL_KEY) === 'true'; } catch (e) { return false; }
  }

  function saveTutorialCompleted() {
    if (!st) return;
    try { st.setItem(TUTORIAL_KEY, 'true'); } catch (e) { /* ignore */ }
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
    const sectorKey = {
      'pocket-pairs': 'pocketPairs',
      'suited-ax': 'suitedAx',
      'offsuit-ax': 'offsuitAx',
      'suited-kx': 'suitedKx',
      broadway: 'broadway',
      'connectors-gappers': 'connectors',
      'range-edge': 'offsuitAx',
      hunt: 'broadway',
      'final-battle': 'overall'
    }[missionId];
    if (sectorKey && sectorKey !== 'overall') {
      mastery[sectorKey] = Math.max(mastery[sectorKey] || 0, result.accuracy || 0);
    }
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
        const me = (m.mistakes || []).length;
        const we = (worst.mistakes || []).length;
        if (me > we) worst = m;
      }
    }
    return worst;
  }

  function resetAllBattleshipProgress() {
    if (!st) return;
    try {
      st.removeItem(STORAGE_KEY);
      st.removeItem(TUTORIAL_KEY);
    } catch (e) { /* ignore */ }
  }

  function getLastCourse() {
    const data = load();
    if (!data?.lastCourseId) return null;
    return { courseId: data.lastCourseId, chartId: data.lastChartId, course: data.courses?.[data.lastCourseId] };
  }

  function saveLastCourse(courseId, chartId) {
    const data = load() || { courses: {}, rangeMastery: {} };
    data.lastCourseId = courseId;
    data.lastChartId = chartId;
    save(data);
  }

  function getCourseProgressList(catalog) {
    const data = load();
    if (!data?.courses || !catalog?.length) return [];
    const rows = [];
    for (const c of catalog) {
      const course = data.courses[c.courseId];
      if (!course?.missions?.length) continue;
      const accs = course.missions.filter((m) => m.completed).map((m) => m.accuracy || 0);
      if (!accs.length) continue;
      const pct = Math.round(accs.reduce((a, b) => a + b, 0) / accs.length);
      const pos = c.position || '';
      const stack = (c.stack || '').replace('-', '–');
      rows.push({ courseId: c.courseId, label: `${pos} ${stack} ББ`, pct });
    }
    rows.sort((a, b) => b.pct - a.pct);
    return rows.slice(0, 4);
  }

  function sectorLabel(key) {
    return SECTOR_LABELS[key] || key;
  }

  return {
    STORAGE_KEY,
    TUTORIAL_KEY,
    load,
    save,
    loadTutorialCompleted,
    saveTutorialCompleted,
    saveMissionResult,
    clearCourseProgress,
    getCourseMissions,
    getWeakestMission,
    resetAllBattleshipProgress,
    getLastCourse,
    saveLastCourse,
    getCourseProgressList,
    sectorLabel,
    getRangeMastery(chartId) {
      const data = load();
      return data?.rangeMastery?.[chartId] || null;
    }
  };
}
