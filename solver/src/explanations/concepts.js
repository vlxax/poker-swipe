// Structured concept metadata used by the explanation layer.
export const CONCEPTS = {
  range_advantage_and_sizing: {
    key: 'range_advantage_and_sizing',
    name: 'Range advantage and sizing',
    ru: 'Преимущество диапазона и выбор сайзинга'
  },
  pot_odds: {
    key: 'pot_odds',
    name: 'Pot odds and required equity',
    ru: 'Шансы банка и необходимое эквити'
  },
  fold_equity: {
    key: 'fold_equity',
    name: 'Fold equity',
    ru: 'Фолд-эквити'
  },
  dry_board_sizing: {
    key: 'dry_board_sizing',
    name: 'Dry board sizing',
    ru: 'Сайзинг на сухой доске'
  },
  draw_realization: {
    key: 'draw_realization',
    name: 'Equity realization of draws',
    ru: 'Реализация эквити дро'
  }
};

export function conceptFor(key) {
  return CONCEPTS[key] || { key, name: key, ru: key };
}