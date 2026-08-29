/**
 * Strategy Map & Adaptive Curriculum Engine
 * Main entry point
 */

import { StrategyMapIndex } from './strategyMapIndex.js';
import { buildRangeFingerprint, compareFingerprints } from './fingerprint.js';
import { compareStrategySimilarity } from './similarity.js';
import { findNearestRanges } from './neighbors.js';
import { analyzeStackTransitions, extractStackValue, sortRangesByStack } from './transitions.js';
import { detectChangePoints } from './changePoints.js';
import { traceHandAcrossRanges } from './handTrajectory.js';
import { findBoundaryHands, compareBoundaries } from './boundaries.js';
import { analyzeVolatility } from './volatility.js';
import { buildCurriculumGraph } from './curriculumGraph.js';
import { buildPersonalLearningPath } from './personalCurriculum.js';
import { createTransitionLesson } from './lessonGenerator.js';
import { selectTransitionQuizHands } from './quizSelector.js';
import { findDuplicateStrategies } from './duplicates.js';
import * as math from './math.js';

export class StrategyMapEngine {
  constructor(options = {}) {
    this.options = options;
    this.index = new StrategyMapIndex(options);
  }

  loadLibrary(library) {
    this.index.clear();
    if (!library) return;
    for (const range of library) {
      this.index.add(range);
    }
  }

  replaceRange(range) {
    this.index.replace(range);
  }

  removeRange(id) {
    this.index.remove(id);
  }

  clear() {
    this.index.clear();
  }

  fingerprint(range) {
    return buildRangeFingerprint(range);
  }

  compareFingerprints(fpA, fpB) {
    return compareFingerprints(fpA, fpB);
  }

  similarity(rangeA, rangeB) {
    return compareStrategySimilarity(rangeA, rangeB);
  }

  neighbors(targetRange, options = {}) {
    const library = Array.from(this.index.ranges.values());
    return findNearestRanges(targetRange, library, options);
  }

  transitions(ranges) {
    return analyzeStackTransitions(ranges);
  }

  changePoints(ranges, options = {}) {
    return detectChangePoints(ranges, options);
  }

  trajectory(hand, ranges) {
    return traceHandAcrossRanges(hand, ranges);
  }

  volatility(ranges) {
    return analyzeVolatility(ranges);
  }

  curriculum(options = {}) {
    const library = Array.from(this.index.ranges.values());
    return buildCurriculumGraph(library, options);
  }

  personalPath({ learnerModel, startRange, maxSteps, options = {} }) {
    const library = Array.from(this.index.ranges.values());
    return buildPersonalLearningPath({
      library,
      learnerModel,
      startRange,
      maxSteps,
      options
    });
  }

  lesson(rangeA, rangeB) {
    return createTransitionLesson(rangeA, rangeB);
  }

  quizCandidates(rangeA, rangeB, options = {}) {
    return selectTransitionQuizHands(rangeA, rangeB, options);
  }

  duplicates(options = {}) {
    const library = Array.from(this.index.ranges.values());
    return findDuplicateStrategies(library, options);
  }

  getStats() {
    return this.index.getStats();
  }
}

// Re-export all functions
export { StrategyMapIndex };
export { buildRangeFingerprint, compareFingerprints, ALL_ACTIONS } from './fingerprint.js';
export { compareStrategySimilarity } from './similarity.js';
export { findNearestRanges } from './neighbors.js';
export { analyzeStackTransitions, extractStackValue, sortRangesByStack } from './transitions.js';
export { detectChangePoints } from './changePoints.js';
export { traceHandAcrossRanges } from './handTrajectory.js';
export { findBoundaryHands, compareBoundaries } from './boundaries.js';
export { analyzeVolatility } from './volatility.js';
export { buildCurriculumGraph } from './curriculumGraph.js';
export { buildPersonalLearningPath } from './personalCurriculum.js';
export { createTransitionLesson } from './lessonGenerator.js';
export { selectTransitionQuizHands } from './quizSelector.js';
export { findDuplicateStrategies } from './duplicates.js';
export * as math from './math.js';
