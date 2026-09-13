/**
 * Test helpers for Strategy Map
 */

export function createRange(id, handActions, metadata = {}) {
  return {
    id,
    hands: handActions,
    metadata
  };
}

export function createHandActions(distribution) {
  const actions = {};
  for (const [action, freq] of Object.entries(distribution)) {
    actions[action] = freq;
  }
  return { actions };
}

export function createRealisticRange(id, hands, metadata = {}) {
  const handActions = {};
  for (const [hand, distribution] of Object.entries(hands)) {
    handActions[hand] = createHandActions(distribution);
  }
  return createRange(id, handActions, metadata);
}
