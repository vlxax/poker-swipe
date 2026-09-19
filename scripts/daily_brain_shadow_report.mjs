#!/usr/bin/env node
/**
 * Diagnostic Daily shadow batch — does not change grading.
 */
import { writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { TASKS } from '../task-context/library.js';
import { buildCanonicalSpot } from '../task-context/canonicalSpot.js';
import { analyze } from '../poker-brain/analyze.js';
import { adapters } from '../poker-brain/context/normalize.js';
import { classifyDailyShadow } from '../poker-brain/integrations/dailyShadow.js';
import { loadPokerBrainPackFromStrategyFile } from '../trainer-knowledge/conflictDetector.js';
import { choiceToActionType } from '../solver/src/training/libraryDrill.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const OUT = '/opt/cursor/artifacts/daily_brain_shadow_report.json';

const pack = loadPokerBrainPackFromStrategyFile();
const classOfStub = (cards) => {
  if (!Array.isArray(cards) || cards.length < 2) return null;
  const r = (c) => c[0];
  const s = (c) => c[1];
  const ranks = [r(cards[0]), r(cards[1])].sort((a, b) => '23456789TJQKA'.indexOf(a) - '23456789TJQKA'.indexOf(b));
  if (ranks[0] === ranks[1]) return `${ranks[0]}${ranks[1]}`;
  const suited = s(cards[0]) === s(cards[1]);
  return `${ranks[1]}${ranks[0]}${suited ? 's' : 'o'}`;
};

const summary = {
  TOTAL_TASKS: 0,
  BRAIN_ANALYZABLE: 0,
  NOT_COMPARABLE: 0,
  NO_EVIDENCE: 0,
  EXACT_MATCH: 0,
  ACTION_MATCH: 0,
  CONFLICT: 0,
  ACCEPTABLE_ACTION_OVERLAP: 0,
  ACTION_MATCH_FREQUENCY_DIFFERENCE: 0,
  byCategory: {
    preflop: { total: 0, EXACT_MATCH: 0, CONFLICT: 0, NOT_COMPARABLE: 0, NO_EVIDENCE: 0 },
    postflop: { total: 0, EXACT_MATCH: 0, CONFLICT: 0, NOT_COMPARABLE: 0, NO_EVIDENCE: 0 },
    sizing: { total: 0, EXACT_MATCH: 0, CONFLICT: 0, NOT_COMPARABLE: 0, NO_EVIDENCE: 0 },
    ICM: { total: 0, EXACT_MATCH: 0, CONFLICT: 0, NOT_COMPARABLE: 0, NO_EVIDENCE: 0 },
    PKO: { total: 0, EXACT_MATCH: 0, CONFLICT: 0, NOT_COMPARABLE: 0, NO_EVIDENCE: 0 },
    other: { total: 0, EXACT_MATCH: 0, CONFLICT: 0, NOT_COMPARABLE: 0, NO_EVIDENCE: 0 }
  },
  conflicts: []
};

function categoryFor(task, canonical) {
  const tags = (task.tags || []).join(' ').toLowerCase();
  const street = String(canonical.street || '').toUpperCase();
  if (/pko|нокаут|bounty/.test(tags)) return 'PKO';
  if (/баббл|icm|itm|финал/.test(tags + task.stage)) return 'ICM';
  if (/сайз|sizing|размер/.test(tags + task.concept)) return 'sizing';
  if (street.includes('ПРЕФЛОП') || street === 'PREFLOP') return 'preflop';
  if (street.includes('ФЛОП') || street.includes('ТЁРН') || street.includes('РИВЕР')) return 'postflop';
  return 'other';
}

for (const task of TASKS) {
  summary.TOTAL_TASKS += 1;
  const canonical = buildCanonicalSpot({ ...task, _library: true });
  const ctx = adapters.daily({ drill: task, spot: { ...task, _canonical: canonical } });
  const brain = analyze({ context: ctx }, { pack, classOf: classOfStub });
  if (brain.provenance?.primarySource) summary.BRAIN_ANALYZABLE += 1;

  const libraryVerdict = {
    expectedAction: task.correct,
    action: task.correct,
    alsoOk: task.alsoOk
  };
  const { classification, reason } = classifyDailyShadow({
    libraryVerdict,
    brainDecision: brain,
    drill: task
  });

  summary[classification] = (summary[classification] || 0) + 1;
  if (classification === 'EXACT_MATCH' || classification === 'ACTION_MATCH_FREQUENCY_DIFFERENCE') {
    summary.ACTION_MATCH += 1;
  }
  if (classification === 'NOT_COMPARABLE') summary.NOT_COMPARABLE += 1;
  if (classification === 'NO_BRAIN_EVIDENCE') summary.NO_EVIDENCE += 1;
  if (classification === 'CONFLICT' || classification === 'POLICY_CONFLICT') summary.CONFLICT += 1;

  const cat = categoryFor(task, canonical);
  summary.byCategory[cat].total += 1;
  const bucket = classification === 'NO_BRAIN_EVIDENCE' ? 'NO_EVIDENCE' : classification;
  if (summary.byCategory[cat][bucket] != null) summary.byCategory[cat][bucket] += 1;
  else summary.byCategory[cat].other = (summary.byCategory[cat].other || 0) + 1;

  if (classification === 'CONFLICT') {
    summary.conflicts.push({
      taskId: task.id,
      DecisionContext: {
        street: ctx.street,
        hero: ctx.hero,
        effectiveStackBB: ctx.effectiveStackBB,
        preflopTree: ctx.preflopTree
      },
      libraryPolicy: { correct: task.correct, alsoOk: task.alsoOk, actionType: choiceToActionType(task.correct) },
      brainPolicy: brain.recommendation,
      brainSource: brain.provenance?.primarySource,
      contextMatch: brain.contextCompatibility,
      reason
    });
  }
}

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(summary, null, 2));
console.log('Wrote', OUT);
console.log(JSON.stringify({
  TOTAL: summary.TOTAL_TASKS,
  ANALYZABLE: summary.BRAIN_ANALYZABLE,
  CONFLICT: summary.CONFLICT,
  NOT_COMPARABLE: summary.NOT_COMPARABLE,
  NO_EVIDENCE: summary.NO_EVIDENCE
}));
