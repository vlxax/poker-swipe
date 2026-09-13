// Skill diagnosis constants (no training-graph imports — safe for weaknessTargeting).

export const SKILL_DIAGNOSES = {
  TRUE_WEAKNESS: 'true_weakness',
  TEMPORARY_MISTAKE: 'temporary_mistake',
  MASTERED: 'mastered',
  DECAYING: 'decaying',
  IMPROVING: 'improving',
  STABLE: 'stable',
  LEARNING: 'learning'
};

export function diagnosisPriorityBoost(diagnosis) {
  switch (diagnosis) {
    case SKILL_DIAGNOSES.TRUE_WEAKNESS: return 3.5;
    case SKILL_DIAGNOSES.DECAYING: return 3;
    case SKILL_DIAGNOSES.TEMPORARY_MISTAKE: return 2;
    case SKILL_DIAGNOSES.IMPROVING: return 1.2;
    case SKILL_DIAGNOSES.LEARNING: return 1.5;
    case SKILL_DIAGNOSES.MASTERED: return -2.5;
    case SKILL_DIAGNOSES.STABLE: return 0.5;
    default: return 0;
  }
}
