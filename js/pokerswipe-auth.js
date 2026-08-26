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

  const setSession = (token, user, expiresAt) => {
    const session = { token, user, expiresAt, savedAt: Date.now() };
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

  // Email authentication
  const sendMagicLink = async (email) => {
    log('Sending magic link to', email);
    try {
      const result = await supabaseCall('/auth/v1/otp', {
        method: 'POST',
        authenticated: false,
        body: JSON.stringify({
          email: email.toLowerCase().trim(),
          data: {}
        })
      });
      log('Magic link sent', result);
      return { ok: true, method: 'otp' };
    } catch (e) {
      console.error('[PokerSwipeAuth] Magic link error:', e);
      throw e;
    }
  };

  // Verify OTP token from email
  const verifyOTP = async (email, otp) => {
    log('Verifying OTP for', email);
    try {
      const result = await supabaseCall('/auth/v1/verify', {
        method: 'POST',
        authenticated: false,
        body: JSON.stringify({
          type: 'magiclink',
          email: email.toLowerCase().trim(),
          token: otp
        })
      });

      if (result?.session?.access_token && result?.user) {
        setSession(result.session.access_token, result.user, result.session.expires_at);
        return { ok: true, user: result.user, session: result.session };
      }
      throw new Error('No session in response');
    } catch (e) {
      console.error('[PokerSwipeAuth] OTP verification error:', e);
      throw e;
    }
  };

  // Get current session from localStorage
  const getCurrentSession = async () => {
    const stored = getSession();
    if (!stored) return null;

    // Check if expired
    const expiresAt = new Date(stored.expiresAt).getTime();
    if (Date.now() > expiresAt) {
      clearSession();
      return null;
    }

    sessionToken = stored.token;
    sessionUser = stored.user;
    return stored;
  };

  // Load profile from public.profiles
  const loadProfile = async (uid) => {
    if (!sessionToken || !uid) return null;

    log('Loading profile for uid', uid);
    try {
      const result = await supabaseCall(
        `${cfg.profilesUrl}?id=eq.${uid}&select=*`,
        { method: 'GET' }
      );

      if (Array.isArray(result) && result.length > 0) {
        return result[0];
      }

      log('Profile not found, creating...');
      // Profile should be auto-created by trigger, but handle race condition
      const created = await supabaseCall(`${cfg.profilesUrl}`, {
        method: 'POST',
        body: JSON.stringify({
          id: uid,
          email: sessionUser.email,
          onboarding_completed: false,
          onboarding_completed_at: null,
          created_at: new Date().toISOString()
        })
      });
      return created?.[0] || { id: uid, email: sessionUser.email, onboarding_completed: false };
    } catch (e) {
      console.error('[PokerSwipeAuth] Profile load error:', e);
      return null;
    }
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
      await updateProfile({
        onboarding_completed: true,
        onboarding_completed_at: new Date().toISOString(),
        migrated_from_local: true,
        initial_assessment: legacy.diagnostic.length,
        skill: legacy.skill || 50
      });
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
