// Hand of the Day Brain Integration Tests
// Verifies exact-once semantics, grading mapping, concept mapping, persistence

import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  HandOfDayBrainIntegration,
  adaptHodGradeToCanonical,
  buildMistakeMemoryAttempt,
  areHodAttemptsIdentical,
  getConceptForScenario,
  isScenarioMapped,
  getMappedScenarios,
  getUnmappedScenarios,
  MAPPING_REPORT
} from '../solver/src/index.js';
import { createTrainingStore } from '../solver/src/index.js';

describe('Hand of the Day Brain Integration', () => {
  describe('Scenario-Concept Mapping', () => {
    it('maps core scenarios to canonical concepts', () => {
      assert.strictEqual(getConceptForScenario('hod_003_rfi_co_10bb'), 'position_opening');
      assert.strictEqual(getConceptForScenario('hod_005_bb_defense_40bb_lag_button'), 'bb_vs_sb_steal');
      assert.strictEqual(getConceptForScenario('hod_007_3bet_pot_35bb_co_bb'), '3bet_defense');
      assert.strictEqual(getConceptForScenario('hod_008_cbet_flop_40bb_mp_bb'), 'c_bet_flop');
    });

    it('returns null for unmapped scenarios', () => {
      assert.strictEqual(getConceptForScenario('hod_013_overbet_bluff'), null);
      assert.strictEqual(getConceptForScenario('hod_016_icm_considerations'), null);
      assert.strictEqual(getConceptForScenario('hod_027_pko_bounty_decisions'), null);
      assert.strictEqual(getConceptForScenario('hod_028_limped_pot_dynamics'), null);
    });

    it('distinguishes mapped vs unmapped', () => {
      assert.ok(isScenarioMapped('hod_003_rfi_co_10bb'));
      assert.ok(!isScenarioMapped('hod_013_overbet_bluff'));
    });

    it('reports mapping statistics', () => {
      assert.strictEqual(MAPPING_REPORT.totalScenarios, 31);
      assert.strictEqual(MAPPING_REPORT.mappedCount, 22);
      assert.strictEqual(MAPPING_REPORT.unmappedCount, 9);
      assert.ok(MAPPING_REPORT.mappedScenarios['hod_003_rfi_co_10bb']);
      assert.ok(!MAPPING_REPORT.mappedScenarios['hod_013_overbet_bluff']);
    });

    it('unmapped scenarios list is correct', () => {
      const unmapped = getUnmappedScenarios();
      assert.ok(unmapped.includes('hod_013_overbet_bluff'));
      assert.ok(unmapped.includes('hod_016_icm_considerations'));
      assert.ok(!unmapped.includes('hod_003_rfi_co_10bb'));
    });
  });

  describe('Grading Adaptation', () => {
    it('maps BEST to canonical GOOD', () => {
      const result = adaptHodGradeToCanonical({ grade: 'BEST', classification: 'optimal' });
      assert.strictEqual(result.canonicalGrade, 'GOOD');
      assert.strictEqual(result.impliedEvLossBB, 0);
      assert.strictEqual(result.hodGrade, 'BEST');
      assert.strictEqual(result.hodClassification, 'optimal');
    });

    it('maps GOOD to canonical GOOD', () => {
      const result = adaptHodGradeToCanonical({ grade: 'GOOD' });
      assert.strictEqual(result.canonicalGrade, 'GOOD');
      assert.strictEqual(result.impliedEvLossBB, 0.02);
    });

    it('maps MIXED to canonical INACCURACY', () => {
      const result = adaptHodGradeToCanonical({ grade: 'MIXED' });
      assert.strictEqual(result.canonicalGrade, 'INACCURACY');
      assert.strictEqual(result.impliedEvLossBB, 0.10);
    });

    it('maps INACCURATE to canonical INACCURACY', () => {
      const result = adaptHodGradeToCanonical({ grade: 'INACCURATE' });
      assert.strictEqual(result.canonicalGrade, 'INACCURACY');
      assert.strictEqual(result.impliedEvLossBB, 0.40);
    });

    it('maps MISTAKE to canonical MISTAKE', () => {
      const result = adaptHodGradeToCanonical({ grade: 'MISTAKE', explanation: 'bad spot' });
      assert.strictEqual(result.canonicalGrade, 'MISTAKE');
      assert.strictEqual(result.impliedEvLossBB, 0.80);
      assert.strictEqual(result.hodExplanation, 'bad spot');
    });

    it('handles missing grade gracefully', () => {
      const result = adaptHodGradeToCanonical({});
      assert.strictEqual(result.canonicalGrade, 'GOOD');
      assert.strictEqual(result.impliedEvLossBB, 0);
    });

    it('preserves HOD metadata in adaptation', () => {
      const result = adaptHodGradeToCanonical({
        grade: 'MIXED',
        classification: 'context-dependent',
        explanation: 'depends on villain'
      });
      assert.strictEqual(result.hodGrade, 'MIXED');
      assert.strictEqual(result.hodClassification, 'context-dependent');
      assert.strictEqual(result.hodExplanation, 'depends on villain');
    });
  });

  describe('Mistake Memory Attempt Building', () => {
    it('builds valid attempt for mapped scenario', () => {
      const attempt = buildMistakeMemoryAttempt({
        scenarioId: 'hod_003_rfi_co_10bb',
        userActions: ['raise', 'call'],
        hodGrade: { grade: 'BEST' },
        concept: 'position_opening'
      });

      assert.ok(attempt.drill);
      assert.strictEqual(attempt.drill.concept, 'position_opening');
      assert.ok(attempt.drill.drillId.startsWith('hod_'));
      assert.strictEqual(attempt.drill.spotId, 'hod_hod_003_rfi_co_10bb');
      assert.strictEqual(attempt.grade, 'GOOD');
      assert.strictEqual(attempt.evLossBb, 0);
      assert.ok(attempt.hodMetadata);
      assert.strictEqual(attempt.hodMetadata.scenarioId, 'hod_003_rfi_co_10bb');
    });

    it('marks unmapped scenarios with unclassified concept', () => {
      const attempt = buildMistakeMemoryAttempt({
        scenarioId: 'hod_013_overbet_bluff',
        userActions: ['bet'],
        hodGrade: { grade: 'GOOD' }
      });

      assert.strictEqual(attempt.drill.concept, 'hand_of_day_unclassified');
    });

    it('stores action sequence in metadata', () => {
      const attempt = buildMistakeMemoryAttempt({
        scenarioId: 'hod_005_bb_defense_40bb_lag_button',
        userActions: ['3bet', 'call', 'fold'],
        hodGrade: { grade: 'INACCURATE' }
      });

      assert.deepStrictEqual(attempt.hodMetadata.userActions, ['3bet', 'call', 'fold']);
    });

    it('requires scenarioId', () => {
      assert.throws(() => {
        buildMistakeMemoryAttempt({
          userActions: ['bet'],
          hodGrade: { grade: 'GOOD' }
        });
      });
    });
  });

  describe('Attempt Deduplication', () => {
    it('detects identical attempts (same scenario, actions, timestamp)', () => {
      const attempt1 = buildMistakeMemoryAttempt({
        scenarioId: 'hod_003_rfi_co_10bb',
        userActions: ['raise'],
        hodGrade: { grade: 'BEST' },
        timestamp: 1000
      });

      const attempt2 = buildMistakeMemoryAttempt({
        scenarioId: 'hod_003_rfi_co_10bb',
        userActions: ['raise'],
        hodGrade: { grade: 'BEST' },
        timestamp: 1000
      });

      assert.ok(areHodAttemptsIdentical(attempt1, attempt2));
    });

    it('detects dupes within 5s window', () => {
      const attempt1 = buildMistakeMemoryAttempt({
        scenarioId: 'hod_003_rfi_co_10bb',
        userActions: ['raise'],
        hodGrade: { grade: 'BEST' },
        timestamp: 1000
      });

      const attempt2 = buildMistakeMemoryAttempt({
        scenarioId: 'hod_003_rfi_co_10bb',
        userActions: ['raise'],
        hodGrade: { grade: 'BEST' },
        timestamp: 3000  // +2s (within 5s window)
      });

      assert.ok(areHodAttemptsIdentical(attempt1, attempt2));
    });

    it('distinguishes attempts outside 5s window', () => {
      const attempt1 = buildMistakeMemoryAttempt({
        scenarioId: 'hod_003_rfi_co_10bb',
        userActions: ['raise'],
        hodGrade: { grade: 'BEST' },
        timestamp: 1000
      });

      const attempt2 = buildMistakeMemoryAttempt({
        scenarioId: 'hod_003_rfi_co_10bb',
        userActions: ['raise'],
        hodGrade: { grade: 'BEST' },
        timestamp: 7000  // +6s (outside window)
      });

      assert.ok(!areHodAttemptsIdentical(attempt1, attempt2));
    });

    it('distinguishes different scenarios', () => {
      const attempt1 = buildMistakeMemoryAttempt({
        scenarioId: 'hod_003_rfi_co_10bb',
        userActions: ['raise'],
        hodGrade: { grade: 'BEST' }
      });

      const attempt2 = buildMistakeMemoryAttempt({
        scenarioId: 'hod_005_bb_defense_40bb_lag_button',
        userActions: ['raise'],
        hodGrade: { grade: 'BEST' }
      });

      assert.ok(!areHodAttemptsIdentical(attempt1, attempt2));
    });

    it('distinguishes different action sequences', () => {
      const attempt1 = buildMistakeMemoryAttempt({
        scenarioId: 'hod_003_rfi_co_10bb',
        userActions: ['raise', 'fold'],
        hodGrade: { grade: 'BEST' }
      });

      const attempt2 = buildMistakeMemoryAttempt({
        scenarioId: 'hod_003_rfi_co_10bb',
        userActions: ['raise', 'call'],
        hodGrade: { grade: 'BEST' }
      });

      assert.ok(!areHodAttemptsIdentical(attempt1, attempt2));
    });

    it('handles null/undefined gracefully', () => {
      assert.ok(!areHodAttemptsIdentical(null, null));
      assert.ok(!areHodAttemptsIdentical(undefined, undefined));
    });
  });

  describe('HandOfDayBrainIntegration', () => {
    it('requires store on construction', () => {
      assert.throws(() => {
        new HandOfDayBrainIntegration({});
      });
    });

    it('records mapped scenario to learning system', () => {
      const store = createTrainingStore({});
      const integration = new HandOfDayBrainIntegration({ store });

      const result = integration.record({
        scenarioId: 'hod_003_rfi_co_10bb',
        userActions: ['raise'],
        hodGrade: { grade: 'BEST' }
      });

      assert.strictEqual(result.recorded, true);
      assert.strictEqual(result.learning, true);
      assert.strictEqual(result.concept, 'position_opening');
      assert.strictEqual(result.grade, 'GOOD');
    });

    it('records unmapped scenario without learning', () => {
      const store = createTrainingStore({});
      const integration = new HandOfDayBrainIntegration({ store });

      const result = integration.record({
        scenarioId: 'hod_013_overbet_bluff',
        userActions: ['bet'],
        hodGrade: { grade: 'GOOD' }
      });

      assert.strictEqual(result.recorded, true);
      assert.strictEqual(result.learning, false);
      assert.strictEqual(result.reason, 'unmapped_scenario');
    });

    it('prevents duplicate recording (exact-once)', () => {
      const store = createTrainingStore({});
      const integration = new HandOfDayBrainIntegration({ store });

      // First recording
      const result1 = integration.record({
        scenarioId: 'hod_003_rfi_co_10bb',
        userActions: ['raise'],
        hodGrade: { grade: 'BEST' },
        timestamp: 1000
      });
      assert.strictEqual(result1.recorded, true);

      // Duplicate attempt (reload, back button, etc.)
      const result2 = integration.record({
        scenarioId: 'hod_003_rfi_co_10bb',
        userActions: ['raise'],
        hodGrade: { grade: 'BEST' },
        timestamp: 1500  // within 5s
      });
      assert.strictEqual(result2.recorded, false);
      assert.strictEqual(result2.deduped, true);
    });

    it('allows different action sequences on same scenario', () => {
      const store = createTrainingStore({});
      const integration = new HandOfDayBrainIntegration({ store });

      const result1 = integration.record({
        scenarioId: 'hod_003_rfi_co_10bb',
        userActions: ['raise'],
        hodGrade: { grade: 'BEST' },
        timestamp: 1000
      });
      assert.strictEqual(result1.recorded, true);

      const result2 = integration.record({
        scenarioId: 'hod_003_rfi_co_10bb',
        userActions: ['raise', 'call'],  // different sequence
        hodGrade: { grade: 'GOOD' },
        timestamp: 2000
      });
      assert.strictEqual(result2.recorded, true);  // Different sequence, should record
    });

    it('rejects missing scenarioId', () => {
      const store = createTrainingStore({});
      const integration = new HandOfDayBrainIntegration({ store });

      const result = integration.record({
        userActions: ['raise'],
        hodGrade: { grade: 'BEST' }
      });
      assert.strictEqual(result.recorded, false);
      assert.strictEqual(result.reason, 'missing_scenario_id');
    });

    it('rejects missing grade', () => {
      const store = createTrainingStore({});
      const integration = new HandOfDayBrainIntegration({ store });

      const result = integration.record({
        scenarioId: 'hod_003_rfi_co_10bb',
        userActions: ['raise']
      });
      assert.strictEqual(result.recorded, false);
      assert.strictEqual(result.reason, 'missing_grade');
    });

    it('preserves HOD metadata in return', () => {
      const store = createTrainingStore({});
      const integration = new HandOfDayBrainIntegration({ store });

      const result = integration.record({
        scenarioId: 'hod_003_rfi_co_10bb',
        userActions: ['raise', 'fold'],
        hodGrade: { grade: 'MIXED', explanation: 'context-dependent' }
      });

      assert.ok(result.metadata);
      assert.strictEqual(result.metadata.originalGrade, 'MIXED');
      assert.strictEqual(result.metadata.originalExplanation, 'context-dependent');
    });

    it('tracks last recorded attempt for dedup', () => {
      const store = createTrainingStore({});
      const integration = new HandOfDayBrainIntegration({ store });

      integration.record({
        scenarioId: 'hod_003_rfi_co_10bb',
        userActions: ['raise'],
        hodGrade: { grade: 'BEST' }
      });

      const last = integration.getLastAttempt();
      assert.ok(last);
      assert.strictEqual(last.hodMetadata.scenarioId, 'hod_003_rfi_co_10bb');
    });

    it('can reset internal state (for testing)', () => {
      const store = createTrainingStore({});
      const integration = new HandOfDayBrainIntegration({ store });

      integration.record({
        scenarioId: 'hod_003_rfi_co_10bb',
        userActions: ['raise'],
        hodGrade: { grade: 'BEST' }
      });

      integration.reset();
      assert.strictEqual(integration.getLastAttempt(), null);
    });
  });

  describe('Semantic Preservation', () => {
    it('preserves BEST/GOOD as learnable (not punished)', () => {
      const store = createTrainingStore({});
      const integration = new HandOfDayBrainIntegration({ store });

      const result = integration.record({
        scenarioId: 'hod_003_rfi_co_10bb',
        userActions: ['raise'],
        hodGrade: { grade: 'GOOD' }
      });

      assert.strictEqual(result.grade, 'GOOD');  // Canonical GOOD, not MISTAKE
    });

    it('preserves MIXED as INACCURACY (learnable, not punished)', () => {
      const store = createTrainingStore({});
      const integration = new HandOfDayBrainIntegration({ store });

      const result = integration.record({
        scenarioId: 'hod_007_3bet_pot_35bb_co_bb',
        userActions: ['3bet', 'call'],
        hodGrade: { grade: 'MIXED' }
      });

      assert.strictEqual(result.grade, 'INACCURACY');  // Learnable, not MISTAKE
    });

    it('maps MISTAKE to canonical MISTAKE (punished)', () => {
      const store = createTrainingStore({});
      const integration = new HandOfDayBrainIntegration({ store });

      const result = integration.record({
        scenarioId: 'hod_008_cbet_flop_40bb_mp_bb',
        userActions: ['bet', 'fold'],
        hodGrade: { grade: 'MISTAKE' }
      });

      assert.strictEqual(result.grade, 'MISTAKE');  // Canonical MISTAKE
    });
  });
});
