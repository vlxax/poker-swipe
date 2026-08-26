#!/usr/bin/env node
/**
 * Personalized Task Selector Verification
 * Tests weak vs strong player task distribution
 */

// Simulated task pool
const SWIPE_CONCEPTS = [
  'RFI BTN', 'BB defence', 'polar 3-bet', 'flat IP',
  'dry board c-bet', 'dynamic board', 'vs overbet', 'small bet defence',
  'turn value barrel', 'turn showdown', 'thin value', 'river bluffcatch',
  'price defence'
];

const STREETS = ['ПРЕФЛОП', 'ФЛОП', 'ТЁРН', 'РИВЕР'];

// Create synthetic task pool
const createTaskPool = () => {
  const tasks = [];
  for (let c = 0; c < SWIPE_CONCEPTS.length; c++) {
    for (let s = 0; s < STREETS.length; s++) {
      const concept = SWIPE_CONCEPTS[c];
      const street = STREETS[s];
      // Create 4 variants per task (different stack sizes)
      for (let v = 0; v < 4; v++) {
        tasks.push({
          id: `TASK_${c}_${s}_V${v}`,
          concept,
          street,
          variant: v
        });
      }
    }
  }
  return tasks;
};

const expandedTasks = createTaskPool();

console.log(`✓ Created ${expandedTasks.length} task variants from ${SWIPE_CONCEPTS.length} concepts\n`);

// Simulate player profiles
class SimulatedPlayer {
  constructor(skillLevel = 50) {
    this.skill = skillLevel;
    this.events = [];
    this.seenSwipe = [];
    this.selectedTasks = [];
  }

  // Simulate performance based on skill
  gradeTask(task) {
    const baseScore = 50 + (this.skill - 50);
    const randomFactor = Math.random() * 30;
    const score = baseScore + randomFactor - 15;

    if (score > 65) return 'g';
    if (score > 40) return 'y';
    return 'r';
  }

  // Simulate weak topic errors
  setupWeakTopics(concepts = []) {
    this.weakTopics = new Set(concepts);
  }

  // Mimic conceptStats() from app
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

  // Mimic selectSwipeTasks() from app
  selectSwipeTasks() {
    const stats = this.conceptStats();
    const isWeakPlayer = this.skill < 60;
    const recentErrors = this.events.filter(e => e.grade === 'r').slice(-15);
    const recentErrorConcepts = new Set(recentErrors.map(e => e.concept));
    const allConcepts = new Set(stats.map(s => s.concept));

    // Get available pool
    const seen = new Set(this.seenSwipe || []);
    let pool = expandedTasks.filter(x => !seen.has(x.id));
    if (pool.length < 10) {
      this.seenSwipe = [];
      pool = [...expandedTasks];
    }

    // Calculate task weights
    const weighted = pool.map(task => {
      const taskStats = stats.find(s => s.concept === task.concept);
      const taskAttempts = taskStats?.n || 0;
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

    // Sort by weight with stochastic element
    weighted.sort((a, b) => (b.weight * (0.85 + Math.random() * 0.3)) - (a.weight * (0.85 + Math.random() * 0.3)));

    return weighted.slice(0, 10).map(w => w.task);
  }

  // Generate task sequence
  generateTasks(count = 100) {
    this.selectedTasks = [];
    const maxSessions = Math.ceil(count / 10) + 5;

    for (let session = 0; session < maxSessions; session++) {
      if (this.selectedTasks.length >= count) break;

      const tasks = this.selectSwipeTasks();

      for (const task of tasks) {
        if (this.selectedTasks.length >= count) break;

        // Record event
        let grade = this.gradeTask(task);

        // Weak topics get more errors
        if (this.weakTopics && this.weakTopics.has(task.concept)) {
          if (Math.random() < 0.65) grade = 'r';
          if (grade === 'r' && Math.random() < 0.3) grade = 'r'; // Double errors on weak topics
        }

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

// Test profiles
console.log('='.repeat(70));
console.log('PERSONALIZED TASK SELECTOR TEST');
console.log('='.repeat(70));

console.log('\n[1] WEAK PLAYER PROFILE (skill=30)');
console.log('-'.repeat(70));

const weakPlayer = new SimulatedPlayer(30);
weakPlayer.setupWeakTopics(['BB defence', 'river bluffcatch', 'turn showdown']);
const weakTasks = weakPlayer.generateTasks(100);

const weakErrors = weakTasks.filter(t => t.grade === 'r').length;
const weakWeakTopicHits = weakTasks.filter(t => weakPlayer.weakTopics.has(t.concept)).length;

console.log(`  ✓ Generated ${weakTasks.length} tasks`);
console.log(`  Weak-topic focus: ${weakWeakTopicHits}/100 (${(weakWeakTopicHits).toFixed(0)}%)`);
console.log(`  Error rate: ${weakErrors}/100 (${(weakErrors).toFixed(0)}%)`);

console.log('\n[2] STRONG PLAYER PROFILE (skill=85)');
console.log('-'.repeat(70));

const strongPlayer = new SimulatedPlayer(85);
const strongTasks = strongPlayer.generateTasks(100);

const strongErrors = strongTasks.filter(t => t.grade === 'r').length;
const strongWeakTopicHits = strongTasks.filter(t => weakPlayer.weakTopics.has(t.concept)).length;

console.log(`  ✓ Generated ${strongTasks.length} tasks`);
console.log(`  Weak-topic focus: ${strongWeakTopicHits}/100 (${(strongWeakTopicHits).toFixed(0)}%)`);
console.log(`  Error rate: ${strongErrors}/100 (${(strongErrors).toFixed(0)}%)`);

// Analysis
console.log('\n[3] OVERLAP ANALYSIS');
console.log('-'.repeat(70));

const weakIds = new Set(weakTasks.map(t => t.id));
const strongIds = strongTasks.map(t => t.id);
const overlap = strongIds.filter(id => weakIds.has(id)).length;
const overlapPct = (overlap / 100) * 100;

console.log(`  Weak task IDs: ${weakTasks.length}`);
console.log(`  Strong task IDs: ${strongTasks.length}`);
console.log(`  Overlapping IDs: ${overlap}/100 (${overlapPct.toFixed(1)}%)`);

// Concept distribution
console.log('\n[4] CONCEPT DISTRIBUTION');
console.log('-'.repeat(70));

const weakConcepts = {};
const strongConcepts = {};

for (const t of weakTasks) weakConcepts[t.concept] = (weakConcepts[t.concept] || 0) + 1;
for (const t of strongTasks) strongConcepts[t.concept] = (strongConcepts[t.concept] || 0) + 1;

const uniqueWeakConcepts = Object.keys(weakConcepts).length;
const uniqueStrongConcepts = Object.keys(strongConcepts).length;

console.log(`  Weak player unique concepts: ${uniqueWeakConcepts}`);
console.log(`  Strong player unique concepts: ${uniqueStrongConcepts}`);

// Street distribution
console.log('\n[5] STREET DISTRIBUTION');
console.log('-'.repeat(70));

const streets = ['ПРЕФЛОП', 'ФЛОП', 'ТЁРН', 'РИВЕР'];
for (const street of streets) {
  const wCount = weakTasks.filter(t => t.street === street).length;
  const sCount = strongTasks.filter(t => t.street === street).length;
  console.log(`  ${street.padEnd(12)}: WEAK=${wCount.toString().padStart(3)} / STRONG=${sCount.toString().padStart(3)}`);
}

// Duplicate check
console.log('\n[6] DUPLICATE ANALYSIS');
console.log('-'.repeat(70));

let weakDupes = 0, strongDupes = 0;

for (let i = 1; i < weakTasks.length; i++) {
  if (weakTasks[i].id === weakTasks[i - 1].id) weakDupes++;
}

for (let i = 1; i < strongTasks.length; i++) {
  if (strongTasks[i].id === strongTasks[i - 1].id) strongDupes++;
}

console.log(`  Weak player consecutive duplicates: ${weakDupes}`);
console.log(`  Strong player consecutive duplicates: ${strongDupes}`);

// Final verdict
console.log('\n' + '='.repeat(70));
console.log('TEST RESULTS');
console.log('='.repeat(70));

console.log(`\nWEAK TASKS: ${weakTasks.length}`);
console.log(`STRONG TASKS: ${strongTasks.length}`);
console.log(`TASK OVERLAP: ${overlapPct.toFixed(1)}%`);
console.log(`\nWEAK PROFILE:`);
console.log(`  Weak-topic share: ${(weakWeakTopicHits).toFixed(0)}%`);
console.log(`  Advanced share: ${(100 - weakErrors - weakWeakTopicHits).toFixed(0)}%`);
console.log(`\nSTRONG PROFILE:`);
console.log(`  Weak-topic share: ${(strongWeakTopicHits).toFixed(0)}%`);
console.log(`  Advanced share: ${(100 - strongErrors).toFixed(0)}%`);
console.log(`\nIMMEDIATE DUPLICATES: ${weakDupes + strongDupes}`);

// Check if personalization is working
const hasPersonalization = Math.abs(weakWeakTopicHits - strongWeakTopicHits) > 15 && overlapPct < 90;

console.log(`\n${hasPersonalization ? '✅ PERSONALIZATION WORKING' : '⚠️  LIMITED PERSONALIZATION'}`);

process.exit(hasPersonalization ? 0 : 1);
