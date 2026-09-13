// Read system — final read question and reveal logic

export const READ_CATEGORIES = {
  'strong-value': {
    id: 'strong-value',
    label: 'СИЛЬНОЕ ВЭЛЬЮ',
    description: 'Медленно собирал максимум. Вэлю-рука.',
    emoji: '💎'
  },

  'weak-value': {
    id: 'weak-value',
    label: 'СЛАБОЕ ВЭЛЬЮ',
    description: 'Тонкая вэлю. Рука может быть сильнее.',
    emoji: '💍'
  },

  'turned-hand': {
    id: 'turned-hand',
    label: 'ПРЕВРАЩАЕТ РУКУ В БЛЕФ',
    description: 'Слабая рука, которая играет как блеф. Никогда не выигрывает showdown.',
    emoji: '🔄'
  },

  'missed-bluff': {
    id: 'missed-bluff',
    label: 'ПРОМАХНУЛСЯ С БЛЕФОМ',
    description: 'Попытался украсть, но встретил сопротивление.',
    emoji: '💨'
  },

  'doesnt-believe': {
    id: 'doesnt-believe',
    label: 'НЕ ВЕРИТ ГЕРОЮ',
    description: 'Считает, что ты переблефуешь. Вскрывает часто.',
    emoji: '🤨'
  },

  'bb-defense': {
    id: 'bb-defense',
    label: 'ШИРОКО ЗАЩИЩАЕТ БОЛЬШОЙ БЛАЙНД',
    description: 'Не даёт легко забирать его BB. Защитный диапазон.',
    emoji: '⬜'
  },

  'defensive-check-raise': {
    id: 'defensive-check-raise',
    label: 'ЗАЩИТНЫЙ ЧЕК-РЕЙЗ',
    description: 'Защищается от продолжений. Не очень сильная рука.',
    emoji: '🛡️'
  },

  'semi-bluff': {
    id: 'semi-bluff',
    label: 'ПОЛУБЛЕФ',
    description: 'Рука может выиграть, но не сейчас. Полублеф с потенциалом.',
    emoji: '🎲'
  },

  'no-idea': {
    id: 'no-idea',
    label: 'НЕ ЗНАЮ',
    description: 'Линия неоднозначна. Может быть всё что угодно.',
    emoji: '❓'
  }
};

// Build a read question for a specific scenario
export function buildReadQuestion(scenario, villainCards, observations) {
  const readChoices = Object.values(READ_CATEGORIES).map((cat) => ({
    id: cat.id,
    label: cat.label,
    description: cat.description,
    emoji: cat.emoji
  }));

  return {
    prompt: 'КАК ТЫ ЕГО ПРОЧИТАЛА?',
    subtitle: 'Выбери, что означала его линия.',
    choices: readChoices,
    observations: observations || [],
    villainCards: villainCards || []
  };
}

// Grade the user's read choice against the correct answer
export function gradeRead(userChoice, correctChoiceId, scenario) {
  const userCat = READ_CATEGORIES[userChoice];
  const correctCat = READ_CATEGORIES[correctChoiceId];

  if (!userCat || !correctCat) {
    return {
      correct: false,
      grade: 'MISTAKE',
      message: 'Неправильный выбор.'
    };
  }

  const isCorrect = userChoice === correctChoiceId;

  return {
    correct: isCorrect,
    grade: isCorrect ? 'EXCELLENT' : 'MISTAKE',
    userChoice: userChoice,
    correctChoice: correctChoiceId,
    userLabel: userCat.label,
    correctLabel: correctCat.label,
    message: isCorrect
      ? `Верно! ${correctCat.description}`
      : `Не совсем. ${correctCat.label}: ${correctCat.description}`
  };
}

// Build reveal screen data after read is revealed
export function buildReveal(scenario, villainCards, userChoice, correctChoice, explanation) {
  const villainHand = describeHand(villainCards);
  const correctCat = READ_CATEGORIES[correctChoice];
  const userCat = READ_CATEGORIES[userChoice];

  return {
    villainCards: villainCards,
    villainHand: villainHand,
    userChoiceLabel: userCat?.label || 'Выбор',
    correctChoiceLabel: correctCat?.label || 'Верно',
    isCorrect: userChoice === correctChoice,
    explanation: explanation,
    keyTakeaway: generateKeyTakeaway(scenario, villainCards, correctChoice),
    readChoice: correctChoice
  };
}

// Convert cards to readable name (e.g. 'As2s' -> 'Ace-deuce suited')
export function describeHand(cards) {
  if (!cards || cards.length < 2) return 'Карты';

  const cardNames = {
    'A': 'Ace', 'K': 'King', 'Q': 'Queen', 'J': 'Jack',
    'T': 'Ten', '9': 'Nine', '8': 'Eight', '7': 'Seven',
    '6': 'Six', '5': 'Five', '4': 'Four', '3': 'Three', '2': 'Deuce'
  };

  const suits = { 's': '♠', 'h': '♥', 'd': '♦', 'c': '♣' };

  const c1 = cards[0] || '';
  const c2 = cards[1] || '';

  const rank1 = cardNames[c1[0]] || c1[0];
  const rank2 = cardNames[c2[0]] || c2[0];
  const suit1 = suits[c1[1]] || c1[1];
  const suit2 = suits[c2[1]] || c2[1];

  const isSuited = c1[1] === c2[1];
  const isPair = c1[0] === c2[0];

  let desc = '';
  if (isPair) {
    desc = `Пара ${rank1}ов`;
  } else if (isSuited) {
    desc = `${rank1}-${rank2} suited`;
  } else {
    desc = `${rank1}-${rank2} offsuit`;
  }

  return `${c1}${c2} (${desc})`;
}

// Generate a teaching point based on the correct read
function generateKeyTakeaway(scenario, villainCards, correctChoice) {
  const reads = {
    'strong-value': 'Она медленно ловила максимум, значит это был вэлью.',
    'weak-value': 'Тонкая вэлю. Её руки слабее, чем казалось.',
    'turned-hand': 'Она не могла выиграть showdown, поэтому играла агрессивно.',
    'missed-bluff': 'Блеф не пошёл. Нужно был тайтер блефовать.',
    'doesnt-believe': 'Она считает, что ты часто блефуешь. Нужно сбалансировать.',
    'bb-defense': 'BB защищает широко. Не давай ей слишком легко.',
    'defensive-check-raise': 'Это защита, а не отвага. Её рука слаба.',
    'semi-bluff': 'Рука имеет equity и потенциал, не чистый блеф.',
    'no-idea': 'Рука неоднозначна. Пока ты собираешь больше информации.'
  };

  return reads[correctChoice] || 'Хорошо прочитала соперника.';
}

// Format read question for UI
export function formatReadQuestionForUI(readQuestion) {
  return {
    ...readQuestion,
    choicesFormatted: readQuestion.choices.map((c) => ({
      ...c,
      displayLabel: `${c.emoji} ${c.label}`
    }))
  };
}
