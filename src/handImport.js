/**
 * PokerSwipe Hand Import System
 * Parsers, normalization, and deduplication for poker room hand histories
 */

const HandImportSystem = (() => {
  // ===== NORMALIZED HAND MODEL =====

  function createNormalizedHand(parsed, room) {
    return {
      // Metadata
      sourceRoom: room,
      sourceHandId: parsed.handId || null,
      sourceTimestamp: parsed.timestamp || null,
      importedAt: Date.now(),

      // Game context
      gameType: parsed.gameType || 'NLH',      // NLH, PLO, etc.
      format: parsed.format || 'CASH',          // CASH, MTT
      variant: parsed.variant || null,          // 6-max, heads-up, full-ring, etc.

      // Blinds & antes
      bbSize: parsed.bbSize || null,
      sbSize: parsed.sbSize || null,
      ante: parsed.ante || 0,

      // Positions
      heroPosition: parsed.heroPosition || null,
      heroSeat: parsed.heroSeat || null,
      villainPosition: parsed.villainPosition || null,
      villainSeat: parsed.villainSeat || null,

      // Stacks
      startingStacks: parsed.startingStacks || {},
      effectiveStack: parsed.effStack || parsed.effectiveStack || null,

      // Hand data
      hero: parsed.hero || [],
      villain: parsed.villain || [],
      board: parsed.board || [],

      // Actions
      actions: parsed.actions || [],
      street: parsed.street || 'PREFLOP',

      // Results
      pot: parsed.pot || null,
      rakeAmount: parsed.rake || null,
      result: parsed.result || null,
      heroResult: parsed.heroResult || null,    // Win amount, net
      villainResult: parsed.villainResult || null,

      // Tournament context (if applicable)
      tournamentId: parsed.tournamentId || null,
      tournamentName: parsed.tournamentName || null,
      tableNumber: parsed.tableNumber || null,
      level: parsed.level || null,

      // Source data
      rawHistory: parsed.rawHistory || null,

      // User annotations (from manual review)
      heroReason: parsed.heroReason || '',
      villainRead: parsed.villainRead || '',
      question: parsed.question || '',
      resultNote: parsed.resultNote || '',
      decisionStreet: parsed.decisionStreet || null,
    };
  }

  // ===== POKEROK PARSER =====

  function parsePokerOK(rawText) {
    const text = String(rawText || '').trim();
    if (!text.length) return null;

    const result = {
      handId: null,
      room: 'PokerOK',
      rawHistory: text,
      hero: [],
      villain: [],
      board: [],
      actions: [],
      pot: null,
      effStack: null,
      gameType: 'NLH',
      format: 'CASH',
      result: null,
      heroPosition: null,
      heroSeat: null,
      villainPosition: null,
      villainSeat: null,
      timestamp: null,
      bbSize: null,
      sbSize: null,
      ante: 0,
      tournamentId: null,
    };

    // Extract hand ID
    let m = text.match(/Hand\s*#?(\d+)/i);
    if (m) result.handId = m[1];

    // Extract timestamp
    m = text.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
    if (m) result.timestamp = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`).getTime();

    // Extract game type
    if (/Omaha/i.test(text)) result.gameType = 'PLO';
    if (/5-card/i.test(text)) result.gameType = 'PLO5';

    // Extract format (tournament vs cash)
    if (/Tournament/i.test(text) || /MTT/i.test(text)) {
      result.format = 'MTT';
      m = text.match(/Tournament\s*#?(\d+)/i);
      if (m) result.tournamentId = m[1];
    }

    // Extract blinds
    m = text.match(/Blinds\s+([.\d]+)\s*\/\s*([.\d]+)/i);
    if (m) {
      result.sbSize = parseFloat(m[1]);
      result.bbSize = parseFloat(m[2]);
    }

    // Extract ante if present
    m = text.match(/Ante\s+([.\d]+)/i);
    if (m) result.ante = parseFloat(m[1]);

    // Extract effective stack (from button / hero)
    m = text.match(/(?:Button|Hero|Dealt to)\s+\w+\s+\(([.\d]+)\)/i);
    if (m) result.effStack = parseFloat(m[1]) / (result.bbSize || 1);

    // Extract hero hand
    m = text.match(/(?:Hole|Dealt to)\s+cards?.*?([A-Z2-9][shdc♠♥♦♣])\s+([A-Z2-9][shdc♠♥♦♣])/i);
    if (m) {
      const card1 = normalizeCard(m[1]);
      const card2 = normalizeCard(m[2]);
      if (card1 && card2) result.hero = [card1, card2];
    }

    // Extract board (flop, turn, river)
    m = text.match(/\[([A-Z2-9][shdc♠♥♦♣])\s+([A-Z2-9][shdc♠♥♦♣])\s+([A-Z2-9][shdc♠♥♦♣])(?:\s+([A-Z2-9][shdc♠♥♦♣]))?(?:\s+([A-Z2-9][shdc♠♥♦♣]))?\]/);
    if (m) {
      const cards = [m[1], m[2], m[3], m[4], m[5]].filter(Boolean).map(normalizeCard).filter(Boolean);
      result.board = cards.slice(0, 5);
    }

    // Extract villain's shown hand
    const showdownPattern = /(?:shows?|Показал)\s+\[?([A-Z2-9][shdc♠♥♦♣])\s+([A-Z2-9][shdc♠♥♦♣])\]?/i;
    const showdownMatches = [...text.matchAll(showdownPattern)];
    if (showdownMatches.length > 0) {
      const lastMatch = showdownMatches[showdownMatches.length - 1];
      const card1 = normalizeCard(lastMatch[1]);
      const card2 = normalizeCard(lastMatch[2]);
      if (card1 && card2) result.villain = [card1, card2];
    }

    // Extract result
    if (/wins?\s+the\s+pot/i.test(text) || /выиграл/i.test(text)) {
      result.result = /Hero|Button/.test(text) ? 'HERO_WIN' : 'VILLAIN_WIN';
    } else if (/folds?\s+before/i.test(text) || /фолд/i.test(text)) {
      result.result = 'NO_SHOWDOWN';
    }

    // Extract final pot
    m = text.match(/(?:Final\s+)?[Pp]ot:\s+([.\d]+)/);
    if (m) result.pot = parseFloat(m[1]);

    return result;
  }

  // ===== GGPOKER PARSER (ENHANCED) =====

  function parseGGPoker(rawText) {
    const text = String(rawText || '').trim();
    if (!text.length) return null;

    const result = {
      handId: null,
      room: 'GGPoker',
      rawHistory: text,
      hero: [],
      villain: [],
      board: [],
      actions: [],
      pot: null,
      effStack: null,
      gameType: 'NLH',
      format: 'CASH',
      result: null,
      heroPosition: null,
      heroSeat: null,
      villainPosition: null,
      villainSeat: null,
      timestamp: null,
      bbSize: null,
      sbSize: null,
      ante: 0,
      tournamentId: null,
    };

    // Extract hand ID
    let m = text.match(/Hand\s*#?(\d+)/i);
    if (m) result.handId = m[1];

    // Extract format
    if (/Tournament/i.test(text)) {
      result.format = 'MTT';
      m = text.match(/Tournament\s*#?(\d+)/i);
      if (m) result.tournamentId = m[1];
    }

    // Extract blinds
    m = text.match(/\(([.\d]+)\/([.\d]+)\)/);
    if (m) {
      result.sbSize = parseFloat(m[1]);
      result.bbSize = parseFloat(m[2]);
    }

    // Extract game type
    if (/Omaha/i.test(text)) result.gameType = 'PLO';
    if (/PLO5/i.test(text)) result.gameType = 'PLO5';

    // Extract effective stack
    m = text.match(/Hero.*\(([.\d]+)\)/i);
    if (m) result.effStack = parseFloat(m[1]) / (result.bbSize || 1);

    // Extract hero hand (PokerStars style: "Dealt to Hero [...]")
    m = text.match(/Dealt to\s+([^\[]+)\[([^\]]+)\]/i);
    if (m) {
      const cards = parseCardString(m[2]);
      if (cards.length >= 2) result.hero = cards.slice(0, 2);
    }

    // Extract board
    const boardMatch = text.match(/\*\*\*\s*FLOP\s*\*\*\*\s*\[([^\]]+)\]/);
    if (boardMatch) {
      const flopCards = parseCardString(boardMatch[1]);
      result.board = flopCards;

      const turnMatch = text.match(/\*\*\*\s*TURN\s*\*\*\*[^\[]*\[([^\]]+)\]/);
      if (turnMatch) {
        const turnCard = parseCardString(turnMatch[1]);
        if (turnCard.length > 0) result.board.push(turnCard[turnCard.length - 1]);
      }

      const riverMatch = text.match(/\*\*\*\s*RIVER\s*\*\*\*[^\[]*\[([^\]]+)\]/);
      if (riverMatch) {
        const riverCard = parseCardString(riverMatch[1]);
        if (riverCard.length > 0) result.board.push(riverCard[riverCard.length - 1]);
      }
    }

    // Extract villain hand from showdown
    const showdownMatches = [...text.matchAll(/(?:shows?|showed)\s+\[([^\]]+)\]/ig)];
    if (showdownMatches.length > 0) {
      const lastMatch = showdownMatches[showdownMatches.length - 1];
      const cards = parseCardString(lastMatch[1]);
      if (cards.length >= 2) result.villain = cards.slice(0, 2);
    }

    // Extract result
    if (/wins?\s+the\s+pot/i.test(text)) {
      result.result = /Hero/.test(text) ? 'HERO_WIN' : 'VILLAIN_WIN';
    } else if (/folds?\s+before/i.test(text)) {
      result.result = 'NO_SHOWDOWN';
    }

    // Extract final pot
    m = text.match(/(?:Total\s+)?[Pp]ot:\s+([.\d]+)/);
    if (m) result.pot = parseFloat(m[1]);

    return result;
  }

  // ===== UNIVERSAL TXT PARSER =====

  function parseGenericTxt(rawText) {
    const text = String(rawText || '').trim();
    if (!text.length) return null;

    const result = {
      handId: null,
      room: 'TEXT',
      rawHistory: text,
      hero: [],
      villain: [],
      board: [],
      actions: [],
      pot: null,
      effStack: null,
      gameType: 'NLH',
      format: 'CASH',
      result: null,
      heroPosition: null,
      heroSeat: null,
      villainPosition: null,
      villainSeat: null,
      timestamp: null,
      bbSize: null,
      sbSize: null,
      ante: 0,
      tournamentId: null,
    };

    // Try to find cards in brackets or parentheses
    const cardPattern = /[A-Z2-9][shdc♠♥♦♣]/gi;
    const allMatches = [...text.matchAll(cardPattern)];

    if (allMatches.length >= 2) {
      const normalized = allMatches.slice(0, 7).map(m => normalizeCard(m[0])).filter(Boolean);
      if (normalized.length >= 2) {
        result.hero = normalized.slice(0, 2);
        if (normalized.length >= 4) {
          result.villain = normalized.slice(2, 4);
        }
        if (normalized.length >= 5) {
          result.board = normalized.slice(4);
        }
      }
    }

    // Try to find stack/pot info
    let m = text.match(/([.\d]+)\s*(?:BB|blinds?|stake)/i);
    if (m) result.bbSize = parseFloat(m[1]);

    m = text.match(/stack.*?([.\d]+)/i);
    if (m) result.effStack = parseFloat(m[1]);

    m = text.match(/pot.*?([.\d]+)/i);
    if (m) result.pot = parseFloat(m[1]);

    return result;
  }

  // ===== PARSER REGISTRY =====

  function detectRoom(rawText) {
    const text = String(rawText || '').toLowerCase();
    if (/pokerok/i.test(text)) return 'PokerOK';
    if (/ggpoker|ggnetwork/i.test(text)) return 'GGPoker';
    if (/pokerstars/i.test(text)) return 'PokerStars';
    return 'TEXT';
  }

  function parseHandHistory(rawText, room = null) {
    const detectedRoom = room || detectRoom(rawText);

    let parsed;
    if (detectedRoom === 'PokerOK') {
      parsed = parsePokerOK(rawText);
    } else if (detectedRoom === 'GGPoker' || detectedRoom === 'PokerStars') {
      parsed = parseGGPoker(rawText);
    } else {
      parsed = parseGenericTxt(rawText);
    }

    if (!parsed) return null;

    // Normalize to standard model
    const normalized = createNormalizedHand(parsed, detectedRoom);
    return normalized;
  }

  // ===== DEDUPLICATION =====

  function createHandFingerprint(hand) {
    // Create deterministic hash from game facts
    const parts = [
      hand.sourceRoom,
      hand.sourceHandId || '',
      hand.heroPosition || '',
      hand.hero.sort().join(''),
      hand.board.sort().join(''),
      hand.bbSize,
      hand.effStack,
      Math.round(hand.importedAt / 86400000), // Day-based to avoid time-based variance
    ];
    return parts.filter(Boolean).join('|');
  }

  function isDuplicateHand(newHand, existingHands) {
    const newId = newHand.sourceHandId;
    const newRoom = newHand.sourceRoom;
    const newFingerprint = createHandFingerprint(newHand);

    for (const existing of existingHands) {
      // Exact ID match has priority
      if (newId && existing.sourceHandId === newId && existing.sourceRoom === newRoom) {
        return true;
      }

      // Fingerprint match
      if (createHandFingerprint(existing) === newFingerprint) {
        return true;
      }
    }

    return false;
  }

  // ===== BULK IMPORT =====

  function bulkImportHands(handHistories, existingHands = [], onProgress = null) {
    const results = {
      imported: [],
      duplicates: [],
      invalid: [],
      summary: {
        total: 0,
        imported: 0,
        duplicates: 0,
        invalid: 0,
      }
    };

    const histories = Array.isArray(handHistories) ? handHistories : [handHistories];

    for (let i = 0; i < histories.length; i++) {
      const rawHH = histories[i];

      if (onProgress) {
        onProgress({
          current: i + 1,
          total: histories.length,
          status: `Parsing ${i + 1} / ${histories.length}`
        });
      }

      try {
        const parsed = parseHandHistory(rawHH);

        if (!parsed) {
          results.invalid.push({ raw: rawHH.slice(0, 200), error: 'Could not parse hand history' });
          results.summary.invalid++;
          continue;
        }

        // Validate
        const validation = HandValidation.validateHand(parsed, false);
        if (!validation.valid) {
          results.invalid.push({ raw: rawHH.slice(0, 200), error: validation.error });
          results.summary.invalid++;
          continue;
        }

        // Check for duplicates
        if (isDuplicateHand(parsed, [...existingHands, ...results.imported])) {
          results.duplicates.push(parsed);
          results.summary.duplicates++;
          continue;
        }

        results.imported.push(parsed);
        results.summary.imported++;
      } catch (err) {
        results.invalid.push({ raw: rawHH.slice(0, 200), error: err.message });
        results.summary.invalid++;
      }

      results.summary.total = i + 1;
    }

    return results;
  }

  // ===== PLAYER STATS EXTRACTION =====

  function extractPlayerStats(hands) {
    const stats = {
      handsPlayed: hands.length,
      vpip: 0,
      pfr: 0,
      aggressionFactor: 0,
      winRate: 0,
      roi: 0,
      itm: 0,
      byPosition: {},
      sampleSize: hands.length,
    };

    if (hands.length === 0) return stats;

    // Calculate position-based stats
    const positionStats = {};
    let totalWins = 0;
    let totalProfit = 0;
    let participatedHands = 0;

    for (const hand of hands) {
      const pos = hand.heroPosition || hand.heroSeat;
      if (pos) {
        if (!positionStats[pos]) {
          positionStats[pos] = { count: 0, wins: 0, profit: 0 };
        }
        positionStats[pos].count++;
      }

      // Track participation (any action by hero)
      if (hand.actions && hand.actions.some(a => a.actor === 'HERO' && a.action !== 'FOLD')) {
        participatedHands++;
      }

      // Track results
      if (hand.heroResult !== null && hand.heroResult !== undefined) {
        if (hand.heroResult > 0) {
          totalWins++;
          totalProfit += hand.heroResult;
          if (pos) positionStats[pos].wins++;
        } else {
          totalProfit += hand.heroResult;
        }
      }
    }

    // Calculate aggregate stats
    stats.vpip = participatedHands / hands.length * 100;
    stats.winRate = totalWins / hands.length * 100;
    stats.roi = (totalProfit / (hands.length * stats.bbSize)) * 100 if stats.bbSize else 0;
    stats.byPosition = positionStats;

    return stats;
  }

  // ===== HELPER FUNCTIONS =====

  function normalizeCard(cardStr) {
    if (!cardStr) return null;
    const match = String(cardStr).match(/^([2-9TJQKA])([shdc♠♥♦♣])$/i);
    if (!match) return null;

    const rank = match[1].toUpperCase();
    const suitMap = {
      's': '♠', 'h': '♥', 'd': '♦', 'c': '♣',
      '♠': '♠', '♥': '♥', '♦': '♦', '♣': '♣'
    };
    const suit = suitMap[match[2].toLowerCase()] || match[2];

    return rank + suit;
  }

  function parseCardString(str) {
    const cards = String(str || '')
      .replace(/[\[\],]/g, ' ')
      .split(/\s+/)
      .map(normalizeCard)
      .filter(Boolean);
    return cards;
  }

  // ===== PUBLIC API =====

  return {
    parseHandHistory,
    parsePokerOK,
    parseGGPoker,
    parseGenericTxt,
    detectRoom,
    bulkImportHands,
    extractPlayerStats,
    isDuplicateHand,
    createHandFingerprint,
    createNormalizedHand,
    normalizeCard,
    parseCardString,
  };
})();

// Export for use
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { HandImportSystem };
}
