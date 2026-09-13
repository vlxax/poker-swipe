// Enhanced grading system for Hand of the Day
// Supports nuanced feedback: BEST, GOOD, MIXED, INACCURATE, MISTAKE

export const GRADES = {
  BEST: {
    id: 'BEST',
    label: 'ЛУЧШИЙ ВЫД',
    emoji: '⭐',
    shortMessage: 'Отличный выбор. Это самый прибыльный ход.',
    color: '#c8ff3d'
  },
  GOOD: {
    id: 'GOOD',
    label: 'ХОРОШИЙ ВЫД',
    emoji: '✅',
    shortMessage: 'Хороший выбор. Но есть вариант получше.',
    color: '#90ee90'
  },
  MIXED: {
    id: 'MIXED',
    label: 'СПОРНЫЙ ВЫД',
    emoji: '⚖️',
    shortMessage: 'Может быть прибыльным в зависимости от противника.',
    color: '#ffd700'
  },
  INACCURATE: {
    id: 'INACCURATE',
    label: 'НЕТОЧНО',
    emoji: '⚠️',
    shortMessage: 'Рука есть потенциал, но есть лучшие варианты.',
    color: '#ff6b6b'
  },
  MISTAKE: {
    id: 'MISTAKE',
    label: 'ОШИБКА',
    emoji: '❌',
    shortMessage: 'Это решение невыгодно в данной ситуации.',
    color: '#ff0000'
  }
};

// Street-by-street decision tracking
export class HandForensics {
  constructor(scenario) {
    this.scenario = scenario;
    this.decisions = [];  // { street, nodeId, action, grade }
    this.firstError = null;  // { street, nodeId, action, explanation }
  }

  recordDecision(street, nodeId, action, grade) {
    this.decisions.push({ street, nodeId, action, grade, timestamp: Date.now() });

    // Track first meaningful error
    if (!this.firstError && (grade === 'INACCURATE' || grade === 'MISTAKE')) {
      this.firstError = { street, nodeId, action, grade };
    }
  }

  // Get forensic review showing first error and consequences
  getForensicReview() {
    if (this.decisions.length === 0) return null;

    const streets = ['preflop', 'flop', 'turn', 'river'];
    const review = {};

    streets.forEach(street => {
      const decisions = this.decisions.filter(d => d.street === street);
      if (decisions.length > 0) {
        const lastDecision = decisions[decisions.length - 1];
        review[street] = {
          grade: lastDecision.grade,
          status: lastDecision.grade === 'BEST' || lastDecision.grade === 'GOOD' ? 'GOOD' : 'BAD',
          isFirstError: this.firstError && this.firstError.street === street
        };
      }
    });

    return {
      review,
      firstError: this.firstError,
      allDecisions: this.decisions
    };
  }
}

export function gradeActionDecision(chosenAction, optimalAction, context = {}) {
  // action: { id, label }
  // context: { street, villain, position, stack, pot, ... }

  if (chosenAction === optimalAction) {
    return {
      grade: 'BEST',
      classification: 'optimal',
      message: 'Это оптимальный ход в этой ситуации.'
    };
  }

  // Define alternative acceptable actions per street
  const alternatives = defineAlternativesForAction(optimalAction, context);

  if (alternatives.good.includes(chosenAction)) {
    return {
      grade: 'GOOD',
      classification: 'alternative_good',
      message: 'Это хороший ход, но немного менее выгоден, чем альтернатива.'
    };
  }

  if (alternatives.mixed.includes(chosenAction)) {
    return {
      grade: 'MIXED',
      classification: 'alternative_mixed',
      message: 'Это может работать, но результат зависит от параметров и противника.'
    };
  }

  if (alternatives.inaccurate.includes(chosenAction)) {
    return {
      grade: 'INACCURATE',
      classification: 'suboptimal',
      message: 'Рука может быть прибыльной, но есть явно лучшие ходы.'
    };
  }

  // Everything else is a mistake
  return {
    grade: 'MISTAKE',
    classification: 'error',
    message: 'Этот ход невыгоден в данной ситуации.'
  };
}

// Map optimal actions to acceptable alternatives by street
function defineAlternativesForAction(optimalAction, context) {
  const { street } = context;

  const alternatives = {
    good: [],    // Marginally worse but acceptable
    mixed: [],   // Situation-dependent
    inaccurate: [],  // Clearly worse but not terrible
  };

  if (street === 'preflop') {
    if (optimalAction === 'raise') {
      alternatives.good.push('call');  // Can call certain ranges
      alternatives.mixed.push('fold');  // Depends on hand strength
    } else if (optimalAction === 'call') {
      alternatives.good.push('raise');  // Balanced 3betting is ok
      alternatives.mixed.push('fold');  // Depends on hand
    } else if (optimalAction === 'fold') {
      alternatives.inaccurate.push('call');  // Maybe marginal
    }
  }

  if (['flop', 'turn', 'river'].includes(street)) {
    if (optimalAction === 'bet') {
      alternatives.good.push('bet');  // Different sizing
      alternatives.mixed.push('check');  // Depends on hand/equity
    } else if (optimalAction === 'check') {
      alternatives.good.push('check-raise');  // Rare but ok
      alternatives.mixed.push('bet');  // Depends on situation
    } else if (optimalAction === 'call') {
      alternatives.mixed.push('raise');  // Aggressive line
      alternatives.mixed.push('fold');  // Depends on situation
    } else if (optimalAction === 'fold') {
      alternatives.inaccurate.push('call');  // Marginal holdings
    }
  }

  return alternatives;
}

export function gradeReadChoice(userChoice, correctChoiceId, readCategories = {}) {
  if (userChoice === correctChoiceId) {
    return {
      grade: 'BEST',
      correct: true,
      message: 'Ты правильно прочитал ситуацию.'
    };
  }

  const userCat = readCategories[userChoice];
  const correctCat = readCategories[correctChoiceId];

  if (!userCat || !correctCat) {
    return {
      grade: 'MISTAKE',
      correct: false,
      message: 'Неправильный выбор.'
    };
  }

  // Define similar/related reads
  const similarReads = defineSimilarReads(correctChoiceId);

  if (similarReads.includes(userChoice)) {
    return {
      grade: 'GOOD',
      correct: false,
      message: `Близко, но не совсем. ${userCat.label} похожа на ${correctCat.label}, но контекст немного другой.`
    };
  }

  return {
    grade: 'INACCURATE',
    correct: false,
    message: `${correctCat.label} — правильный ответ. ${userCat.label} не соответствует действиям соперника.`
  };
}

// Define which reads are similar to each other
function defineSimilarReads(readId) {
  const similarityMap = {
    'strong-value': ['weak-value', 'turned-hand'],
    'weak-value': ['strong-value'],
    'turned-hand': ['missed-bluff', 'doesnt-believe'],
    'missed-bluff': ['turned-hand', 'doesnt-believe'],
    'doesnt-believe': ['turned-hand'],
    'bb-defense': ['defensive-check-raise'],
    'defensive-check-raise': ['bb-defense', 'slow-play'],
    'slow-play': ['strong-value'],
    'slow-trap': ['turned-hand']
  };

  return similarityMap[readId] || [];
}

// Explanation generator for decisions
export function getDecisionExplanation(decision, scenario, context = {}) {
  const { street, chosenAction, grade } = decision;
  const { villain, hero, tournament } = scenario;

  let explanation = '';

  if (street === 'preflop') {
    explanation = `На префлопе с ${hero.stackBb}BB ты выбрал ${chosenAction}. `;
    if (grade === 'BEST') {
      explanation += `Это правильно против ${villain.archetype}. `;
    } else if (grade === 'GOOD') {
      explanation += `Это может работать, но есть более выгодные линии. `;
    } else {
      explanation += `Это невыгодно в этой позиции против ${villain.archetype}. `;
    }
  } else {
    explanation = `На ${street} с чансом ${context.equity || '?'}% ты выбрал ${chosenAction}. `;
    if (grade === 'BEST') {
      explanation += `Это максимизирует EV против его диапазона. `;
    } else if (grade === 'GOOD') {
      explanation += `Это хороший ход, но другие действия тоже работают. `;
    }
  }

  return explanation;
}
