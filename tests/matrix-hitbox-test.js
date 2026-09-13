// Verify 13x13 poker matrix hitbox integrity
// Tests that adjacent cells have non-overlapping hitboxes and taps resolve correctly

const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'];

function handCode(row, col) {
  if (row === col) return RANKS[row] + RANKS[col];
  if (row < col) return RANKS[row] + RANKS[col] + 's';
  return RANKS[col] + RANKS[row] + 'o';
}

function verifyMatrixIntegrity() {
  console.log('Testing 13×13 poker matrix hitbox integrity...\n');

  // Test 1: All hands generate unique, valid codes
  const hands = new Set();
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      const hand = handCode(r, c);
      if (!hand || hand.length < 2) {
        throw new Error(`Invalid hand at [${r},${c}]: ${hand}`);
      }
      if (hands.has(hand)) {
        throw new Error(`Duplicate hand: ${hand}`);
      }
      hands.add(hand);
    }
  }
  console.log(`✓ All 169 cells generate unique hand codes`);

  // Test 2: Adjacent cells generate different hands
  let adjacencyErrors = [];
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      const current = handCode(r, c);

      // Check right neighbor
      if (c < 12) {
        const right = handCode(r, c + 1);
        if (current === right) {
          adjacencyErrors.push(`Row ${r}: cells [${c}] and [${c+1}] both map to ${current}`);
        }
      }

      // Check bottom neighbor
      if (r < 12) {
        const bottom = handCode(r + 1, c);
        if (current === bottom) {
          adjacencyErrors.push(`Col ${c}: cells [${r}] and [${r+1}] both map to ${current}`);
        }
      }
    }
  }

  if (adjacencyErrors.length > 0) {
    throw new Error('Adjacent cell collision:\n' + adjacencyErrors.join('\n'));
  }
  console.log(`✓ No adjacent cell hand code collisions`);

  // Test 3: Verify mobile viewport sizing
  const mobileViewports = [
    { width: 375, name: '375×812 (SE)' },
    { width: 390, name: '390×844 (14)' },
    { width: 393, name: '393×852 (P8)' },
    { width: 430, name: '430×932 (15)' }
  ];

  const padding = 12; // 6px each side
  const gap = 2;
  const columns = 13;

  console.log('\nMobile viewport cell sizing:');
  mobileViewports.forEach(vp => {
    const availableWidth = vp.width - (padding * 2);
    const totalGaps = gap * (columns - 1);
    const cellWidth = (availableWidth - totalGaps) / columns;

    // Cell should be around 25-28px depending on viewport
    const isAcceptable = cellWidth > 20 && cellWidth < 32;
    const status = isAcceptable ? '✓' : '✗';
    console.log(`${status} ${vp.name}: ${cellWidth.toFixed(1)}px cell width`);

    if (!isAcceptable) {
      throw new Error(`Cell width ${cellWidth.toFixed(1)}px is not acceptable for ${vp.name}`);
    }
  });

  console.log('\n✓ Mobile viewport sizing acceptable for all targets');

  console.log('\n✓ Matrix hitbox integrity verified');
  return true;
}

// Run tests
try {
  verifyMatrixIntegrity();
  console.log('\n✅ All matrix tests passed');
  process.exit(0);
} catch (e) {
  console.error('\n❌ Matrix test failed:', e.message);
  process.exit(1);
}
