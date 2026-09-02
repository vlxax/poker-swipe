// Renderer for Hand of the Day scenario engine
// Renders various node types: hero-decision, villain-action, street-reveal, observation, read-question, reveal

function esc(s) { return typeof window.esc === 'function' ? window.esc(s) : String(s == null ? '' : s); }
function cardHtml(c) { return typeof window.card === 'function' ? window.card(c, true) : `<span class="pc">${esc(c)}</span>`; }

const STREET_NAMES = {
  preflop: 'ПРЕФЛОП',
  flop: 'ФЛОП',
  turn: 'ТЁРН',
  river: 'РЕКА'
};

const positionNames = {
  BTN: 'BTN',
  SB: 'SB',
  BB: 'BB',
  CO: 'CO',
  MP: 'MP',
  UTG: 'UTG'
};

function renderTournamentContext(scenario) {
  const tournament = scenario.tournament || {};
  const hero = scenario.hero || {};
  const villain = scenario.villain || {};

  return `<div class="pgHud">
    <div class="pgHudTitle">
      <h2>${esc(tournament.stage || 'MTT')}</h2>
      <span class="pgHudMore">${esc(tournament.playersRemaining || '?')} / ${esc(tournament.totalPlayers || '?')}</span>
    </div>
    <div class="pgChip">HERO • ${esc(positionNames[hero.position] || hero.position)}</div>
    <div class="pgChip">${esc(hero.stack || '?')} BB</div>
    <div class="pgChip">Villain • ${esc(positionNames[villain.position] || villain.position)}</div>
    <div class="pgChip">${esc(villain.stack || '?')} BB</div>
  </div>`;
}

function renderBoard(board = []) {
  if (!board || board.length === 0) return '';
  return `<div class="pgBoardZone">${board.map(cardHtml).join('')}</div>`;
}

function renderHeroCards(cards = []) {
  if (!cards || cards.length === 0) return '';
  return `<div class="pgHeroZone">${cards.map(cardHtml).join('')}</div>`;
}

function renderFelt(content, street = 'preflop', pot = null) {
  const streetLabel = STREET_NAMES[street] || street;
  const potHtml = pot ? `<div class="pgPot"><span class="pgPotLabel">БАНК</span><b>${esc(pot)}</b></div>` : '';

  return `<div class="pgArena">
    <div class="pgFelt">
      <div style="position: absolute; top: 8px; right: 8px; width: 100%; text-align: right;">
        <div class="pgStreetBadge">${esc(streetLabel)}</div>
      </div>
      <div style="text-align: center; width: 100%;">
        ${content}
        ${potHtml}
      </div>
      <div class="pgSeat hero">HERO</div>
      <div class="pgSeat villain">VILLAIN</div>
    </div>
  </div>`;
}

export function renderHeroDecision(root, node, scenario, engine, handlers = {}) {
  if (!root) return;

  const h = handlers;
  const hero = scenario.hero || {};
  const villain = scenario.villain || {};
  const context = node.context || {};
  const actions = node.actions || [];

  const boardHtml = renderBoard(context.board);
  const heroCardsHtml = renderHeroCards(hero.cards);
  const feltHtml = renderFelt(
    `${boardHtml}${heroCardsHtml}`,
    context.street || 'preflop',
    context.pot
  );

  const actionButtonsHtml = actions.map((action) => {
    return `<button class="pgBubblePress choice" data-action="${esc(action.id)}">${esc(action.label || action.id)}</button>`;
  }).join('');

  root.innerHTML = `<div class="screen">
    ${renderTournamentContext(scenario)}
    ${feltHtml}
    <div class="pgControls">
      <div class="pgPrompt">${esc(context.text || 'Твой ход')}</div>
      <div class="pgDecisionGrid">${actionButtonsHtml}</div>
    </div>
  </div>`;

  // Attach action handlers
  root.querySelectorAll('[data-action]').forEach((btn) => {
    btn.onclick = () => {
      const action = btn.dataset.action;
      if (typeof h.advance === 'function') h.advance(action);
    };
  });
}

export function renderVillainAction(root, node, scenario, engine, handlers = {}) {
  if (!root) return;

  const villain = scenario.villain || {};
  const context = node.context || {};
  const dialogue = node.villainDialogue || context.dialogue || 'Villain acts...';

  const boardHtml = renderBoard(context.board);
  const heroCardsHtml = renderHeroCards(scenario.hero?.cards);

  const feltHtml = renderFelt(
    `${boardHtml}${heroCardsHtml}`,
    context.street || 'preflop',
    context.pot
  );

  root.innerHTML = `<div class="screen">
    ${renderTournamentContext(scenario)}
    ${feltHtml}
    <div class="pgControls">
      <div class="pgPrompt">💬 ${esc(villain.archetype || 'Villain')} говорит:</div>
      <div style="padding: 0 14px; margin: 8px 0; font-style: italic; color: #999;">
        "${esc(dialogue)}"
      </div>
      <button class="pgBubblePress primary" style="width: 100%;" id="continueBtn">ДАЛЕЕ</button>
    </div>
  </div>`;

  const btn = root.querySelector('#continueBtn');
  if (btn && typeof handlers.continue === 'function') {
    btn.onclick = () => handlers.continue();
  }
}

export function renderStreetReveal(root, node, scenario, engine, handlers = {}) {
  if (!root) return;

  const context = node.context || {};
  const boardHtml = renderBoard(context.board);
  const heroCardsHtml = renderHeroCards(scenario.hero?.cards);

  const feltHtml = renderFelt(
    `${boardHtml}${heroCardsHtml}`,
    context.street || 'flop',
    context.pot
  );

  root.innerHTML = `<div class="screen">
    ${renderTournamentContext(scenario)}
    ${feltHtml}
    <div class="pgControls">
      <div class="pgPrompt">${esc(context.text || 'Следующая улица')}</div>
      <button class="pgBubblePress primary" style="width: 100%; margin: 0 14px;" id="continueBtn">ДАЛЕЕ</button>
    </div>
  </div>`;

  const btn = root.querySelector('#continueBtn');
  if (btn && typeof handlers.continue === 'function') {
    btn.onclick = () => handlers.continue();
  }
}

export function renderObservation(root, node, scenario, engine, handlers = {}) {
  if (!root) return;

  const obs = node.observation || {};
  const boardHtml = renderBoard(node.context?.board);
  const heroCardsHtml = renderHeroCards(scenario.hero?.cards);

  const feltHtml = renderFelt(
    `${boardHtml}${heroCardsHtml}`,
    node.context?.street || 'flop',
    node.context?.pot
  );

  root.innerHTML = `<div class="screen">
    ${renderTournamentContext(scenario)}
    ${feltHtml}
    <div class="pgObservation">
      <div class="label">📊 НАБЛЮДЕНИЕ ${esc(obs.count || '?')} / ${esc(obs.totalCount || '?')}</div>
      <div>${esc(obs.text || '')}</div>
    </div>
    <div class="pgControls" style="bottom: 76px;">
      <button class="pgBubblePress primary" style="width: 100%; margin: 0 14px;" id="continueBtn">ПОНЯЛ</button>
    </div>
  </div>`;

  const btn = root.querySelector('#continueBtn');
  if (btn && typeof handlers.continue === 'function') {
    btn.onclick = () => handlers.continue();
  }
}

export function renderReadQuestion(root, node, scenario, engine, handlers = {}) {
  if (!root) return;

  const readQuestion = node.readQuestion || {};
  const choices = readQuestion.choices || [];

  const boardHtml = renderBoard(node.context?.board);
  const heroCardsHtml = renderHeroCards(scenario.hero?.cards);

  const feltHtml = renderFelt(
    `${boardHtml}${heroCardsHtml}`,
    node.context?.street || 'river',
    node.context?.pot
  );

  const choicesHtml = choices.map((choice) => {
    return `<button class="pgReadChoice" data-choice="${esc(choice.id)}">
      <div><span class="emoji">${esc(choice.emoji || '🎯')}</span><span class="label">${esc(choice.label)}</span></div>
      <div class="hint">${esc(choice.hint || '')}</div>
    </button>`;
  }).join('');

  root.innerHTML = `<div class="screen">
    ${renderTournamentContext(scenario)}
    ${feltHtml}
    <div class="pgControls" style="bottom: 76px; padding: 0;">
      <div style="padding: 12px 14px;">
        <div class="pgPrompt">📖 Как ты читаешь линию villain'а?</div>
      </div>
      <div class="pgReadChoices">${choicesHtml}</div>
    </div>
  </div>`;

  // Attach choice handlers
  root.querySelectorAll('[data-choice]').forEach((btn) => {
    btn.onclick = () => {
      const choice = btn.dataset.choice;
      if (typeof handlers.selectRead === 'function') {
        handlers.selectRead(choice);
      }
    };
  });
}

export function renderReveal(root, node, scenario, engine, handlers = {}) {
  if (!root) return;

  const reveal = scenario.reveal || {};
  const villainCards = reveal.villainCards || scenario.villain?.cards || [];
  const userRead = engine.selectedReads[node.id] || '—';
  const correctRead = reveal.correctReadId || '—';
  const correct = userRead === correctRead;

  const boardHtml = renderBoard(node.context?.board || reveal.board);
  const allCardsHtml = `${boardHtml}<div style="margin-top: 20px;"><strong>Villain:</strong> ${villainCards.map(cardHtml).join('')}</div>`;

  const feltHtml = renderFelt(
    allCardsHtml,
    node.context?.street || 'river',
    node.context?.pot
  );

  const verdictClass = correct ? 'verdict-correct' : 'verdict-wrong';
  const verdictText = correct ? '✓ ПРАВИЛЬНО!' : '✗ НЕПРАВИЛЬНО';

  root.innerHTML = `<div class="screen">
    ${renderTournamentContext(scenario)}
    ${feltHtml}
    <div class="pgVerdictCompact" style="margin: 16px 14px 12px;">
      <div class="${verdictClass}">${esc(verdictText)}</div>
      <div style="margin-top: 12px; font-size: 13px;">
        <div><strong>Твой читинг:</strong> ${esc(userRead)}</div>
        <div><strong>Правильный:</strong> ${esc(correctRead)}</div>
      </div>
    </div>
    <div class="pgObservation" style="margin: 12px 14px;">
      <div class="label">💡 КЛЮЧЕВОЙ ВЫВОД</div>
      <div>${esc(reveal.explanation || 'Используй эту информацию в будущем.')}</div>
    </div>
    <div class="pgControls" style="bottom: 76px;">
      <button class="pgBubblePress primary" style="width: 100%; margin: 0 14px;" id="continueBtn">ДАЛЬШЕ</button>
    </div>
  </div>`;

  const btn = root.querySelector('#continueBtn');
  if (btn && typeof handlers.continue === 'function') {
    btn.onclick = () => handlers.continue();
  }
}

export function renderHandOfDayNode(root, node, scenario, engine, handlers = {}) {
  if (!root || !node) return;

  const nodeType = node.type;

  switch (nodeType) {
    case 'hero-decision':
      renderHeroDecision(root, node, scenario, engine, handlers);
      break;
    case 'villain-action':
      renderVillainAction(root, node, scenario, engine, handlers);
      break;
    case 'street-reveal':
      renderStreetReveal(root, node, scenario, engine, handlers);
      break;
    case 'observation':
      renderObservation(root, node, scenario, engine, handlers);
      break;
    case 'read-question':
      renderReadQuestion(root, node, scenario, engine, handlers);
      break;
    case 'reveal':
      renderReveal(root, node, scenario, engine, handlers);
      break;
    case 'showdown':
      renderReveal(root, node, scenario, engine, handlers);
      break;
    default:
      root.innerHTML = `<div class="panel" style="padding: 20px; text-align: center;">
        <p>Unknown node type: ${esc(nodeType)}</p>
      </div>`;
  }
}
