/**
 * Exposes canonical handBucket for legacy PokerBrain (browser ESM).
 */
import { handBucketFromEvaluator } from './solver/src/cards/handBucket.js';

window.PsHandBucketFromEval = function psHandBucketBridge(hero, board) {
  return handBucketFromEvaluator(hero || [], board || []);
};
