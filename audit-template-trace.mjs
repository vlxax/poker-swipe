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

  await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

  console.log('\n=== TEMPLATE RENDERING TRACE ===\n');

  // Test hand() and board() functions
  const trace = await page.evaluate(() => {
    const m = {
      functions_exist: {},
      sizing_data: {},
      template_output: {}
    };

    // Check if functions exist
    m.functions_exist.hand_typeof = typeof hand;
    m.functions_exist.board_typeof = typeof board;
    m.functions_exist.card_typeof = typeof card;
    m.functions_exist.quickBanner_typeof = typeof quickBanner;
    m.functions_exist.refBadge_typeof = typeof refBadge;

    // Get first SIZING spot
    if (typeof SIZING !== 'undefined' && SIZING.length > 0) {
      const s = SIZING[0];
      m.sizing_data = {
        id: s.id,
        street: s.street,
        hero: s.hero,
        board: s.board,
        ctx: s.ctx,
        pot: s.pot
      };

      // Test function outputs
      if (typeof hand === 'function') {
        m.template_output.hand_result = hand(s.hero);
        m.template_output.hand_result_length = hand(s.hero).length;
        m.template_output.hand_result_empty = hand(s.hero).trim() === '';
      }

      if (typeof board === 'function') {
        m.template_output.board_result = board(s.board);
        m.template_output.board_result_length = board(s.board).length;
        m.template_output.board_result_empty = board(s.board).trim() === '';
      }

      // Build the FULL template as renderSizing does
      try {
        const quickBannerOutput = typeof quickBanner === 'function' ? quickBanner('sizing') : '';
        const refBadgeOutput = typeof refBadge === 'function' ? refBadge() : '';

        const fullTemplate = `${quickBannerOutput}<div class="panel">${refBadgeOutput}<span class="ey">${s.street} · ЛАБОРАТОРИЯ РАЗМЕРА</span><h1 class="impact">НЕ УГАДАЙ.<br><span class="pink">ПОСТРОЙ СТАВКУ.</span></h1><p class="mut">${s.ctx}</p><div class="table">${board(s.board)}<div class="pot"><span class="ey">БАНК</span><b>${s.pot} BB</b></div><div class="stack" id="sizeStack"></div></div>${hand(s.hero)}<div class="sizeRead"><div><span class="ey">ТВОЁ РЕШЕНИЕ</span><b id="sizePct">50%</b></div><strong id="sizeBB">${(s.pot*.5).toFixed(1)} BB</strong></div><input class="range" id="sizeRange" type="range" min="0" max="150" value="50"><div class="scale"><span>CHECK</span><span>25</span><span>50</span><span>75</span><span>100</span><span>150</span></div><div class="goalPills"><span class="goalPill on">${s.goal}</span></div><button class="primary" id="sizeLock">ПОСТАВИТЬ 50% →</button><div id="sizeResult"></div></div>`;

        m.template_output.full_template = fullTemplate;
        m.template_output.full_template_length = fullTemplate.length;

        // Check if hero cards HTML is in the template
        const handResult = hand(s.hero);
        m.template_output.hand_html_in_template = fullTemplate.includes(handResult);
        m.template_output.holeCards_div_in_template = fullTemplate.includes('class="cards holeCards"');
        m.template_output.hero_suit_symbols_in_template = fullTemplate.includes('♥');

        // Extract the piece with hero cards
        const handIndex = fullTemplate.indexOf(handResult);
        if (handIndex >= 0) {
          m.template_output.hand_context_before = fullTemplate.substring(Math.max(0, handIndex - 50), handIndex);
          m.template_output.hand_context_after = fullTemplate.substring(handIndex, Math.min(fullTemplate.length, handIndex + 150));
        }
      } catch (e) {
        m.template_output.template_error = e.message;
      }
    }

    return m;
  });

  console.log(JSON.stringify(trace, null, 2));

  // Now actually call renderSizing and inspect the result
  console.log('\n=== DOM INSPECTION AFTER renderSizing() CALL ===\n');

  await page.evaluate(() => {
    if (typeof window.show === 'function') {
      window.show('sizing');
    }
  });

  await page.waitForTimeout(500);

  const domState = await page.evaluate(() => {
    const m = {
      sizingArea_innerHTML_length: $('#sizingArea').innerHTML.length,
      sizingArea_innerHTML_sample: $('#sizingArea').innerHTML.substring(0, 300),
      holeCards_count: document.querySelectorAll('.cards.holeCards').length,
      holeCards_exist: document.querySelectorAll('.cards.holeCards').length > 0,
      card_elements: document.querySelectorAll('.pc').length,
      sizeRead_elements: document.querySelectorAll('.sizeRead').length,
      scale_elements: document.querySelectorAll('.scale').length
    };

    // Find holeCards if they exist
    const holeCards = document.querySelector('.cards.holeCards');
    if (holeCards) {
      m.holeCards_element = {
        display: window.getComputedStyle(holeCards).display,
        visibility: window.getComputedStyle(holeCards).visibility,
        html: holeCards.innerHTML,
        text: holeCards.textContent,
        parentClass: holeCards.parentElement?.className
      };
    }

    // Check sizeRead
    const sizeRead = document.querySelector('.sizeRead');
    if (sizeRead) {
      m.sizeRead_element = {
        display: window.getComputedStyle(sizeRead).display,
        visibility: window.getComputedStyle(sizeRead).visibility,
        html: sizeRead.innerHTML.substring(0, 100)
      };
    } else {
      m.sizeRead_not_found = true;
    }

    return m;
  });

  console.log(JSON.stringify(domState, null, 2));

  const filename = '/tmp/claude-0/-home-user-poker-swipe/1f63b7bc-0693-5bf7-9188-d77e639a37f3/scratchpad/template-trace.json';
  fs.writeFileSync(filename, JSON.stringify({ trace, domState }, null, 2));
  console.log(`\n✅ Trace saved to ${filename}`);

  await context.close();
  await browser.close();
}

await main();
