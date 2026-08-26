// PokerSwipe Supabase Auth Module
// Email magic-link & OTP auth with profile sync

window.PokerSwipeAuth = (() => {
  const cfg = window.PokerSwipeSupabase;
  let sessionToken = null;
  let sessionUser = null;
  let authState = 'INITIALIZING'; // INITIALIZING, UNAUTHENTICATED, AUTHENTICATED, LOADING_PROFILE

  const log = (msg, data) => {
    if (window.DEBUG_AUTH) console.log('[PokerSwipeAuth]', msg, data || '');
  };

  // Session storage helpers
  const getSession = () => {
    try {
      const raw = localStorage.getItem('pokerswipe_auth_session');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  };

  const setSession = (token, user, expiresAt, refreshToken) => {
    const session = {
      access_token: token,
      refresh_token: refreshToken,
      user,
      expires_at: Math.floor(new Date(expiresAt).getTime() / 1000),
      expires_in: 3600,
      token_type: 'Bearer',
      savedAt: Date.now()
    };
    localStorage.setItem('pokerswipe_auth_session', JSON.stringify(session));
    sessionToken = token;
    sessionUser = user;
    log('Session saved', { uid: user?.id, email: user?.email });
  };

  const clearSession = () => {
    localStorage.removeItem('pokerswipe_auth_session');
    sessionToken = null;
    sessionUser = null;
    log('Session cleared');
  };

  // Refresh access token using refresh_token
  const refreshAccessToken = async (refreshToken) => {
    if (!refreshToken) return null;
    log('Attempting token refresh');
    try {
      const result = await supabaseCall('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        authenticated: false,
        body: JSON.stringify({ refresh_token: refreshToken })
      });

      if (result?.access_token) {
        const newSession = { ...getSession() };
        newSession.access_token = result.access_token;
        if (result.expires_in) newSession.expires_in = result.expires_in;
        if (result.expires_at) newSession.expires_at = result.expires_at;
        localStorage.setItem('pokerswipe_auth_session', JSON.stringify(newSession));
        sessionToken = result.access_token;
        log('Token refreshed successfully');
        return result.access_token;
      }
    } catch (e) {
      log('Token refresh failed:', e);
    }
    return null;
  };

  // Supabase API calls
  const supabaseCall = async (endpoint, options = {}) => {
    const headers = {
      'Content-Type': 'application/json',
      'apikey': cfg.publishableKey,
      ...options.headers
    };

    if (sessionToken && options.authenticated !== false) {
      headers['Authorization'] = `Bearer ${sessionToken}`;
    }

    const url = endpoint.startsWith('http') ? endpoint : cfg.url + endpoint;
    const response = await fetch(url, {
      ...options,
      headers
    });

    if (!response.ok && response.status !== 409) {
      // 409 = user exists (expected for signup with existing email)
      const error = await response.text();
      throw new Error(`Supabase ${response.status}: ${error.slice(0, 100)}`);
    }

    if (response.status === 204) return null;
    return response.json();
  };

  // Send OTP to email (requires Supabase email template with {{ .Token }})
  const sendMagicLink = async (email) => {
    log('Sending OTP to', email);
    try {
      const result = await supabaseCall('/auth/v1/otp', {
        method: 'POST',
        authenticated: false,
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          data: {},
          create_user: true
        })
      });
      log('OTP sent', result);
      return { ok: true, method: 'otp' };
    } catch (e) {
      console.error('[PokerSwipeAuth] OTP send error:', e);
      throw e;
    }
  };

  // Verify 6-digit OTP code from email
  // Note: Requires Supabase email template with {{ .Token }} variable
  // If project uses magic-link ({{ .ConfirmationURL }}), this flow will not work
  const verifyOTP = async (email, otp) => {
    log('Verifying OTP for', email);
    try {
      const result = await supabaseCall('/auth/v1/verify', {
        method: 'POST',
        authenticated: false,
        body: JSON.stringify({
          type: 'otp',
          email: email.toLowerCase().trim(),
          token: otp
        })
      });

      if (result?.session?.access_token && result?.user) {
        setSession(
          result.session.access_token,
          result.user,
          result.session.expires_at,
          result.session.refresh_token
        );
        return { ok: true, user: result.user, session: result.session };
      }
      throw new Error('No session in response');
    } catch (e) {
      console.error('[PokerSwipeAuth] OTP verification error:', e);
      throw e;
    }
  };

  // Get current session from localStorage with auto-refresh
  const getCurrentSession = async () => {
    const stored = getSession();
    if (!stored) return null;

    // Check if token needs refresh (check 5 min before expiry)
    const expiresAt = (stored.expires_at || stored.expiresAt) * 1000;
    const nowMs = Date.now();
    const refreshWindow = 5 * 60 * 1000; // 5 minutes before expiry

    if (nowMs > expiresAt) {
      // Token expired, try refresh
      if (stored.refresh_token) {
        const newToken = await refreshAccessToken(stored.refresh_token);
        if (!newToken) {
          clearSession();
          return null;
        }
        sessionToken = newToken;
        sessionUser = stored.user;
        return getSession();
      }
      // No refresh token, session is expired
      clearSession();
      return null;
    }

    // Token valid, but check if refresh is needed proactively
    if (nowMs > expiresAt - refreshWindow && stored.refresh_token) {
      await refreshAccessToken(stored.refresh_token);
    }

    sessionToken = stored.access_token || stored.token;
    sessionUser = stored.user;
    return stored;
  };

  // Load profile from public.profiles (created by DB trigger on auth.users insert)
  const loadProfile = async (uid) => {
    if (!sessionToken || !uid) return null;

    log('Loading profile for uid', uid);
    let retries = 5;
    while (retries > 0) {
      try {
        const result = await supabaseCall(
          `${cfg.profilesUrl}?id=eq.${uid}&select=*`,
          { method: 'GET' }
        );

        if (Array.isArray(result) && result.length > 0) {
          log('Profile loaded', result[0]);
          return result[0];
        }

        // Profile not found - DB trigger might be processing, retry with backoff
        retries--;
        if (retries > 0) {
          log('Profile not found, retrying...', retries);
          await new Promise(r => setTimeout(r, Math.pow(2, 5 - retries) * 500)); // 500ms, 1s, 2s, 4s, 8s
        }
      } catch (e) {
        console.error('[PokerSwipeAuth] Profile load error:', e);
        retries--;
        if (retries > 0) {
          await new Promise(r => setTimeout(r, Math.pow(2, 5 - retries) * 500));
        }
      }
    }

    console.error('[PokerSwipeAuth] Profile not found after retries for uid:', uid);
    return null;
  };

  // Update profile after assessment
  const updateProfile = async (updates) => {
    if (!sessionToken || !sessionUser?.id) {
      console.error('[PokerSwipeAuth] Cannot update: not authenticated');
      return false;
    }

    log('Updating profile', updates);
    try {
      const result = await supabaseCall(
        `${cfg.profilesUrl}?id=eq.${sessionUser.id}`,
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

  // Sign out
  const signOut = async () => {
    log('Signing out');
    if (sessionToken) {
      try {
        await supabaseCall('/auth/v1/logout', {
          method: 'POST',
          body: '{}'
        });
      } catch (e) {
        // Ignore logout errors, just clear local session
      }
    }
    clearSession();
  };

  // Boot sequence
  const init = async () => {
    log('Initializing auth system');
    authState = 'INITIALIZING';

    // Check for session
    const session = await getCurrentSession();
    if (!session) {
      authState = 'UNAUTHENTICATED';
      return null;
    }

    authState = 'AUTHENTICATED';

    // Load profile
    authState = 'LOADING_PROFILE';
    const profile = await loadProfile(sessionUser.id);
    authState = 'AUTHENTICATED';

    return { session, user: sessionUser, profile };
  };

  // Migration: detect legacy completed assessment
  const hasLegacyAssessment = () => {
    return window.S && window.S.diagDone === true && window.S.diagnostic && window.S.diagnostic.length > 0;
  };

  // Migrate legacy to profile
  const migrateLegacyAssessment = async (profile) => {
    if (!hasLegacyAssessment()) return false;
    if (profile?.onboarding_completed) return false; // Already migrated

    log('Migrating legacy assessment');
    try {
      const legacy = window.S;
      const skillLevel = (legacy.skill || 50) >= 75 ? 'pro' : (legacy.skill || 50) >= 55 ? 'intermediate' : 'beginner';

      const updateOk = await updateProfile({
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
        migrated_from_local: true,
        initial_assessment: {
          legacy: true,
          results_count: legacy.diagnostic.length,
          skill_level: legacy.skill || 50,
          migrated_at: new Date().toISOString()
        },
        skill: skillLevel
      });

      if (!updateOk) {
        console.error('[PokerSwipeAuth] Migration profile update failed');
        return false;
      }

      log('Migration complete');
      return true;
    } catch (e) {
      console.error('[PokerSwipeAuth] Migration error:', e);
      return false;
    }
  };

  // Public API
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

    getState: () => authState,
    getUser: () => sessionUser,
    getToken: () => sessionToken
  };
})();
