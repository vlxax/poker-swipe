// PokerSwipe Supabase Auth Module — persistent Safari/PWA session bridge
window.PokerSwipeAuth = (() => {
  'use strict';

  const cfg = window.PokerSwipeSupabase;
  const SESSION_KEY = 'pokerswipe_auth_session';
  const BRIDGE_COOKIE = 'pokerswipe_refresh_bridge';
  const BRIDGE_MAX_AGE_SEC = 60 * 60 * 24 * 180;

  let sessionToken = null;
  let sessionUser = null;
  let authState = 'INITIALIZING';
  let refreshPromise = null;

  const log = (msg, data) => {
    if (window.DEBUG_AUTH) console.log('[PokerSwipeAuth]', msg, data || '');
  };

  const nowSec = () => Math.floor(Date.now() / 1000);

  const getCookiePath = () => {
    let path = window.location.pathname || '/';
    path = path.replace(/index\.html$/i, '');
    if (!path.endsWith('/')) {
      const lastSlash = path.lastIndexOf('/');
      path = lastSlash >= 0 ? path.slice(0, lastSlash + 1) : '/';
    }
    return path || '/';
  };

  const readCookie = (name) => {
    const prefix = `${name}=`;
    const item = String(document.cookie || '')
      .split(';')
      .map(part => part.trim())
      .find(part => part.startsWith(prefix));
    if (!item) return null;
    try {
      return decodeURIComponent(item.slice(prefix.length));
    } catch (_) {
      return null;
    }
  };

  const writeBridgeToken = (refreshToken) => {
    if (!refreshToken) return;
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie =
      `${BRIDGE_COOKIE}=${encodeURIComponent(refreshToken)}` +
      `; Path=${getCookiePath()}` +
      `; Max-Age=${BRIDGE_MAX_AGE_SEC}` +
      '; SameSite=Lax' +
      secure;
  };

  const readBridgeToken = () => readCookie(BRIDGE_COOKIE);

  const clearBridgeToken = () => {
    const secure = window.location.protocol === 'https:' ? '; Secure' : '';
    document.cookie =
      `${BRIDGE_COOKIE}=; Path=${getCookiePath()}; Max-Age=0; SameSite=Lax${secure}`;
  };

  const getSession = () => {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('[PokerSwipeAuth] Broken stored session removed');
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
  };

  const emitAuthChange = (type) => {
    try {
      if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
        window.dispatchEvent(new CustomEvent('pokerswipe-auth-changed', { detail: { type } }));
      }
    } catch (_) { /* ignore */ }
  };

  const clearLocalSession = () => {
    localStorage.removeItem(SESSION_KEY);
    sessionToken = null;
    sessionUser = null;
    emitAuthChange('logout');
  };

  const normalizeExpiresAt = (expiresAt, expiresIn) => {
    const fallbackTtl = Number(expiresIn) > 0 ? Number(expiresIn) : 3600;

    if (typeof expiresAt === 'number' && Number.isFinite(expiresAt)) {
      if (expiresAt > 1e12) return Math.floor(expiresAt / 1000);
      if (expiresAt > 1e9) return Math.floor(expiresAt);
    }

    if (typeof expiresAt === 'string' && expiresAt.trim()) {
      const numeric = Number(expiresAt);
      if (Number.isFinite(numeric)) {
        if (numeric > 1e12) return Math.floor(numeric / 1000);
        if (numeric > 1e9) return Math.floor(numeric);
      }

      const parsedMs = Date.parse(expiresAt);
      if (Number.isFinite(parsedMs)) return Math.floor(parsedMs / 1000);
    }

    return nowSec() + fallbackTtl;
  };

  const saveSessionObject = (session) => {
    if (!session?.access_token || !session?.user?.id) return null;

    const normalized = {
      ...session,
      expires_in: Number(session.expires_in) > 0 ? Number(session.expires_in) : 3600,
      expires_at: normalizeExpiresAt(session.expires_at, session.expires_in),
      token_type: session.token_type || 'Bearer',
      savedAt: Date.now()
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(normalized));
    sessionToken = normalized.access_token;
    sessionUser = normalized.user;

    if (normalized.refresh_token) writeBridgeToken(normalized.refresh_token);
    emitAuthChange('login');
    return normalized;
  };

  const setSession = (token, user, expiresAt, refreshToken, expiresIn) => {
    const session = saveSessionObject({
      access_token: token,
      refresh_token: refreshToken || null,
      user,
      expires_at: expiresAt,
      expires_in: expiresIn || 3600,
      token_type: 'Bearer'
    });

    log('Session saved', {
      uid: session?.user?.id,
      email: session?.user?.email,
      expiresAt: session?.expires_at,
      hasBridge: !!readBridgeToken()
    });

    return session;
  };

  const clearSession = () => {
    clearLocalSession();
    clearBridgeToken();
    log('Session cleared');
  };

  const supabaseCall = async (endpoint, options = {}) => {
    if (!cfg?.url || !cfg?.publishableKey) {
      throw new Error('Supabase config is missing');
    }

    const headers = {
      'Content-Type': 'application/json',
      'apikey': cfg.publishableKey,
      ...options.headers
    };

    if (sessionToken && options.authenticated !== false) {
      headers.Authorization = `Bearer ${sessionToken}`;
    }

    const url = endpoint.startsWith('http') ? endpoint : cfg.url + endpoint;
    const response = await fetch(url, { ...options, headers });

    if (!response.ok && response.status !== 409) {
      let errorText = '';
      try {
        errorText = await response.text();
      } catch (_) {}
      throw new Error(
        `Supabase ${response.status}: ${(errorText || response.statusText || 'request failed').slice(0, 180)}`
      );
    }

    if (response.status === 204) return null;

    const text = await response.text();
    return text ? JSON.parse(text) : {};
  };

  const refreshAccessToken = async (refreshToken) => {
    if (!refreshToken) return null;
    if (refreshPromise) return refreshPromise;

    refreshPromise = (async () => {
      log('Attempting token refresh');

      try {
        const result = await supabaseCall('/auth/v1/token?grant_type=refresh_token', {
          method: 'POST',
          authenticated: false,
          body: JSON.stringify({ refresh_token: refreshToken })
        });

        if (!result?.access_token) return null;

        const oldSession = getSession() || {};
        const user = result.user || oldSession.user || null;
        if (!user?.id) return null;

        const updated = saveSessionObject({
          ...oldSession,
          access_token: result.access_token,
          refresh_token: result.refresh_token || oldSession.refresh_token || refreshToken,
          expires_in: result.expires_in || oldSession.expires_in || 3600,
          expires_at: result.expires_at,
          token_type: result.token_type || oldSession.token_type || 'Bearer',
          user
        });

        log('Token refreshed', {
          hasRotatedRefreshToken: !!result.refresh_token,
          expiresAt: updated?.expires_at
        });

        return updated?.access_token || null;
      } catch (e) {
        log('Token refresh failed', e);
        return null;
      }
    })();

    try {
      return await refreshPromise;
    } finally {
      refreshPromise = null;
    }
  };

  const getRedirectUrl = () => {
    const url = new URL(window.location.href);
    url.search = '';
    url.hash = '';
    url.pathname = url.pathname.replace(/index\.html$/i, '');
    if (!url.pathname.endsWith('/')) url.pathname += '/';
    return url.toString();
  };

  const sendMagicLink = async (email) => {
    const normalizedEmail = String(email || '').toLowerCase().trim();
    if (!normalizedEmail) throw new Error('Email is required');

    const redirectTo = getRedirectUrl();
    log('Sending OTP email', { email: normalizedEmail, redirectTo });

    await supabaseCall(`/auth/v1/otp?redirect_to=${encodeURIComponent(redirectTo)}`, {
      method: 'POST',
      authenticated: false,
      body: JSON.stringify({
        email: normalizedEmail,
        data: {},
        create_user: true
      })
    });

    return { ok: true, method: 'email', redirectTo };
  };

  const verifyOTP = async (email, otp) => {
    const normalizedEmail = String(email || '').toLowerCase().trim();
    const token = String(otp || '').trim();

    const result = await supabaseCall('/auth/v1/verify', {
      method: 'POST',
      authenticated: false,
      body: JSON.stringify({
        type: 'email',
        email: normalizedEmail,
        token
      })
    });

    const source = result?.session?.access_token ? result.session : result;
    const user = result?.user || source?.user || null;

    if (source?.access_token && user?.id) {
      const saved = setSession(
        source.access_token,
        user,
        source.expires_at,
        source.refresh_token,
        source.expires_in
      );
      return { ok: true, user, session: saved };
    }

    throw new Error('No session in OTP response');
  };

  const recoverFromBridgeCookie = async () => {
    const bridgeToken = readBridgeToken();
    if (!bridgeToken) return null;

    log('Trying iOS PWA session bridge');

    const newToken = await refreshAccessToken(bridgeToken);
    if (!newToken) {
      clearBridgeToken();
      clearLocalSession();
      log('PWA bridge rejected; falling back to OTP');
      return null;
    }

    const recovered = getSession();
    if (!recovered?.access_token || !recovered?.user?.id) {
      clearBridgeToken();
      clearLocalSession();
      return null;
    }

    log('PWA session restored from bridge', {
      uid: recovered.user.id,
      email: recovered.user.email
    });

    return recovered;
  };

  const getCurrentSession = async () => {
    let stored = getSession();

    if (!stored?.access_token || !stored?.user?.id) {
      if (stored) clearLocalSession();
      const recovered = await recoverFromBridgeCookie();
      if (recovered) return recovered;
      return null;
    }

    if (stored.refresh_token) writeBridgeToken(stored.refresh_token);

    const normalizedExpiresAt = normalizeExpiresAt(stored.expires_at, stored.expires_in);
    if (stored.expires_at !== normalizedExpiresAt) {
      stored = saveSessionObject({ ...stored, expires_at: normalizedExpiresAt });
    } else {
      sessionToken = stored.access_token;
      sessionUser = stored.user;
    }

    const expiresAtMs = normalizedExpiresAt * 1000;
    const nowMs = Date.now();
    const refreshWindowMs = 5 * 60 * 1000;

    if (nowMs >= expiresAtMs) {
      if (!stored.refresh_token) {
        clearLocalSession();
        const recovered = await recoverFromBridgeCookie();
        if (recovered) return recovered;
        clearSession();
        return null;
      }

      const newToken = await refreshAccessToken(stored.refresh_token);
      if (!newToken) {
        clearSession();
        return null;
      }
      return getSession();
    }

    if (nowMs >= expiresAtMs - refreshWindowMs && stored.refresh_token) {
      const refreshed = await refreshAccessToken(stored.refresh_token);
      if (refreshed) stored = getSession();
    }

    sessionToken = stored.access_token;
    sessionUser = stored.user;
    return stored;
  };

  const loadProfile = async (uid) => {
    if (!uid) return null;

    if (!sessionToken) {
      const stored = getSession();
      if (stored?.access_token) {
        sessionToken = stored.access_token;
        sessionUser = stored.user || sessionUser;
      }
    }

    if (!sessionToken) return null;

    let retries = 5;
    while (retries > 0) {
      try {
        const result = await supabaseCall(
          `${cfg.profilesUrl}?id=eq.${encodeURIComponent(uid)}&select=*`,
          { method: 'GET' }
        );

        if (Array.isArray(result) && result.length > 0) {
          return result[0];
        }
      } catch (e) {
        console.error('[PokerSwipeAuth] Profile load error:', e);
      }

      retries -= 1;
      if (retries > 0) {
        const attempt = 5 - retries;
        await new Promise(resolve =>
          setTimeout(resolve, Math.min(4000, 500 * (2 ** Math.max(0, attempt - 1))))
        );
      }
    }

    console.warn('[PokerSwipeAuth] Profile not found after retries for uid:', uid);
    return null;
  };

  const updateProfile = async (updates) => {
    if (!sessionToken || !sessionUser?.id) return false;

    try {
      await supabaseCall(
        `${cfg.profilesUrl}?id=eq.${encodeURIComponent(sessionUser.id)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            ...updates,
            updated_at: new Date().toISOString()
          })
        }
      );
      return true;
    } catch (e) {
      console.error('[PokerSwipeAuth] Profile update error:', e);
      return false;
    }
  };

  const signOut = async () => {
    if (sessionToken) {
      try {
        await supabaseCall('/auth/v1/logout', {
          method: 'POST',
          body: '{}'
        });
      } catch (_) {}
    }
    clearSession();
  };

  const init = async () => {
    authState = 'INITIALIZING';

    const session = await getCurrentSession();
    if (!session) {
      authState = 'UNAUTHENTICATED';
      return null;
    }

    authState = 'LOADING_PROFILE';
    const profile = await loadProfile(session.user.id);
    authState = 'AUTHENTICATED';

    return {
      session,
      user: session.user,
      profile
    };
  };

  const hasLegacyAssessment = () => {
    return !!(
      window.S &&
      window.S.diagDone === true &&
      Array.isArray(window.S.diagnostic) &&
      window.S.diagnostic.length > 0
    );
  };

  const migrateLegacyAssessment = async (profile) => {
    if (!hasLegacyAssessment()) return false;
    if (profile?.onboarding_completed) return false;

    try {
      const legacy = window.S;
      const numericSkill = Number(legacy.skill || 50);
      const skillLevel =
        numericSkill >= 75 ? 'pro' :
        numericSkill >= 55 ? 'intermediate' :
        'beginner';

      return await updateProfile({
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
        migrated_from_local: true,
        initial_assessment: {
          legacy: true,
          results_count: legacy.diagnostic.length,
          skill_level: numericSkill,
          migrated_at: new Date().toISOString()
        },
        skill: skillLevel
      });
    } catch (e) {
      console.error('[PokerSwipeAuth] Migration error:', e);
      return false;
    }
  };

  return {
    log,
    sendMagicLink,
    verifyOTP,
    getCurrentSession,
    loadProfile,
    updateProfile,
    signOut,
    init,
    hasLegacyAssessment,
    migrateLegacyAssessment,
    getRedirectUrl,
    getState: () => authState,
    getUser: () => sessionUser,
    getToken: () => sessionToken,
    getBridgeState: () => ({
      present: !!readBridgeToken(),
      path: getCookiePath()
    })
  };
})();
