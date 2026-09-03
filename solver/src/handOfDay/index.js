// Hand of the Day module exports

export { ScenarioEngine, validateScenario } from './scenarioEngine.js';
export { VILLAIN_ARCHETYPES, getVillainDialogue, getArchetypeTendency, getCharacterProfile } from './villainPersonality.js';
export { ObservationCollector, STANDARD_OBSERVATIONS, suggestObservationsForNode, formatObservationsForUI } from './observationSystem.js';
export { READ_CATEGORIES, buildReadQuestion, gradeRead, buildReveal, describeHand, formatReadQuestionForUI } from './readSystem.js';
export { HAND_OF_DAY_SCENARIOS } from './scenarios.js';

// Production-ready expanded library (overrides old getters)
export { HAND_OF_DAY_SCENARIOS_EXPANDED, getScenarioById, getAllScenarios, getScenarioCount } from './scenariosExpanded.js';
export { HAND_OF_DAY_SCENARIOS_BATCH2 } from './scenariosExpanded2.js';

// Production enhancements
export { GRADES, HandForensics, gradeActionDecision, gradeReadChoice, getDecisionExplanation } from './gradingSystem.js';
export { ScenarioValidator, validateAllScenarios } from './scenarioValidator.js';
