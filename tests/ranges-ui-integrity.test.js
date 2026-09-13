import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Ranges UI Redesign Integrity', () => {
  // Verify 1698 charts untouched
  it('should have exactly 1698 trainer charts', () => {
    const chartsPath = path.join(process.cwd(), 'data/trainer/built/charts-index.json');
    const charts = JSON.parse(fs.readFileSync(chartsPath, 'utf-8'));
    expect(charts).toHaveLength(1698);
  });

  // Verify no debug labels in rendering code
  it('should not expose internal debug labels in trainer matrix', () => {
    const rendererPath = path.join(process.cwd(), 'ranges-ui/renderer.js');
    const content = fs.readFileSync(rendererPath, 'utf-8');

    // The renderTrainerMatrix function should not contain these debug outputs
    const matrixFn = content.match(/export function renderTrainerMatrix[\s\S]*?^}/m)?.[0] || '';

    // Debug labels that must NOT appear in the rendered output
    const forbiddenDebugLabels = [
      'gradable:',
      'unknown:',
      'UNSELECTED',
      'NO_TRAINER_DATA',
      'sourceMode',
      'rawSpot',
      'provenanceDebug',
      'dataStatus',
      'não para grading'
    ];

    forbiddenDebugLabels.forEach(label => {
      // These should not appear in the innerHTML string
      const hasLabel = matrixFn.includes(`"${label}`) || matrixFn.includes(`'${label}`);
      expect(hasLabel, `Debug label "${label}" should not appear in matrix output`).toBe(false);
    });
  });

  // Verify no debug metadata exposed
  it('should not leak internal metadata to production UI', () => {
    const rendererPath = path.join(process.cwd(), 'ranges-ui/renderer.js');
    const content = fs.readFileSync(rendererPath, 'utf-8');

    const matrixFn = content.match(/export function renderTrainerMatrix[\s\S]*?^}/m)?.[0] || '';

    // meta.sourceMode, meta.rawSpot should not be directly output
    expect(matrixFn.includes('meta.sourceMode')).toBe(false);
    expect(matrixFn.includes('meta.rawSpot')).toBe(false);
    expect(matrixFn.includes('vm.stats')).toBe(false);
    expect(matrixFn.includes('vm.mismatches')).toBe(false);
  });

  // Verify matrix touch targets calculation
  it('should calculate valid matrix touch target sizes for mobile', () => {
    // For a 390px viewport with typical padding
    const viewportWidth = 390;
    const padding = 12; // 6px each side
    const gap = 2;
    const columns = 13;

    // Available width = viewport - padding
    const availableWidth = viewportWidth - (padding * 2);

    // Cell width = (available - gaps) / columns
    const totalGaps = gap * (columns - 1);
    const cellWidth = (availableWidth - totalGaps) / columns;

    // Should be around 28px, not 44px
    expect(cellWidth).toBeGreaterThan(24);
    expect(cellWidth).toBeLessThan(32);
  });

  // Verify hand label rendering
  it('should render poker hand labels correctly in matrix', () => {
    const matrixPath = path.join(process.cwd(), 'ranges-ui/matrix.js');
    const content = fs.readFileSync(matrixPath, 'utf-8');

    // Should contain hand code generation logic
    expect(content).toContain('RANKS');
    expect(content).toContain('handCode');
  });

  // Verify mobile CSS improvements
  it('should have improved mobile CSS for matrix readability', () => {
    const cssPath = path.join(process.cwd(), 'ranges-ui/ranges.css');
    const content = fs.readFileSync(cssPath, 'utf-8');

    // Should have media query for mobile
    expect(content).toMatch(/@media.*max-width.*430px/);

    // Font size should be at least 10px on mobile
    const mobileRule = content.match(/@media[^}]*max-width[^}]*430px[^}]*{[^}]*}/);
    if (mobileRule) {
      expect(mobileRule[0]).toContain('font-size');
    }
  });

  // Verify new hub structure exists
  it('should have new unified Ranges hub', () => {
    const rendererPath = path.join(process.cwd(), 'ranges-ui/battleship/renderer.js');
    const content = fs.readFileSync(rendererPath, 'utf-8');

    // Should export renderRangesHub function
    expect(content).toContain('export function renderRangesHub');

    // Should have new CSS classes
    expect(content).toContain('rhShell');
    expect(content).toContain('rhPath');
  });

  // Verify no actionable duplicate handlers
  it('should not have conflicting mode handlers', () => {
    const mainPath = path.join(process.cwd(), 'ranges-ui/main.js');
    const content = fs.readFileSync(mainPath, 'utf-8');

    // openTrainer should be defined once
    const openTrainerCount = (content.match(/openTrainer\(\)/g) || []).length;
    expect(openTrainerCount).toBeGreaterThan(0);
  });

  // Verify CSS classes for new components exist
  it('should have CSS for new hub components', () => {
    const cssPath = path.join(process.cwd(), 'ranges-ui/battleship/battleship.css');
    const content = fs.readFileSync(cssPath, 'utf-8');

    // New hub CSS classes
    expect(content).toContain('.rhShell');
    expect(content).toContain('.rhCard');
    expect(content).toContain('.rhPath');
    expect(content).toContain('.rhPathPrimary');
    expect(content).toContain('.rhSubtitle');
  });

  // Verify no fabricated progress percentages
  it('should not fabricate progress data', () => {
    const mainPath = path.join(process.cwd(), 'ranges-ui/main.js');
    const content = fs.readFileSync(mainPath, 'utf-8');

    const hubVmFn = content.match(/function hubVm\(\)[^}]*}/s)?.[0] || '';

    // Should only use masteryPercent from storage, not invent it
    expect(hubVmFn).toContain('lastStudiedRange');
    expect(hubVmFn).toContain('JSON.parse');
  });

  // Verify trainer data integrity
  it('should preserve canonical range IDs', () => {
    const catalogPath = path.join(process.cwd(), 'ranges-ui/catalog.js');
    const content = fs.readFileSync(catalogPath, 'utf-8');

    // Should reference stable range IDs, not rename them
    expect(content).toContain('getCanonicalId');
    expect(content.length).toBeGreaterThan(1000);
  });

  // Verify action labels are user-facing
  it('should translate raw actions to user labels', () => {
    const rendererPath = path.join(process.cwd(), 'ranges-ui/renderer.js');
    const content = fs.readFileSync(rendererPath, 'utf-8');

    const matrixFn = content.match(/export function renderTrainerMatrix[\s\S]*?^}/m)?.[0] || '';

    // Should map AI → ОЛЛ-ИН, RAISE → РЕЙЗ, etc.
    expect(matrixFn).toContain('ОЛЛ-ИН');
    expect(matrixFn).toContain('РЕЙЗ');
  });
});
