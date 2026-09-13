import { chromium } from 'playwright';
import fs from 'fs';

async function inspectSizing(page, viewportName) {
  console.log(`\n=== SIZING DEEP INSPECTION: ${viewportName} ===`);

  await page.evaluate(() => {
    if (typeof window.show === 'function') {
      window.show('sizing');
    }
  });
  await page.waitForTimeout(800);

  const inspection = await page.evaluate(() => {
    const m = {
      viewport_info: {
        innerWidth: window.innerWidth,
        innerHeight: window.innerHeight,
        scrollY: window.scrollY,
        documentHeight: document.documentElement.scrollHeight
      },
      elements: {},
      execution_proof: {}
    };

    // Check renderSizing function
    m.execution_proof = {
      window_renderSizing_typeof: typeof window.renderSizing,
      window_renderSizingV32_typeof: typeof window.renderSizingV32,
      window_renderSizingV33_typeof: typeof window.renderSizingV33
    };

    // Look for hero card elements
    const selectors = {
      '.table': '.table',
      '.cards': '.cards',
      '.pc': '.pc',
      'hero hand': '[class*="hero"][class*="hand"], .hand.hero, [class*="hero"]',
      'A♥': 'suit-A, [data-card*="A"][data-suit*="heart"], .card-A, [class*="A♥"]',
      'Q♥': 'suit-Q, [data-card*="Q"][data-suit*="heart"], .card-Q, [class*="Q♥"]',
      '.sizeRead': '.sizeRead, [class*="sizeRead"]',
      '.range': '.range, input[type="range"]',
      '.scale': '.scale',
      'button.primary': 'button.primary, [class*="primary"]',
      '.actions': '.actions, [class*="actions"]',
      '.nav': '.nav, [class*="nav"]'
    };

    for (const [name, selector] of Object.entries(selectors)) {
      const el = document.querySelector(selector);
      if (el) {
        const r = el.getBoundingClientRect();
        const cs = window.getComputedStyle(el);

        m.elements[name] = {
          selector: selector,
          tag: el.tagName,
          id: el.id || 'none',
          class: el.className.substring(0, 60),
          visible: el.offsetHeight > 0 && el.offsetWidth > 0,
          rect: {
            top: Math.round(r.top),
            bottom: Math.round(r.bottom),
            left: Math.round(r.left),
            right: Math.round(r.right),
            width: Math.round(r.width),
            height: Math.round(r.height)
          },
          css: {
            display: cs.display,
            visibility: cs.visibility,
            opacity: cs.opacity,
            position: cs.position,
            overflow: cs.overflow,
            zIndex: cs.zIndex
          },
          content: el.textContent.substring(0, 40),
          children: el.children.length
        };
      } else {
        m.elements[name] = { found: false, selector: selector };
      }
    }

    // Deep search for card-like elements
    m.card_search = {
      elements_with_card_in_class: document.querySelectorAll('[class*="card"]').length,
      elements_with_A_in_text: Array.from(document.querySelectorAll('*'))
        .filter(el => el.textContent.includes('A♥') || el.textContent.includes('A♠'))
        .slice(0, 3)
        .map(el => ({
          tag: el.tagName,
          class: el.className.substring(0, 30),
          text: el.textContent.substring(0, 20),
          rect: (() => {
            const r = el.getBoundingClientRect();
            return { top: Math.round(r.top), bottom: Math.round(r.bottom), height: Math.round(r.height) };
          })()
        }))
    };

    // Measure all visible elements in #sizingArea
    const sizingArea = document.querySelector('#sizingArea');
    if (sizingArea) {
      const r = sizingArea.getBoundingClientRect();
      m.sizingArea_rect = {
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        height: Math.round(r.height),
        scrollable: sizingArea.scrollHeight > sizingArea.clientHeight
      };

      // List all children
      m.sizingArea_children = Array.from(sizingArea.querySelectorAll('*'))
        .filter(el => el.offsetHeight > 0)
        .slice(0, 20) // first 20 visible
        .map(el => {
          const rect = el.getBoundingClientRect();
          return {
            tag: el.tagName,
            class: el.className.substring(0, 40),
            text: el.textContent.substring(0, 30),
            top: Math.round(rect.top),
            bottom: Math.round(rect.bottom),
            height: Math.round(rect.height)
          };
        });
    }

    return m;
  });

  return inspection;
}

async function inspectReview(page, viewportName) {
  console.log(`\n=== REVIEW DEEP INSPECTION: ${viewportName} ===`);

  await page.evaluate(() => {
    if (typeof window.show === 'function') {
      window.show('review');
    }
  });
  await page.waitForTimeout(800);

  const inspection = await page.evaluate(() => {
    const m = {
      timeline_nodes: [],
      elements: {},
      overlap_analysis: {}
    };

    // Get all timeline nodes
    const nodes = document.querySelectorAll('.pgPathNode');
    nodes.forEach((node, i) => {
      const r = node.getBoundingClientRect();
      const cs = window.getComputedStyle(node);
      m.timeline_nodes.push({
        index: i,
        text: node.textContent.substring(0, 40),
        rect: {
          top: Math.round(r.top),
          bottom: Math.round(r.bottom),
          height: Math.round(r.height)
        },
        css: {
          position: cs.position,
          top: cs.top,
          zIndex: cs.zIndex,
          display: cs.display
        }
      });
    });

    // Get decision button
    const decisionBtn = document.getElementById('rvNone');
    if (decisionBtn) {
      const r = decisionBtn.getBoundingClientRect();
      const cs = window.getComputedStyle(decisionBtn);
      m.elements.decision_button = {
        rect: {
          top: Math.round(r.top),
          bottom: Math.round(r.bottom),
          height: Math.round(r.height)
        },
        css: {
          position: cs.position,
          zIndex: cs.zIndex
        }
      };
    }

    // Get actions container
    const actions = document.querySelector('.actions');
    if (actions) {
      const r = actions.getBoundingClientRect();
      const cs = window.getComputedStyle(actions);
      m.elements.actions = {
        rect: {
          top: Math.round(r.top),
          bottom: Math.round(r.bottom),
          height: Math.round(r.height)
        },
        css: {
          position: cs.position,
          display: cs.display,
          zIndex: cs.zIndex
        }
      };
    }

    // Get review panel/screen
    const reviewArea = document.querySelector('#reviewArea');
    if (reviewArea) {
      const r = reviewArea.getBoundingClientRect();
      m.elements.review_area = {
        rect: {
          top: Math.round(r.top),
          bottom: Math.round(r.bottom),
          height: Math.round(r.height)
        }
      };
    }

    // Get nav
    const nav = document.querySelector('.nav');
    if (nav) {
      const r = nav.getBoundingClientRect();
      const cs = window.getComputedStyle(nav);
      m.elements.nav = {
        rect: {
          top: Math.round(r.top),
          bottom: Math.round(r.bottom),
          height: Math.round(r.height)
        },
        css: {
          position: cs.position,
          bottom: cs.bottom,
          zIndex: cs.zIndex
        }
      };
    }

    // Calculate final node vs decision button overlap
    if (m.timeline_nodes.length > 0 && m.elements.decision_button) {
      const finalNode = m.timeline_nodes[m.timeline_nodes.length - 1];
      const btn = m.elements.decision_button;

      const topCollide = finalNode.rect.bottom > btn.rect.top && finalNode.rect.top < btn.rect.bottom;
      if (topCollide) {
        const overlapStart = Math.max(finalNode.rect.top, btn.rect.top);
        const overlapEnd = Math.min(finalNode.rect.bottom, btn.rect.bottom);
        m.overlap_analysis.final_node_vs_button = {
          node_rect: finalNode.rect,
          button_rect: btn.rect,
          collision: true,
          overlap_height: overlapEnd - overlapStart,
          overlap_percent: Math.round(((overlapEnd - overlapStart) / finalNode.rect.height) * 100)
        };
      }
    }

    return m;
  });

  return inspection;
}

async function inspectDaily(page, viewportName) {
  console.log(`\n=== DAILY DEEP INSPECTION: ${viewportName} ===`);

  await page.evaluate(() => {
    if (typeof window.show === 'function') {
      window.show('daily');
    }
  });
  await page.waitForTimeout(800);

  const inspection = await page.evaluate(() => {
    const m = {
      parent_page: {},
      iframe_info: {}
    };

    // Parent page elements
    const iframe = document.querySelector('#psHandDayFrame');
    if (iframe) {
      const r = iframe.getBoundingClientRect();
      m.iframe_info = {
        src: iframe.src,
        rect: {
          top: Math.round(r.top),
          bottom: Math.round(r.bottom),
          left: Math.round(r.left),
          right: Math.round(r.right),
          width: Math.round(r.width),
          height: Math.round(r.height)
        },
        visible: r.height > 0
      };
    }

    const dailyArea = document.querySelector('#dailyArea');
    if (dailyArea) {
      const r = dailyArea.getBoundingClientRect();
      m.parent_page.daily_area = {
        rect: {
          top: Math.round(r.top),
          bottom: Math.round(r.bottom),
          height: Math.round(r.height)
        }
      };
    }

    return m;
  });

  // Now try to inspect iframe content
  try {
    const frames = page.frames();
    const dailyFrame = frames.find(f => f.url().includes('hand-of-the-day'));

    if (dailyFrame) {
      const iframeInspection = await dailyFrame.evaluate(() => {
        const m = {
          screens: [],
          elements: {}
        };

        // Get all screen sections
        const screens = document.querySelectorAll('section.screen');
        screens.forEach((screen, i) => {
          m.screens.push({
            index: i,
            class: screen.className,
            active: screen.classList.contains('active'),
            text: screen.textContent.substring(0, 50)
          });
        });

        // Get visible elements
        const visibleElements = document.querySelectorAll('[id]');
        visibleElements.forEach(el => {
          if (el.offsetHeight > 0) {
            const r = el.getBoundingClientRect();
            m.elements[el.id] = {
              tag: el.tagName,
              text: el.textContent.substring(0, 40),
              rect: {
                top: Math.round(r.top),
                bottom: Math.round(r.bottom),
                height: Math.round(r.height)
              }
            };
          }
        });

        return m;
      });

      inspection.iframe_content = iframeInspection;
    }
  } catch (e) {
    inspection.iframe_inspection_error = e.message;
  }

  return inspection;
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath: '/opt/pw-browsers/chromium'
  });

  const VIEWPORTS = [
    { name: 'iPhone 12/13', width: 390, height: 844 },
    { name: 'iPhone X/11 Pro', width: 375, height: 812 },
    { name: 'iPhone 14', width: 393, height: 852 },
    { name: 'iPhone 15 Pro Max', width: 430, height: 932 },
    { name: 'iPhone SE', width: 320, height: 568 }
  ];

  const results = {
    SIZING: {},
    REVIEW: {},
    DAILY: {}
  };

  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1
    });

    const page = await context.newPage();
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });

    results.SIZING[viewport.name] = await inspectSizing(page, viewport.name);
    results.REVIEW[viewport.name] = await inspectReview(page, viewport.name);
    results.DAILY[viewport.name] = await inspectDaily(page, viewport.name);

    await context.close();
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `/tmp/claude-0/-home-user-poker-swipe/1f63b7bc-0693-5bf7-9188-d77e639a37f3/scratchpad/deep-inspection-${timestamp}.json`;
  fs.writeFileSync(filename, JSON.stringify(results, null, 2));
  console.log(`\n✅ Deep inspection complete: ${filename}`);

  await browser.close();
}

await main();
