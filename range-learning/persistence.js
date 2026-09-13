/**
 * User-scoped persistence for Mistake Memory.
 *
 * Survives PWA / browser restart via localStorage (same as Battleship /
 * trainingStore). Scoped by auth user id, then device id, then anonymous.
 * Logout switches the in-memory store so users cannot read each other.
 *
 * Schema: { schemaVersion, storeSchema: 1, userId, savedAt, payload }
 * payload is MemoryStore.toJSON(). migrateMemoryState runs on load.
 *
 * Historical Battleship/narrowing progress is NOT backfilled: those records
 * lack trustworthy per-hand classification, timestamps, and frequency targets.
 */

import { MemoryStore, migrateMemoryState, processAttempts } from '../mistake-memory/memoryStore.js';
import { SCHEMA_VERSION } from '../mistake-memory/memoryState.js';

export const STORE_SCHEMA = 1;
export const STORAGE_PREFIX = 'pokerSwipe_mistakeMemory_v1';
export const ANONYMOUS_USER = 'anonymous';

export function resolveLearnerUserId({ storage = null, auth = null } = {}) {
  try {
    if (auth && typeof auth.getUser === 'function') {
      const u = auth.getUser();
      if (u?.id) return `auth:${u.id}`;
    }
  } catch (_) { /* ignore */ }

  const st = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  if (st) {
    try {
      const sessionRaw = st.getItem('pokerswipe_auth_session');
      if (sessionRaw) {
        const session = JSON.parse(sessionRaw);
        if (session?.user?.id) return `auth:${session.user.id}`;
      }
    } catch (_) { /* ignore */ }
    try {
      const device = st.getItem('pokerSwipeDeviceId');
      if (device) return `device:${device}`;
    } catch (_) { /* ignore */ }
  }
  return ANONYMOUS_USER;
}

export function storageKeyForUser(userId) {
  return `${STORAGE_PREFIX}:${userId || ANONYMOUS_USER}`;
}

export function createMemoryStorage(map = new Map()) {
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
    _map: map
  };
}

export class PersistentLearnerMemory {
  constructor({ storage = null, auth = null, now = () => Date.now() } = {}) {
    this.storage = storage || (typeof localStorage !== 'undefined' ? localStorage : createMemoryStorage());
    this.auth = auth || (typeof window !== 'undefined' ? window.PokerSwipeAuth : null);
    this.now = now;
    this.store = new MemoryStore();
    this.userId = resolveLearnerUserId({ storage: this.storage, auth: this.auth });
    this._loaded = false;
    this._bindAuthEvents();
  }

  _bindAuthEvents() {
    if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') return;
    if (this._authBound) return;
    this._authBound = true;
    window.addEventListener('pokerswipe-auth-changed', () => {
      try { this.switchUserIfNeeded(); } catch (_) { /* ignore */ }
    });
  }

  key() {
    return storageKeyForUser(this.userId);
  }

  load() {
    this.userId = resolveLearnerUserId({ storage: this.storage, auth: this.auth });
    this.store = new MemoryStore();
    const raw = this.storage.getItem(this.key());
    if (!raw) {
      this._loaded = true;
      return this;
    }
    try {
      const parsed = JSON.parse(raw);
      const payload = parsed?.payload || parsed;
      if (payload?.items) {
        for (const [id, state] of Object.entries(payload.items)) {
          this.store.set(id, migrateMemoryState(state));
        }
      }
    } catch (_) {
      try { this.storage.removeItem(this.key()); } catch (e) { /* ignore */ }
    }
    this._loaded = true;
    return this;
  }

  ensureLoaded() {
    if (!this._loaded) this.load();
    return this;
  }

  save() {
    this.ensureLoaded();
    const envelope = {
      schemaVersion: SCHEMA_VERSION,
      storeSchema: STORE_SCHEMA,
      userId: this.userId,
      savedAt: this.now(),
      payload: this.store.toJSON()
    };
    try {
      this.storage.setItem(this.key(), JSON.stringify(envelope));
      return true;
    } catch (_) {
      return false;
    }
  }

  switchUserIfNeeded() {
    const next = resolveLearnerUserId({ storage: this.storage, auth: this.auth });
    if (next !== this.userId) {
      this.save();
      this.userId = next;
      this._loaded = false;
      this.load();
    }
    return this.userId;
  }

  /**
   * Logout isolation: persist current user, then load the post-logout scope.
   */
  onLogout() {
    this.save();
    this.userId = ANONYMOUS_USER;
    this._loaded = false;
    this.load();
  }

  recordAttempts(attempts, options = {}) {
    this.ensureLoaded();
    this.switchUserIfNeeded();
    const result = processAttempts(this.store, attempts, options);
    this.save();
    return result;
  }

  get(itemId) {
    this.ensureLoaded();
    return this.store.get(itemId);
  }

  allStates() {
    this.ensureLoaded();
    return this.store.allStates();
  }
}

let _singleton = null;

export function getLearnerMemory(options = {}) {
  if (options.fresh || options.storage) {
    const mem = new PersistentLearnerMemory(options);
    mem.load();
    if (!options.storage) _singleton = mem;
    return mem;
  }
  if (!_singleton) {
    _singleton = new PersistentLearnerMemory(options);
    _singleton.load();
  }
  return _singleton;
}

export function resetLearnerMemorySingleton() {
  _singleton = null;
}
