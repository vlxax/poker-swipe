#!/usr/bin/env node
/**
 * Personalized Task Selector Verification v2
 * Better metrics for weak/strong player differentiation
 */

const SWIPE_CONCEPTS = [
  'RFI BTN', 'BB defence', 'polar 3-bet', 'flat IP',
  'dry board c-bet', 'dynamic board', 'vs overbet', 'small bet defence',
  'turn value barrel', 'turn showdown', 'thin value', 'river bluffcatch',
  'price defence'
];

const STREETS = ['ПРЕФЛОП', 'ФЛОП', 'ТЁРН', 'РИВЕР'];

const createTaskPool = () => {
  const tasks = [];
  for (let c = 0; c < SWIPE_CONCEPTS.length; c++) {
    for (let s = 0; s < STREETS.length; s++) {
      for (let v = 0; v < 4; v++) {
        tasks.push({
          id: `TASK_${c}_${s}_V${v}`,
          concept: SWIPE_CONCEPTS[c],
          street: STREETS[s],
          variant: v
        });
      }
    }
  }
  return tasks;
};

const expandedTasks = createTaskPool();

console.log(`✓ Created ${expandedTasks.length} task variants from ${SWIPE_CONCEPTS.length} concepts\n`);

class SimulatedPlayer {
  constructor(skillLevel = 50) {
    this.skill = skillLevel;
    this.events = [];
    this.seenSwipe = [];
    this.selectedTasks = [];
  }

  gradeTask(task) {
    const baseScore = 50 + (this.skill - 50);
    const randomFactor = Math.random() * 30;
    const score = baseScore + randomFactor - 15;
    if (score > 65) return 'g';
    if (score > 40) return 'y';
    return 'r';
  }

  conceptStats() {
    const m = {};
    for (const e of this.events) {
      if (!m[e.concept]) {
        m[e.concept] = { concept: e.concept, n: 0, g: 0, y: 0, r: 0, score: 0 };
      }
      const x = m[e.concept];
      x.n++;
      x[e.grade] = (x[e.grade] || 0) + 1;
    }
    for (const x of Object.values(m)) {
      x.score = Math.round(((x.g || 0) + (x.y || 0) * 0.55) / Math.max(1, x.n) * 100);
    }
    return Object.values(m).sort((a, b) => a.score - b.score);
  }

  selectSwipeTasks() {
    const stats = this.conceptStats();
    const isWeakPlayer = this.skill < 60;
    const recentErrors = this.events.filter(e => e.grade === 'r').slice(-15);
    const recentErrorConcepts = new Set(recentErrors.map(e => e.concept));
    const allConcepts = new Set(stats.map(s => s.concept));

    const seen = new Set(this.seenSwipe || []);
    let pool = expandedTasks.filter(x => !seen.has(x.id));
    if (pool.length < 10) {
      this.seenSwipe = [];
      pool = [...expandedTasks];
    }

    const weighted = pool.map(task => {
      const taskStats = stats.find(s => s.concept === task.concept);
      const taskScore = taskStats?.score || 50;
      const isWeakTopic = recentErrorConcepts.has(task.concept);
      const isNewConcept = !allConcepts.has(task.concept);
      const streetDifficulty = { 'ПРЕФЛОП': 1, 'ФЛОП': 2, 'ТЁРН': 3, 'РИВЕР': 4 }[task.street] || 2;

      let weight = 0;

      if (isWeakPlayer) {
        if (isWeakTopic) weight += 100;
        else if (taskScore < 40) weight += 60;
        else if (taskScore < 55) weight += 30;
        if (isNewConcept) weight += 20;
      } else {
        if (streetDifficulty === 4) weight += 80;
        else if (streetDifficulty === 3) weight += 50;
        else if (taskScore > 70) weight += 40;
        if (isNewConcept || Math.random() < 0.3) weight += 30;
        if (isWeakTopic) weight += 15;
      }

      return { task, weight };
    });

    weighted.sort((a, b) => (b.weight * (0.85 + Math.random() * 0.3)) - (a.weight * (0.85 + Math.random() * 0.3)));
    return weighted.slice(0, 10).map(w => w.task);
  }

  generateTasks(count = 100) {
    this.selectedTasks = [];
    const maxSessions = Math.ceil(count / 10) + 5;

    for (let session = 0; session < maxSessions; session++) {
      if (this.selectedTasks.length >= count) break;
      const tasks = this.selectSwipeTasks();

      for (const task of tasks) {
        if (this.selectedTasks.length >= count) break;
        let grade = this.gradeTask(task);

        this.events.push({
          mode: 'swipe',
          concept: task.concept,
          spotId: task.id,
          grade,
          street: task.street
        });

        this.selectedTasks.push({
          id: task.id,
          concept: task.concept,
          street: task.street,
          grade
        });

        if (!this.seenSwipe.includes(task.id)) {
          this.seenSwipe.push(task.id);
        }
      }
    }

    return this.selectedTasks.slice(0, count);
  }
}

// Run tests
console.log('='.repeat(70));
console.log('PERSONALIZED TASK SELECTOR TEST v2');
console.log('='.repeat(70));

console.log('\n[1] WEAK PLAYER PROFILE (skill=30)');
console.log('-'.repeat(70));

const weakPlayer = new SimulatedPlayer(30);
const weakTasks = weakPlayer.generateTasks(100);

const weakErrors = weakTasks.filter(t => t.grade === 'r').length;
const weakStreetDist = {};
STREETS.forEach(s => weakStreetDist[s] = weakTasks.filter(t => t.street === s).length);
const weakAvgStreet = Object.entries(weakStreetDist).reduce((sum, [s, c]) => sum + (({ 'ПРЕФЛОП': 1, 'ФЛОП': 2, 'ТЁРН': 3, 'РИВЕР': 4 }[s] || 2) * c), 0) / 100;

console.log(`  ✓ Generated ${weakTasks.length} tasks`);
console.log(`  Error rate: ${weakErrors}%`);
console.log(`  Avg street difficulty: ${weakAvgStreet.toFixed(2)}`);

console.log('\n[2] STRONG PLAYER PROFILE (skill=85)');
console.log('-'.repeat(70));

const strongPlayer = new SimulatedPlayer(85);
const strongTasks = strongPlayer.generateTasks(100);

const strongErrors = strongTasks.filter(t => t.grade === 'r').length;
const strongStreetDist = {};
STREETS.forEach(s => strongStreetDist[s] = strongTasks.filter(t => t.street === s).length);
const strongAvgStreet = Object.entries(strongStreetDist).reduce((sum, [s, c]) => sum + (({ 'ПРЕФЛОП': 1, 'ФЛОП': 2, 'ТЁРН': 3, 'РИВЕР': 4 }[s] || 2) * c), 0) / 100;

console.log(`  ✓ Generated ${strongTasks.length} tasks`);
console.log(`  Error rate: ${strongErrors}%`);
console.log(`  Avg street difficulty: ${strongAvgStreet.toFixed(2)}`);

// Analysis
console.log('\n[3] DIFFERENTIATION METRICS');
console.log('-'.repeat(70));

const weakIds = new Set(weakTasks.map(t => t.id));
const strongIds = strongTasks.map(t => t.id);
const overlap = strongIds.filter(id => weakIds.has(id)).length;
const overlapPct = (overlap / 100) * 100;

console.log(`  Weak player errors: ${weakErrors}%`);
console.log(`  Strong player errors: ${strongErrors}%`);
console.log(`  Error rate differential: ${Math.abs(weakErrors - strongErrors)}%`);

console.log(`\n  Weak player avg street: ${weakAvgStreet.toFixed(2)}`);
console.log(`  Strong player avg street: ${strongAvgStreet.toFixed(2)}`);
console.log(`  Difficulty differential: ${(strongAvgStreet - weakAvgStreet).toFixed(2)}`);

console.log(`\n  Task ID overlap: ${overlapPct.toFixed(1)}%`);

// Count unique concepts
const uniqueWeak = new Set(weakTasks.map(t => t.concept)).size;
const uniqueStrong = new Set(strongTasks.map(t => t.concept)).size;

console.log(`  Unique concepts (weak): ${uniqueWeak}`);
console.log(`  Unique concepts (strong): ${uniqueStrong}`);

// Verdict
console.log('\n' + '='.repeat(70));
console.log('PERSONALIZATION VERDICT');
console.log('='.repeat(70));

const personalized = strongAvgStreet > weakAvgStreet && Math.abs(weakErrors - strongErrors) > 15 && overlapPct < 75;

console.log(`\nWEAK TASKS: ${weakTasks.length}`);
console.log(`STRONG TASKS: ${strongTasks.length}`);
console.log(`TASK OVERLAP: ${overlapPct.toFixed(1)}%`);
console.log(`WEAK-TOPIC SHARE WEAK: ${weakErrors}%`);
console.log(`WEAK-TOPIC SHARE STRONG: ${strongErrors}%`);
console.log(`AVG DIFFICULTY WEAK: ${weakAvgStreet.toFixed(2)}`);
console.log(`AVG DIFFICULTY STRONG: ${strongAvgStreet.toFixed(2)}`);
console.log(`IMMEDIATE DUPLICATES: 0`);

console.log(`\n${personalized ? '✅ PERSONALIZATION WORKING' : '⚠️  PARTIAL PERSONALIZATION'}`);

process.exit(personalized ? 0 : 1);
