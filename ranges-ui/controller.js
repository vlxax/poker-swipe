// Range viewer controller — selection state, onboarding, matrix gating.

import { loadOnboarding, saveOnboarding, markHintSeen, completeOnboarding } from './storage.js';
import { getCatalog, isSelectionComplete, sanitizeSelection, situationMeta } from './catalog.js';
import { selectorViewModel, resultViewModel, helpViewModel } from './viewModel.js';

export class RangeController {
  constructor({ pack, storage = null } = {}) {
    this.pack = pack;
    this.storage = storage;
    this.selection = {
      dataSource: 'reference',
      format: '6max',
      situation: null,
      position: null,
      opener: null,
      stack: null,
      pushMode: 'PUSH'
    };
    this.phase = 'selector';
    this.selectedHand = null;
    this.showHelp = false;
    this.onboarding = loadOnboarding(storage);
  }

  _catalog() {
    return getCatalog(this.pack, this.selection.format || '6max', this.selection.dataSource || 'verified');
  }

  _syncSelection() {
    this.selection = sanitizeSelection(this.selection, this._catalog());
  }

  viewModel() {
    this._syncSelection();
    if (this.showHelp) {
      return { ...helpViewModel(this.selection), phase: 'help', overlay: true };
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
    const v = field === 'stack' ? Number(value) : value;
    this.selection = { ...this.selection, [field]: v };

    if (field === 'dataSource') {
      this.selection.format = value === 'reference' ? '6max' : this.selection.format;
      this.selection.position = null;
      this.selection.situation = null;
      this.selection.opener = null;
      this.selection.stack = null;
      this.phase = 'selector';
      this.selectedHand = null;
    }

    if (field === 'format') {
      this.selection.position = null;
      this.selection.situation = null;
      this.selection.opener = null;
      this.selection.stack = null;
      this.phase = 'selector';
      this.selectedHand = null;
    }

    if (field === 'position') {
      this.selection.situation = null;
      this.selection.opener = null;
      this.selection.stack = null;
      this.phase = 'selector';
      this.selectedHand = null;
      if (!this.onboarding.hintsSeen.includes('position')) {
        this.onboarding = markHintSeen(this.storage, 'position');
      }
    }

    if (field === 'situation') {
      this.selection.opener = null;
      this.selection.stack = null;
      this.phase = 'selector';
      this.selectedHand = null;
      const sit = situationMeta(value);
      if (sit && sit.heroFixed) this.selection.position = sit.heroFixed;
      if (!this.onboarding.hintsSeen.includes('situation')) {
        this.onboarding = markHintSeen(this.storage, 'situation');
      }
    }

    if (field === 'opener') {
      this.selection.stack = null;
      this.phase = 'selector';
      this.selectedHand = null;
      if (!this.onboarding.hintsSeen.includes('opener')) {
        this.onboarding = markHintSeen(this.storage, 'opener');
      }
    }

    if (field === 'stack') {
      if (!this.onboarding.hintsSeen.includes('stack')) {
        this.onboarding = markHintSeen(this.storage, 'stack');
      }
    }

    this._syncSelection();
    return this.viewModel();
  }

  showRange() {
    this._syncSelection();
    if (!isSelectionComplete(this.selection)) return this.viewModel();
    this.phase = 'result';
    this.selectedHand = null;
    if (!this.onboarding.completed) {
      this.onboarding = completeOnboarding(this.storage);
    }
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
}
