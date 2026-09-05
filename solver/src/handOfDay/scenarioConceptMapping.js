// Hand of the Day → Canonical PokerSwipe Concept Mapping
// Maps 31 Hand of the Day scenarios to existing LEAKS concepts where semantically valid.
// UNMAPPED scenarios are excluded from learning system (intentional).

import { LEAKS } from '../training/concepts.js';

// Bidirectional mapping: scenario ID ↔ concept
const SCENARIO_TO_CONCEPT = {
  // Batch 1 (8 scenarios)
  'hod_003_rfi_co_10bb': 'position_opening',          // RFI in CO
  'hod_004_rfi_btn_20bb_aggressive': 'position_opening',  // RFI on BTN
  'hod_005_bb_defense_40bb_lag_button': 'bb_vs_sb_steal', // BB defense
  'hod_006_sb_vs_bb_15bb_tight': 'sb_vs_bb_defense',     // SB vs BB
  'hod_007_3bet_pot_35bb_co_bb': '3bet_defense',         // 3-bet pot
  'hod_008_cbet_flop_40bb_mp_bb': 'c_bet_flop',          // C-bet flop
  'hod_009_bluff_catch_river_25bb': 'river_decisions',   // Bluff catch
  'hod_010_push_fold_8bb_utg': 'push_fold_icm',          // Push-fold

  // Batch 2 (21 scenarios) — mostly unmapped due to specialized topics
  'hod_011_thin_value_1': null,                          // UNMAPPED: thin value specific
  'hod_012_thin_value_2': null,                          // UNMAPPED: thin value specific
  'hod_013_overbet_bluff': null,                         // UNMAPPED: no overbet concept
  'hod_014_check_raise_1': 'check_raise',                // Check-raise
  'hod_015_check_raise_2': 'check_raise',                // Check-raise
  'hod_016_icm_considerations': null,                    // UNMAPPED: no ICM in LEAKS
  'hod_017_final_table_push_fold': 'push_fold_icm',      // Final table push-fold
  'hod_018_double_barrel': 'multi_street_aggression',    // Double barrel
  'hod_019_calling_station_exploit': 'value_extraction', // Exploit calling station
  'hod_020_tight_reg_specific': null,                    // UNMAPPED: opponent-specific
  'hod_021_passive_opp_exploitation': 'value_extraction', // Exploit passive
  'hod_022_position_rfi_utg': 'position_opening',        // RFI UTG
  'hod_023_position_rfi_ep': 'position_opening',         // RFI EP
  'hod_024_bubble_chip_leader': 'push_fold_icm',         // Bubble chip leader
  'hod_025_short_stack_push_fold': 'push_fold_icm',      // Short-stack push-fold
  'hod_026_late_position_steal': 'position_opening',     // Late position steal
  'hod_027_pko_bounty_decisions': null,                  // UNMAPPED: PKO not in LEAKS
  'hod_028_limped_pot_dynamics': null,                   // UNMAPPED: limped pot not in LEAKS
  'hod_029_multiway_pot_1': null,                        // UNMAPPED: multiway not in LEAKS
  'hod_030_multiway_pot_2': null,                        // UNMAPPED: multiway not in LEAKS
  'hod_031_4bet_pot_dynamics': '3bet_defense',           // 4-bet pot (similar to 3bet)
};

// Original 2 scenarios from Stage 1 (preserved for continuity)
const ORIGINAL_SCENARIOS = {
  'hod_001_bubble_btn_bb_short': 'push_fold_icm',
  'hod_002_bluff_river_value_thin': 'river_decisions',
};

// Merge all mappings
const ALL_SCENARIOS = { ...SCENARIO_TO_CONCEPT, ...ORIGINAL_SCENARIOS };

/**
 * Get canonical concept for a Hand of the Day scenario.
 * Returns the concept string or null if unmapped.
 */
export function getConceptForScenario(scenarioId) {
  return ALL_SCENARIOS[scenarioId] || null;
}

/**
 * Check if a scenario has a mapping to a canonical concept.
 */
export function isScenarioMapped(scenarioId) {
  return getConceptForScenario(scenarioId) !== null;
}

/**
 * Get all mapped scenarios (scenario → concept pairs).
 */
export function getMappedScenarios() {
  return Object.entries(ALL_SCENARIOS)
    .filter(([_, concept]) => concept !== null)
    .reduce((acc, [id, concept]) => ({ ...acc, [id]: concept }), {});
}

/**
 * Get all unmapped scenario IDs.
 */
export function getUnmappedScenarios() {
  return Object.entries(ALL_SCENARIOS)
    .filter(([_, concept]) => concept === null)
    .map(([id]) => id);
}

/**
 * Scenario-to-Concept Mapping Report
 *
 * MAPPED (21/31):
 * - position_opening: 4 scenarios (RFI CO, BTN, UTG, EP, late position steal)
 * - push_fold_icm: 5 scenarios (push-fold, final table, bubble, short-stack, original bubble)
 * - bb_vs_sb_steal: 1 scenario
 * - sb_vs_bb_defense: 1 scenario
 * - 3bet_defense: 2 scenarios (3bet pot, 4bet pot)
 * - c_bet_flop: 1 scenario
 * - river_decisions: 2 scenarios (bluff catch, thin value)
 * - check_raise: 2 scenarios
 * - value_extraction: 2 scenarios (calling station, passive opp)
 * - multi_street_aggression: 1 scenario (double barrel)
 *
 * UNMAPPED (10/31):
 * - hod_011_thin_value_1, hod_012_thin_value_2 (specialized thin value, no LEAKS concept)
 * - hod_013_overbet_bluff (overbet not in LEAKS)
 * - hod_016_icm_considerations (ICM not in LEAKS)
 * - hod_020_tight_reg_specific (opponent type specific, not generalizable)
 * - hod_027_pko_bounty_decisions (PKO not in LEAKS)
 * - hod_028_limped_pot_dynamics (limped pots not in LEAKS)
 * - hod_029_multiway_pot_1, hod_030_multiway_pot_2 (multiway not in LEAKS)
 *
 * Decision Rationale:
 * Unmapped scenarios are EXCLUDED from learning system intentionally.
 * They are playable and graded internally, but do not contribute to Mistake Memory
 * or skill profiles. This preserves canonical concept integrity.
 */

export const MAPPING_REPORT = {
  totalScenarios: Object.keys(ALL_SCENARIOS).length,
  mappedCount: Object.values(ALL_SCENARIOS).filter(c => c !== null).length,
  unmappedCount: Object.values(ALL_SCENARIOS).filter(c => c === null).length,
  mappedScenarios: getMappedScenarios(),
  unmappedScenarios: getUnmappedScenarios()
};
