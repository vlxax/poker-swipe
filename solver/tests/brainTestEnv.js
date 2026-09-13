// Install production PokerBrain stack on globalThis.window for Node grading tests.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

import { loadPokerBrainPackFromStrategyFile } from '../../trainer-knowledge/conflictDetector.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

let installed = false;

export function installPokerBrainForTests(target = globalThis) {
  if (installed && target.window?.PokerBrain) return target.window.PokerBrain;

  const pack = loadPokerBrainPackFromStrategyFile();
  const win = {
    POKER_BRAIN_PACK: pack,
    console,
    window: null
  };
  win.window = win;
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'poker_brain.js'), 'utf8'), win);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'poker_brain_v33.js'), 'utf8'), win);

  target.window = win;
  installed = true;
  return win.PokerBrain;
}

export function resetPokerBrainTestEnv() {
  installed = false;
  if (globalThis.window) delete globalThis.window;
}
