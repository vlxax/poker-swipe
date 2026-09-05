// Trainer range browser controller — uses central trainer knowledge API.

import { getCatalog, sanitizeSelection, isSelectionComplete, nextCtaLabel, situationLabel } from './catalog.js';
import { matrixClasses } from './matrix.js';
import {
  ensureTrainerLookup,
  buildTrainerMatrixAsync,
  handDetailFromTrainerAsync,
  TRAINER_DISCLAIMER,
  TRAINER_USER_LABEL
} from './trainerRanges.js';
import { MATCH_STATUS } from '../trainer-knowledge/status.js';

const DEFAULT_SEL = {
  dataSource: 'trainer',
  format: 'trainer',
  position: null,
  situation: 'uo_open',
  stack: null,
  stackBand: null,
  opener: null,
  trainerSourceMode: 'uo',
  trainerSpot: null,
  betSize: null
};

export class TrainerBrowserController {
  constructor({ pack = null, storage = null } = {}) {
    this.pack = pack;
    this.storage = storage;
    this.phase = 'selector';
    this.selection = { ...DEFAULT_SEL };
    this.catalog = null;
    this.matrixResult = null;
    this.selectedHand = null;
    this.handDetail = null;
    this.loadError = null;
    this.loading = false;
  }

  async _ensureCatalog() {
    const lookup = await ensureTrainerLookup();
    this.catalog = getCatalog(this.pack, 'trainer', 'trainer', lookup.charts);
    return this.catalog;
  }

  viewModel() {
    if (this.phase === 'selector') return this._selectorVm();
    if (this.phase === 'matrix') return this._matrixVm();
    if (this.phase === 'hand') return this._handVm();
    if (this.phase === 'loading') return { phase: 'loading', title: 'РЕНДЖИ', message: 'Загрузка тренерской базы…' };
    if (this.phase === 'error') {
      return { phase: 'error', title: 'РЕНДЖИ', message: this.loadError || 'Ошибка загрузки' };
    }
    return this._selectorVm();
  }

  _selectorVm() {
    const cat = this.catalog;
    const sel = this.selection;
    const situations = cat?.situations || [];
    const sit = situations.find((s) => s.id === sel.situation);

    let stacks = [];
    if (sel.trainerSourceMode === 'uo' && cat?.uoStacks) stacks = cat.uoStacks;
    else if (cat?.modeInventory?.[sel.trainerSourceMode]?.stacks) {
      stacks = cat.modeInventory[sel.trainerSourceMode].stacks.slice(0, 40);
    }

    let positions = cat?.positions || [];
    if (sel.trainerSourceMode === 'uo') positions = cat?.uoPositions || positions;

    let spots = [];
    if (cat?.modeInventory?.[sel.trainerSourceMode]?.spots) {
      spots = cat.modeInventory[sel.trainerSourceMode].spots.filter(Boolean);
    }

    return {
      phase: 'selector',
      title: 'РЕНДЖИ',
      subtitle: TRAINER_USER_LABEL,
      disclaimer: TRAINER_DISCLAIMER,
      dataSource: 'trainer',
      selection: sel,
      situations,
      positions,
      stacks,
      spots,
      situationLabel: situationLabel(sel.situation, 'trainer'),
      showStack: stacks.length > 0,
      showSpot: spots.length > 1 && sel.trainerSourceMode !== 'uo',
      showOpponent: ['vssqueeze', 'vs1r', 'vs3bet', 'vs4bet', 'sbvsbb'].includes(sel.trainerSourceMode),
      cta: nextCtaLabel(sel, cat || { dataSource: 'trainer' }),
      complete: cat ? isSelectionComplete(sel, cat) : false
    };
  }

  _matrixVm() {
    const m = this.matrixResult || {};
    const cells = Object.values(m.cells || {});
    const gradable = cells.filter((c) => c.gradingAllowed).length;
    const unknown = cells.filter((c) => c.dataStatus === 'NEEDS_CLARIFICATION').length;
    const unselected = cells.filter((c) => c.trainerActionRaw === 'UNSELECTED').length;

    return {
      phase: 'matrix',
      title: 'РЕНДЖИ',
      subtitle: TRAINER_USER_LABEL,
      selection: this.selection,
      cells: m.cells || {},
      matrixRows: matrixClasses().map((hand) => ({
        hand,
        ...(m.cells?.[hand] || { state: 'dead', candidate: true })
      })),
      matchStatus: m.matchStatus,
      mismatches: m.mismatches || [],
      chartMeta: m.chartMeta || {},
      provenance: m.provenance,
      provenanceDebug: m.provenanceDebug,
      stats: { gradable, unknown, unselected, total: cells.length },
      disclaimer: TRAINER_DISCLAIMER,
      cta: 'НАЗАД К ВЫБОРУ'
    };
  }

  _handVm() {
    return {
      phase: 'hand',
      title: 'РЕНДЖИ',
      hand: this.selectedHand,
      detail: this.handDetail,
      selection: this.selection,
      matrix: this.matrixResult
    };
  }

  async init() {
    this.phase = 'loading';
    try {
      await this._ensureCatalog();
      this.selection = sanitizeSelection(this.selection, this.catalog);
      this.phase = 'selector';
      this.loadError = null;
    } catch (e) {
      this.loadError = e.message;
      this.phase = 'error';
    }
    return this.viewModel();
  }

  setField(field, value) {
    const next = { ...this.selection, [field]: value };
    if (field === 'situation') {
      const sit = this.catalog?.situations?.find((s) => s.id === value);
      if (sit) {
        next.trainerSourceMode = sit.sourceMode || sit.trainerSourceMode;
        next.trainerSpot = sit.rawSpot || null;
        if (sit.heroFixed) next.position = sit.heroFixed;
      }
    }
    if (field === 'stack') next.stackBand = value;
    this.selection = this.catalog ? sanitizeSelection(next, this.catalog) : next;
    return this.viewModel();
  }

  async showRange() {
    if (!isSelectionComplete(this.selection, this.catalog)) return this.viewModel();
    this.loading = true;
    try {
      this.matrixResult = await buildTrainerMatrixAsync(this.selection);
      if (!this.matrixResult.supported) {
        this.loadError = 'Для этой ситуации пока нет готового ренджа.';
        this.phase = 'error';
        this.selectedHand = null;
        this.handDetail = null;
      } else {
        this.phase = 'matrix';
        this.selectedHand = null;
        this.handDetail = null;
      }
    } catch (e) {
      this.loadError = e.message;
      this.phase = 'error';
    }
    this.loading = false;
    return this.viewModel();
  }

  async selectHand(hand) {
    this.selectedHand = hand;
    this.handDetail = await handDetailFromTrainerAsync(this.selection, hand);
    return this.viewModel();
  }

  back() {
    if (this.phase === 'matrix' || this.phase === 'error') {
      this.phase = 'selector';
      return { vm: this.viewModel(), popped: true };
    }
    return { vm: this.viewModel(), navExit: true, popped: true };
  }
}

export { MATCH_STATUS };
