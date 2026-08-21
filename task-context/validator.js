// task-context/validator.js
// Валидатор библиотеки задач: уникальные ID, корректность карт, стеков, банка, улиц, действий.
// Чистый (без DOM), работает в Node и в браузере.

import {
  STREETS, FORMATS, STAGES, TABLES, DIFFICULTIES,
  isValidCard, hasDuplicates, cardsOf, POSITIONS
} from './schema.js';

export function validateTask(spot) {
  const errors = [];
  const warn = [];
  const add = (msg) => errors.push(msg);

  if (!spot || typeof spot !== 'object') { add('Задача не объект'); return { errors, warn }; }

  if (typeof spot.id !== 'string' || !spot.id.trim()) add('Нет id');
  if (!/^[A-Z0-9_]+$/.test(spot.id || '')) warn(`id "${spot.id}" — не только латиница/цифры/_`);

  if (!STREETS.includes(spot.street)) add(`street "${spot.street}" вне ${STREETS.join('/')}`);
  if (!FORMATS.includes(spot.format)) add(`format "${spot.format}" вне ${FORMATS.join('/')}`);
  if (!STAGES.includes(spot.stage)) add(`stage "${spot.stage}" вне ${STAGES.join('/')}`);
  if (!TABLES.includes(spot.table)) add(`table "${spot.table}" вне ${TABLES.join('/')}`);
  if (!DIFFICULTIES.includes(spot.difficulty)) add(`difficulty ${spot.difficulty} вне 1..5`);

  if (!Array.isArray(spot.hero) || spot.hero.length !== 2) add('hero должен быть ровно из 2 карт');
  else spot.hero.forEach((c, i) => { if (!isValidCard(c)) add(`hero[${i}] "${c}" не карта`); });

  if (!Array.isArray(spot.board)) add('board должен быть массивом');
  else {
    if (spot.board.length > 5) add('board больше 5 карт');
    spot.board.forEach((c, i) => { if (!isValidCard(c)) add(`board[${i}] "${c}" не карта`); });
    if (spot.board.length && STREETS.indexOf(spot.street) < STREETS.indexOf('ФЛОП'))
      warn(`board задан на улице "${spot.street}"`);
    if (!spot.board.length && spot.street !== 'ПРЕФЛОП')
      warn(`нет board на улице "${spot.street}"`);
  }

  if (hasDuplicates(spot)) add(`дубли карт: ${cardsOf(spot).join(' ')}`);

  if (!(spot.heroStack > 0)) add(`heroStack ${spot.heroStack} не положительный`);
  if (!(spot.villainStack > 0)) add(`villainStack ${spot.villainStack} не положительный`);
  if (!(spot.effStack > 0)) add(`effStack ${spot.effStack} не положительный`);
  if (spot.effStack > Math.min(spot.heroStack, spot.villainStack) + 1e-9)
    warn(`effStack ${spot.effStack} больше min(стеки)`);

  if (!Array.isArray(spot.blinds) || spot.blinds.length !== 2 || spot.blinds.some(b => !(b > 0)))
    add('blinds должны быть [SB, BB] > 0');
  if (!(spot.ante >= 0)) add('ante не может быть отрицательным');

  if (!(spot.pot > 0)) add(`pot ${spot.pot} не положительный`);
  else if (spot.pot < 1.5) warn(`pot ${spot.pot} меньше размера банка от блайндов 1.5`);

  if (!spot.position || !POSITIONS[spot.position]) add(`position "${spot.position}" не известна`);
  if (!spot.villain || !POSITIONS[spot.villain]) add(`villain "${spot.villain}" не известна`);

  if (typeof spot.question !== 'string' || !spot.question.trim()) add('Нет вопроса');
  if (!Array.isArray(spot.options) || spot.options.length < 2) add('Нужно минимум 2 варианта ответа');
  else if (!spot.options.includes(spot.correct)) add(`правильный ответ "${spot.correct}" не среди вариантов`);

  if (!spot.concept || typeof spot.concept !== 'string' || !spot.concept.trim()) add('Нет концепта');
  if (typeof spot.explain !== 'string' || !spot.explain.trim()) add('Нет объяснения');

  if (!Array.isArray(spot.history)) add('history должен быть массивом');

  if (spot.opp) {
    if (typeof spot.opp.vpip !== 'number' || typeof spot.opp.pfr !== 'number')
      add('opp: нужны vpip и pfr числами');
    if (spot.opp.vpip < spot.opp.pfr) warn('opp: vpip меньше pfr — подозрительно');
  }

  return { errors, warn };
}

export function validateLibrary(list) {
  const seen = new Set();
  const errors = [];
  const warns = [];
  let count = 0;
  for (const s of list) {
    count++;
    if (!s || !s.id) { errors.push(`[${count}] нет id`); continue; }
    if (seen.has(s.id)) errors.push(`Дубль id "${s.id}"`);
    seen.add(s.id);
    const r = validateTask(s);
    r.errors.forEach(e => errors.push(`[${s.id}] ${e}`));
    r.warn.forEach(w => warns.push(`[${s.id}] ${w}`));
  }
  if (seen.size < list.length) errors.push(`Повторяющихся id: ${list.length - seen.size}`);
  return { count, unique: seen.size, errors, warns, ok: errors.length === 0 };
}

export function summary(library) {
  const by = (key) => {
    const m = {};
    for (const s of library) m[s[key]] = (m[s[key]] || 0) + 1;
    return m;
  };
  return {
    total: library.length,
    street: by('street'),
    format: by('format'),
    stage: by('stage'),
    table: by('table'),
    position: by('position'),
    difficulty: by('difficulty'),
    concept: by('concept')
  };
}