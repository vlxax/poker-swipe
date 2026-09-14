#!/usr/bin/env node
/**
 * STEP 2: Responsive Layout Audit
 * Tests how the app renders on different viewport sizes with current CSS
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import jsdomPkg from 'jsdom';
const {JSDOM, VirtualConsole} = jsdomPkg;

const root = path.resolve('/home/user/poker-swipe');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf-8');

// Test viewports
const viewports = [
  {name: 'iPhone SE', width: 375, height: 667, safe: {top: 20, bottom: 0, left: 0, right: 0}},
  {name: 'iPhone 12/13', width: 390, height: 844, safe: {top: 47, bottom: 34, left: 0, right: 0}},
  {name: 'iPhone 14', width: 393, height: 852, safe: {top: 47, bottom: 34, left: 0, right: 0}},
  {name: 'iPhone X/11 Pro', width: 375, height: 812, safe: {top: 44, bottom: 34, left: 0, right: 0}},
  {name: 'Android HD', width: 360, height: 720, safe: {top: 0, bottom: 0, left: 0, right: 0}},
  {name: 'Android Plus', width: 414, height: 896, safe: {top: 0, bottom: 0, left: 0, right: 0}},
  {name: 'Tablet/Desktop', width: 768, height: 1024, safe: {top: 0, bottom: 0, left: 0, right: 0}},
];

async function testViewport(viewport) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Testing: ${viewport.name} (${viewport.width}x${viewport.height})`);
  console.log(`Safe area: top=${viewport.safe.top}, bottom=${viewport.safe.bottom}`);
  console.log('='.repeat(60));

  const dom = new JSDOM(html, {
    url: 'http://app.local/index.html',
    pretendToBeVisual: true,
    resources: 'usable',
    beforeParse(window) {
      // Mock viewport size
      Object.defineProperty(window, 'innerWidth', {value: viewport.width, configurable: true});
      Object.defineProperty(window, 'innerHeight', {value: viewport.height, configurable: true});
      Object.defineProperty(window, 'outerWidth', {value: viewport.width, configurable: true});
      Object.defineProperty(window, 'outerHeight', {value: viewport.height, configurable: true});

      // Mock safe area insets
      window.CSS = {
        supports: (prop) => {
          if (prop.includes('safe-area-inset')) return true;
          return false;
        }
      };
    }
  });

  const {window} = dom;
  const {document} = window;

  try {
    // Initialize the app state
    window.S = {
      skill: 5,
      nick: 'TEST',
      events: [],
      streak: 3,
      dailyArchive: [],
      courseData: {}
    };

    // Get computed styles
    const nav = document.querySelector('.nav');
    const screen = document.querySelector('.screen');
    const app = document.querySelector('.app');

    if (!nav) {
      console.log('❌ ERROR: .nav not found');
      return;
    }

    const navStyle = window.getComputedStyle(nav);
    const screenStyle = window.getComputedStyle(screen);
    const appStyle = window.getComputedStyle(app);

    console.log('\n📦 Container Metrics:');
    console.log(`  App width: ${appStyle.width} (max-width should be 480px)`);
    console.log(`  App height: ${appStyle.minHeight}`);

    console.log('\n🧭 Navigation Bar:');
    console.log(`  Position: ${navStyle.position}`);
    console.log(`  Z-index: ${navStyle.zIndex}`);
    console.log(`  Width: ${navStyle.width}`);
    console.log(`  Height: ${navStyle.height}`);
    console.log(`  Padding: ${navStyle.paddingTop} ${navStyle.paddingRight} ${navStyle.paddingBottom} ${navStyle.paddingLeft}`);
    console.log(`  Bottom: ${navStyle.bottom}`);

    console.log('\n📄 Screen (content area):');
    if (screen) {
      console.log(`  Display: ${screenStyle.display}`);
      console.log(`  Padding: T=${screenStyle.paddingTop} R=${screenStyle.paddingRight} B=${screenStyle.paddingBottom} L=${screenStyle.paddingLeft}`);

      // Calculate effective heights
      const navHeight = parseFloat(navStyle.height);
      const screenPaddingBottom = parseFloat(screenStyle.paddingBottom);

      console.log(`\n📐 Height Analysis:`);
      console.log(`  Nav rendered height: ${navHeight}px`);
      console.log(`  Screen padding-bottom: ${screenPaddingBottom}px`);

      const expectedNavHeight = 52 + 8 + 8; // content + top padding + bottom padding
      const expectedPaddingBottom = 66; // proper formula
      const actualVsExpected = screenPaddingBottom - expectedPaddingBottom;

      console.log(`  Expected nav height: ~${expectedNavHeight}px`);
      console.log(`  Expected padding-bottom: ${expectedPaddingBottom}px`);
      const status = actualVsExpected > 30 ? '⚠️  EXCESSIVE' : actualVsExpected < 0 ? '❌  TOO SMALL' : '✅  OK';
      console.log(`  Actual vs Expected: ${actualVsExpected > 0 ? '+' : ''}${actualVsExpected}px ${status}`);

      // Check if Home button exists and is visible
      const homeSwipeBtn = document.querySelector('#homeSwipe');
      if (homeSwipeBtn) {
        const btnRect = homeSwipeBtn.getBoundingClientRect();
        const btnStyle = window.getComputedStyle(homeSwipeBtn);
        console.log(`\n🎮 Poker Swipe Button (#homeSwipe):`);
        console.log(`  Display: ${btnStyle.display}`);
        console.log(`  Visibility: ${btnStyle.visibility}`);
        console.log(`  Pointer-events: ${btnStyle.pointerEvents}`);
        console.log(`  Rendered position: x=${btnRect.x}, y=${btnRect.y}`);
        console.log(`  Rendered size: ${btnRect.width}x${btnRect.height}`);
        console.log(`  Bottom edge: ${btnRect.bottom}px (viewport height: ${viewport.height}px)`);

        if (btnRect.bottom > viewport.height) {
          console.log(`  ⚠️  WARNING: Button extends below viewport by ${btnRect.bottom - viewport.height}px`);
        }
        if (btnStyle.pointerEvents === 'none') {
          console.log(`  ❌ ERROR: Pointer events disabled!`);
        }
      }
    } else {
      console.log('⚠️  WARNING: No .screen element found (may need to call renderHome first)');
    }

  } finally {
    dom.window.close();
  }
}

async function main() {
  console.log('\n🔍 STEP 2: RESPONSIVE LAYOUT AUDIT');
  console.log('Testing CSS rendering on different viewport sizes\n');

  for (const viewport of viewports) {
    try {
      await testViewport(viewport);
    } catch (err) {
      console.error(`Error testing ${viewport.name}:`, err.message);
    }
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log('Audit complete. Check for:');
  console.log('  ✓ Screen padding-bottom = ~66px (not 126px)');
  console.log('  ✓ Buttons visible and within viewport');
  console.log('  ✓ Pointer-events: auto on interactive elements');
  console.log('  ✓ Consistent layout across viewport sizes');
  console.log('='.repeat(60));
}

main().catch(console.error);
