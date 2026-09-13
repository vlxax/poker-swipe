import { chromium } from 'playwright';
import fs from 'fs';

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/opt/pw-browsers/chromium'
  });

  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 1
  });

  const page = await context.newPage();

  // Intercept and log all console messages
  page.on('console', msg => {
    console.log(`[${msg.type()}] ${msg.text()}`);
  });

  // Intercept errors
  page.on('pageerror', err => {
    console.error(`[PAGE ERROR] ${err.message}`);
    console.error(err.stack);
  });

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  // Wait for the key functions to be defined (shorter timeout)
  await page.waitForFunction(() => typeof window.hand === 'function' && typeof window.renderSizing === 'function', { timeout: 3000 }).catch(() => {
    console.log('WARNING: Functions not loaded after 3s, continuing anyway');
  });

  // Extra wait for initial scripts
  await page.waitForTimeout(1000);

  console.log('\n=== RUNTIME DIAGNOSTIC: FUNCTION AVAILABILITY ===\n');

  const evidence = await page.evaluate(() => {
    const m = {
      initial_state: {},
      descriptor_hand: {},
      descriptor_renderSizing: {},
      descriptor_card: {},
      descriptor_board: {},
      before_renderSizing_call: {},
      inside_renderSizing_try: {},
      inside_template_try: {}
    };

    // 1. INITIAL STATE - before any calls
    console.log('=== INITIAL STATE ===');
    m.initial_state = {
      typeof_hand: typeof hand,
      typeof_card: typeof card,
      typeof_board: typeof board,
      typeof_renderSizing: typeof renderSizing,
      typeof_window_renderSizing: typeof window.renderSizing,
      hand_is_function: typeof hand === 'function',
      card_is_function: typeof card === 'function',
      board_is_function: typeof board === 'function',
      renderSizing_is_function: typeof window.renderSizing === 'function'
    };
    Object.entries(m.initial_state).forEach(([k, v]) => {
      console.log(`  ${k}: ${v}`);
    });

    // 2. DESCRIPTOR CHECK
    console.log('\n=== OBJECT DESCRIPTORS ===');
    m.descriptor_hand = Object.getOwnPropertyDescriptor(window, 'hand') || { found: false };
    m.descriptor_renderSizing = Object.getOwnPropertyDescriptor(window, 'renderSizing') || { found: false };
    m.descriptor_card = Object.getOwnPropertyDescriptor(window, 'card') || { found: false };
    m.descriptor_board = Object.getOwnPropertyDescriptor(window, 'board') || { found: false };

    console.log(`  window.hand descriptor: ${JSON.stringify(m.descriptor_hand)}`);
    console.log(`  window.renderSizing descriptor: ${JSON.stringify(m.descriptor_renderSizing)}`);
    console.log(`  window.card descriptor: ${JSON.stringify(m.descriptor_card)}`);
    console.log(`  window.board descriptor: ${JSON.stringify(m.descriptor_board)}`);

    // 3. TEST CALLING hand() and board() directly
    console.log('\n=== DIRECT FUNCTION CALLS ===');
    try {
      const test_hand_result = hand(['A♥', 'Q♥']);
      m.direct_hand_call = {
        success: true,
        length: test_hand_result.length,
        includes_holeCards: test_hand_result.includes('holeCards'),
        includes_A_heart: test_hand_result.includes('A♥'),
        sample: test_hand_result.substring(0, 60)
      };
      console.log(`  hand(['A♥', 'Q♥']) succeeded, length: ${test_hand_result.length}`);
    } catch (e) {
      m.direct_hand_call = { success: false, error: e.message };
      console.log(`  hand(['A♥', 'Q♥']) FAILED: ${e.message}`);
    }

    try {
      const test_board_result = board(['K♦', '7♠', '2♥']);
      m.direct_board_call = {
        success: true,
        length: test_board_result.length,
        includes_dailyBoard: test_board_result.includes('dailyBoard'),
        sample: test_board_result.substring(0, 60)
      };
      console.log(`  board(['K♦', '7♠', '2♥']) succeeded, length: ${test_board_result.length}`);
    } catch (e) {
      m.direct_board_call = { success: false, error: e.message };
      console.log(`  board(['K♦', '7♠', '2♥']) FAILED: ${e.message}`);
    }

    // 4. INTRUMENT renderSizing BEFORE CALLING
    console.log('\n=== INSTRUMENTING renderSizing ===');
    const _original_renderSizing = window.renderSizing;

    window.renderSizing = function() {
      m.inside_renderSizing_try = {
        typeof_hand: typeof hand,
        typeof_card: typeof card,
        typeof_board: typeof board,
        typeof_window_hand: typeof window.hand,
        hand_in_scope: typeof hand !== 'undefined'
      };

      console.log('\n  === INSIDE renderSizing FUNCTION SCOPE ===');
      console.log(`    typeof hand: ${typeof hand}`);
      console.log(`    typeof window.hand: ${typeof window.hand}`);
      console.log(`    typeof card: ${typeof card}`);
      console.log(`    typeof board: ${typeof board}`);

      if (typeof SIZING === 'undefined') {
        console.log('    ERROR: SIZING array not found');
        m.inside_renderSizing_try.SIZING_found = false;
        return;
      }

      const s = SIZING[0];
      console.log(`    SIZING[0] hero: ${JSON.stringify(s.hero)}`);
      console.log(`    SIZING[0] board: ${JSON.stringify(s.board)}`);

      // TRY CALLING hand() AND board() INSIDE
      console.log('\n  === CALLING hand() INSIDE renderSizing ===');
      try {
        const hand_result = hand(s.hero);
        m.inside_renderSizing_try.hand_call_success = true;
        m.inside_renderSizing_try.hand_result_length = hand_result.length;
        m.inside_renderSizing_try.hand_result_sample = hand_result.substring(0, 80);
        console.log(`    hand(s.hero) succeeded, length: ${hand_result.length}`);
      } catch (e) {
        m.inside_renderSizing_try.hand_call_success = false;
        m.inside_renderSizing_try.hand_call_error = e.message;
        m.inside_renderSizing_try.hand_call_stack = e.stack.substring(0, 200);
        console.log(`    hand(s.hero) FAILED: ${e.message}`);
        console.log(`    STACK: ${e.stack.substring(0, 200)}`);
      }

      // TRY TEMPLATE STRING
      console.log('\n  === BUILDING TEMPLATE STRING ===');
      try {
        const quickBannerOutput = typeof quickBanner === 'function' ? quickBanner('sizing') : '';
        const refBadgeOutput = typeof refBadge === 'function' ? refBadge() : '';
        const board_html = board(s.board);
        const hand_html = hand(s.hero);

        const template = `${quickBannerOutput}<div class="panel">${refBadgeOutput}<span class="ey">${s.street}</span><h1>TEST</h1><p>${s.ctx}</p><div class="table">${board_html}<div class="pot">POT</div></div>${hand_html}</div>`;

        m.inside_renderSizing_try.template_success = true;
        m.inside_renderSizing_try.template_length = template.length;
        m.inside_renderSizing_try.template_includes_holeCards = template.includes('holeCards');
        console.log(`    Template built successfully, length: ${template.length}`);
        console.log(`    Template includes 'holeCards': ${template.includes('holeCards')}`);
      } catch (e) {
        m.inside_renderSizing_try.template_success = false;
        m.inside_renderSizing_try.template_error = e.message;
        console.log(`    Template building FAILED: ${e.message}`);
      }

      // CALL ORIGINAL
      console.log('\n  === CALLING ORIGINAL renderSizing ===');
      try {
        _original_renderSizing.call(this, ...arguments);
        m.inside_renderSizing_try.original_call_success = true;
        console.log(`    Original renderSizing call succeeded`);
      } catch (e) {
        m.inside_renderSizing_try.original_call_success = false;
        m.inside_renderSizing_try.original_call_error = e.message;
        console.log(`    Original renderSizing call FAILED: ${e.message}`);
      }
    };

    // 5. CALL show('sizing') which triggers renderSizing
    console.log('\n=== CALLING show("sizing") ===');
    try {
      if (typeof window.show === 'function') {
        window.show('sizing');
        m.show_call_success = true;
        console.log('  show("sizing") executed');
      } else {
        m.show_call_success = false;
        console.log('  show function not found');
      }
    } catch (e) {
      m.show_call_success = false;
      m.show_call_error = e.message;
      console.log(`  show("sizing") FAILED: ${e.message}`);
    }

    return m;
  });

  console.log('\n=== FINAL EVIDENCE OBJECT ===');
  console.log(JSON.stringify(evidence, null, 2));

  // 6. DOM INSPECTION AFTER RENDERING
  console.log('\n\n=== DOM INSPECTION AFTER RENDERING ===');

  await page.waitForTimeout(800);

  const domState = await page.evaluate(() => {
    const m = {
      sizingArea_innerHTML_length: $('#sizingArea')?.innerHTML?.length || 0,
      holeCards_elements: document.querySelectorAll('.cards.holeCards').length,
      pc_elements: document.querySelectorAll('.pc').length,
      sizeRead_elements: document.querySelectorAll('.sizeRead').length,
      panel_elements: document.querySelectorAll('.panel').length,
      heart_symbols: document.querySelectorAll('*'),
      element_with_A_heart: null,
      sizingArea_first_100_chars: ''
    };

    const sizingArea = document.getElementById('sizingArea');
    if (sizingArea && sizingArea.innerHTML) {
      m.sizingArea_first_100_chars = sizingArea.innerHTML.substring(0, 100);

      // Search for A♥ or A♠
      const hasHeartSymbol = sizingArea.innerHTML.includes('A♥') || sizingArea.innerHTML.includes('A♠');
      m.sizingArea_has_card_symbols = hasHeartSymbol;

      // Try to find which element contains them
      if (hasHeartSymbol) {
        const allElements = sizingArea.querySelectorAll('*');
        for (let el of allElements) {
          if (el.textContent.includes('A♥') || el.textContent.includes('A♠')) {
            m.element_with_A_heart = {
              tag: el.tagName,
              class: el.className,
              text: el.textContent.substring(0, 40),
              rect: (() => {
                const r = el.getBoundingClientRect();
                return { top: r.top, bottom: r.bottom, height: r.height };
              })()
            };
            break;
          }
        }
      }
    }

    console.log(`\n  sizingArea length: ${m.sizingArea_innerHTML_length}`);
    console.log(`  .holeCards elements: ${m.holeCards_elements}`);
    console.log(`  .pc elements: ${m.pc_elements}`);
    console.log(`  Card symbols found: ${m.sizingArea_has_card_symbols}`);

    return m;
  });

  console.log('\n=== DOM STATE ===');
  console.log(JSON.stringify(domState, null, 2));

  // Save to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `/tmp/claude-0/-home-user-poker-swipe/1f63b7bc-0693-5bf7-9188-d77e639a37f3/scratchpad/forensic-runtime-${timestamp}.json`;

  fs.writeFileSync(filename, JSON.stringify({
    evidence,
    domState,
    timestamp,
    url: 'http://localhost:8788',
    viewport: { width: 390, height: 844 }
  }, null, 2));

  console.log(`\n✅ Forensic audit saved to ${filename}`);

  await context.close();
  await browser.close();
}

await main();
