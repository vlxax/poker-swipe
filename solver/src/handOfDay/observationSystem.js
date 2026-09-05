// Observation system — tracks reads and clues during hand

export class ObservationCollector {
  constructor() {
    this.collected = [];  // { nodeId, text, count, totalCount, types }
    this.maxObservations = 4;
  }

  addObservation(obs) {
    if (!obs.nodeId || !obs.text) return { ok: false };
    if (this.collected.length >= this.maxObservations) {
      return { ok: false, reason: 'max_observations_reached' };
    }
    if (this.collected.some((o) => o.nodeId === obs.nodeId)) {
      return { ok: false, reason: 'duplicate_observation' };
    }

    const observation = {
      nodeId: obs.nodeId,
      text: obs.text,
      count: obs.count || 1,
      totalCount: obs.totalCount || 4,
      types: obs.types || [],  // 'timing', 'line', 'pattern', 'body-language'
      addedAt: Date.now()
    };

    this.collected.push(observation);
    return { ok: true, observation, collectedCount: this.collected.length };
  }

  getAll() {
    return [...this.collected];
  }

  getFormatted() {
    return this.collected.map((obs, idx) => ({
      ...obs,
      displayIndex: idx + 1,
      progressLabel: `${idx + 1}/${this.collected.length}`
    }));
  }

  isFull() {
    return this.collected.length >= this.maxObservations;
  }

  clear() {
    this.collected = [];
  }

  toJSON() {
    return this.collected;
  }
}

// Standard observations that can appear in scenarios
export const STANDARD_OBSERVATIONS = {
  'timing-fast-check': {
    text: '⚡ Быстро проверил. Часто так с слабыми руками.',
    types: ['timing', 'behavior'],
    category: 'positive'  // helps identify weak hands
  },

  'timing-slow-think': {
    text: '⏱ Долго думал перед ставкой. Может быть, слабая рука?',
    types: ['timing', 'behavior'],
    category: 'positive'
  },

  'sizing-small-bet': {
    text: '$ Маленькая ставка. Обычно ставит больше со вэлью.',
    types: ['sizing', 'pattern'],
    category: 'positive'
  },

  'sizing-overbet': {
    text: '$ Переставил банк. Редко делает такое со слабыми.',
    types: ['sizing', 'pattern'],
    category: 'negative'
  },

  'line-weak-play': {
    text: '🔄 Пассивно ловил рук чек-рейз-фолд. Признак слабой руки.',
    types: ['line', 'pattern'],
    category: 'positive'
  },

  'line-check-raise': {
    text: '🔄 Чек-рейз. Почти всегда сильная рука или вэлью-блеф.',
    types: ['line', 'pattern'],
    category: 'negative'
  },

  'bb-defense-aggressive': {
    text: '⬜ Защищает BB агрессивно. Не боится давить спину.',
    types: ['position', 'pattern'],
    category: 'negative'
  },

  'bb-defense-passive': {
    text: '⬜ Защищает BB редко. Можно давить его блайнды.',
    types: ['position', 'pattern'],
    category: 'positive'
  },

  'river-underbluff': {
    text: '🌊 На ривере часто чекирует. Редко блефует здесь.',
    types: ['street', 'pattern'],
    category: 'positive'
  },

  'river-overbleep': {
    text: '🌊 На ривере часто ставит. Может быть воздух?',
    types: ['street', 'pattern'],
    category: 'positive'
  },

  'turn-aggression': {
    text: '↗️ На тёрне пытается украсть. Часто блефует тут.',
    types: ['street', 'pattern'],
    category: 'positive'
  },

  'flop-fast-bet': {
    text: '⚡ Флоп быстро ставит даже со слабыми. Агрессивный.',
    types: ['timing', 'street', 'pattern'],
    category: 'negative'
  },

  'stack-short-play': {
    text: '💰 С коротким стэком играет пассивнее чем обычно.',
    types: ['stack', 'pattern'],
    category: 'positive'
  }
};

// Determine which observations might apply (for hint system, not cheating)
export function suggestObservationsForNode(node, villain, scenario) {
  if (!node || node.type !== 'hero-decision') return [];

  const applicable = [];

  // Based on villain archetype
  if (villain?.archetype === 'tight-reg') {
    applicable.push(STANDARD_OBSERVATIONS['bb-defense-passive']);
  } else if (villain?.archetype === 'lag') {
    applicable.push(STANDARD_OBSERVATIONS['bb-defense-aggressive']);
    applicable.push(STANDARD_OBSERVATIONS['flop-fast-bet']);
  } else if (villain?.archetype === 'calling-station') {
    applicable.push(STANDARD_OBSERVATIONS['line-weak-play']);
  }

  // Based on street
  if (node.street === 'river') {
    applicable.push(STANDARD_OBSERVATIONS['river-underbluff']);
  } else if (node.street === 'turn') {
    applicable.push(STANDARD_OBSERVATIONS['turn-aggression']);
  }

  // Based on stack depth
  if (scenario?.hero?.stackBb && scenario.hero.stackBb < 20) {
    applicable.push(STANDARD_OBSERVATIONS['stack-short-play']);
  }

  return applicable.slice(0, 2);  // Return max 2 suggestions
}

// Format observations for display
export function formatObservationsForUI(observations) {
  return observations.map((obs, idx) => ({
    ...obs,
    displayLabel: `НАБЛЮДЕНИЕ ${idx + 1}/${observations.length}`,
    displayText: obs.text
  }));
}
