// Range viewer controller — selection state, onboarding, matrix gating.

import { loadOnboarding, saveOnboarding, markHintSeen, completeOnboarding } from './storage.js';
import { isSelectionComplete } from './catalog.js';
import { selectorViewModel, resultViewModel, helpViewModel } from './viewModel.js';

export class RangeController {
  constructor({ pack, storage = null } = {}) {
    this.pack = pack;
    this.storage = storage;
    this.selection = {
      format: '6max',
      situation: null,
      position: null,
      opener: null,
      stack: null,
      pushMode: 'PUSH'
    };
    this.phase = 'selector'; // selector | result
    this.selectedHand = null;
    this.showHelp = false;
    this.onboarding = loadOnboarding(storage);
  }

  viewModel() {
    if (this.showHelp) {
      return { ...helpViewModel(), phase: 'help', overlay: true };
    }
    if (this.phase === 'result' && isSelectionComplete(this.selection)) {
      return resultViewModel({
        pack: this.pack,
        selection: this.selection,
        onboarding: this.onboarding,
        selectedHand: this.selectedHand,
        showHelp: false
      });
    }
    return selectorViewModel({
      pack: this.pack,
      selection: this.selection,
      onboarding: this.onboarding,
      showHelp: false
    });
  }

  setField(field, value) {
    this.selection = { ...this.selection, [field]: value };
    if (field === 'situation') {
      this.selection.position = null;
      this.selection.opener = null;
      this.selection.stack = null;
      this.phase = 'selector';
      this.selectedHand = null;
      const sit = this._situationMeta(value);
      if (sit && sit.heroFixed) this.selection.position = sit.heroFixed;
    }
    if (field === 'position') {
      this.selection.opener = null;
      if (this.onboarding.hintsSeen && !this.onboarding.hintsSeen.includes('position')) {
        this.onboarding = markHintSeen(this.storage, 'position');
      }
    }
    if (field === 'stack') {
      if (!this.onboarding.hintsSeen.includes('stack')) {
        this.onboarding = markHintSeen(this.storage, 'stack');
      }
    }
    return this.viewModel();
  }

  showRange() {
    if (!isSelectionComplete(this.selection)) return this.viewModel();
    this.phase = 'result';
    this.selectedHand = null;
    return this.viewModel();
  }

  backToSelector() {
    this.phase = 'selector';
    this.selectedHand = null;
    return this.viewModel();
  }

  selectHand(hand) {
    this.selectedHand = hand;
    if (!this.onboarding.hintsSeen.includes('hand')) {
      this.onboarding = markHintSeen(this.storage, 'hand');
    }
    if (this.onboarding.hintsSeen.length >= 3 && !this.onboarding.completed) {
      this.onboarding = completeOnboarding(this.storage);
    }
    return this.viewModel();
  }

  openHelp() {
    this.showHelp = true;
    return this.viewModel();
  }

  closeHelp() {
    this.showHelp = false;
    return this.viewModel();
  }

  dismissOnboarding() {
    this.onboarding = completeOnboarding(this.storage);
    return this.viewModel();
  }

  resetOnboardingForTest() {
    this.onboarding = { completed: false, hintsSeen: [] };
    saveOnboarding(this.storage, this.onboarding);
  }

  _situationMeta(id) {
    return { rfi: {}, vs_open: {}, vs_3bet: {}, bb_defend: { heroFixed: 'BB' }, push_fold: {} }[id] || null;
  }
}
