// PokerSwipe Auth Bootstrap — Initialize auth flow on page load
// Handles Welcome → Email → Magic Link → Profile → Assessment → Home

(function() {
  'use strict';

  let currentEmail = '';
  let authState = 'INITIALIZING'; // INITIALIZING, WELCOME, EMAIL, WAITING_LINK, AUTHENTICATED, ASSESSMENT, HOME

  const log = (msg, data) => {
    if (window.DEBUG_AUTH) console.log('[AuthBootstrap]', msg, data || '');
  };

  // Parse magic link callback from URL
  const parseCallbackUrl = () => {
    const url = new URL(window.location.href);
    const accessToken = url.searchParams.get('access_token');
    const refreshToken = url.searchParams.get('refresh_token');
    const type = url.searchParams.get('type');
    const expiresIn = url.searchParams.get('expires_in');
    const expiresAt = url.searchParams.get('expires_at');

    if (!accessToken) return null;

    log('Callback detected', { type, hasRefresh: !!refreshToken });
    return {
      access_token: accessToken,
      refresh_token: refreshToken,
      type,
      expires_in: expiresIn ? parseInt(expiresIn) : 3600,
      expires_at: expiresAt ? parseInt(expiresAt) : null,
      user: null // Will be loaded from session after parsing
    };
  };

  // Clean callback parameters from URL
  const cleanCallbackUrl = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('access_token');
    url.searchParams.delete('refresh_token');
    url.searchParams.delete('type');
    url.searchParams.delete('expires_in');
    url.searchParams.delete('expires_at');
    url.searchParams.delete('error');
    url.searchParams.delete('error_description');
    window.history.replaceState({}, '', url.toString());
    log('Callback parameters cleaned from URL');
  };

  // Decode JWT to get user ID and email (basic decode, no verification needed)
  const decodeJWT = (token) => {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const decoded = JSON.parse(atob(parts[1]));
      return {
        id: decoded.sub,
        email: decoded.email,
        aud: decoded.aud
      };
    } catch (e) {
      log('JWT decode error:', e);
      return null;
    }
  };

  // Process magic link callback
  const processCallback = async (callbackData) => {
    log('Processing magic link callback');
    try {
      // Decode access_token to get user info
      const userInfo = decodeJWT(callbackData.access_token);
      if (!userInfo || !userInfo.id) {
        log('Failed to decode user info from access_token');
        showError('authWelcome', 'Ошибка входа. Попробуй ещё раз.');
        cleanCallbackUrl();
        showWelcome();
        return;
      }

      log('User decoded from JWT', { id: userInfo.id, email: userInfo.email });

      // Create session object from callback data
      const session = {
        access_token: callbackData.access_token,
        refresh_token: callbackData.refresh_token,
        user: {
          id: userInfo.id,
          email: userInfo.email
        },
        expires_at: callbackData.expires_at,
        expires_in: callbackData.expires_in || 3600,
        token_type: 'Bearer',
        savedAt: Date.now()
      };

      // Save to localStorage
      localStorage.setItem('pokerswipe_auth_session', JSON.stringify(session));
      log('Session restored from magic link callback', {
        uid: userInfo.id,
        email: userInfo.email,
        expiresAt: session.expires_at
      });

      // Validate via getCurrentSession to ensure everything is consistent
      const restoredSession = await window.PokerSwipeAuth.getCurrentSession();
      if (!restoredSession) {
        log('Failed to validate session from callback');
        localStorage.removeItem('pokerswipe_auth_session');
        showError('authWelcome', 'Ошибка входа. Попробуй ещё раз.');
        cleanCallbackUrl();
        showWelcome();
        return;
      }

      // Load profile
      const profile = await window.PokerSwipeAuth.loadProfile(userInfo.id);

      // Complete auth flow
      completeAuth({ session: restoredSession, user: restoredSession.user, profile });
    } catch (e) {
      log('Callback processing error:', e);
      localStorage.removeItem('pokerswipe_auth_session');
      showError('authWelcome', 'Ошибка входа: ' + (e.message || 'Неизвестная ошибка'));
      cleanCallbackUrl();
      showWelcome();
    }
  };

  // Show/hide screens
  const showScreen = (screenId) => {
    document.querySelectorAll('[id^="auth"]').forEach(el => {
      if (el.classList.contains('pokerswipe-auth-screen')) {
        el.classList.add('hidden');
      }
    });
    const screen = document.getElementById(screenId);
    if (screen) {
      screen.classList.remove('hidden');
    }
    log('Screen shown:', screenId);
  };

  const hideAuthScreens = () => {
    document.querySelectorAll('.pokerswipe-auth-screen').forEach(el => {
      el.classList.add('hidden');
    });
  };


  // Show error message
  const showError = (screenId, msg) => {
    const errorEl = document.getElementById(`${screenId}Error`);
    if (errorEl) {
      errorEl.textContent = msg;
      errorEl.classList.remove('hidden');
    }
    const successEl = document.getElementById(`${screenId}Success`);
    if (successEl) successEl.classList.add('hidden');
  };

  // Show success message
  const showSuccess = (screenId, msg) => {
    const successEl = document.getElementById(`${screenId}Success`);
    if (successEl) {
      successEl.textContent = msg;
      successEl.classList.remove('hidden');
    }
    const errorEl = document.getElementById(`${screenId}Error`);
    if (errorEl) errorEl.classList.add('hidden');
  };

  // Set loading state
  const setLoading = (btnId, loading) => {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.disabled = loading;
      if (loading) {
        btn.innerHTML = '<span class="pokerswipe-auth-loading"></span>';
      } else {
        if (btnId === 'authEmailSendBtn') btn.textContent = 'ПОЛУЧИТЬ ССЫЛКУ';
        if (btnId === 'authEmailBtn') btn.textContent = 'ВХОД ПО ПОЧТЕ';
      }
    }
  };

  // Handle email submission
  const handleEmailSubmit = async () => {
    const email = document.getElementById('authEmailInput').value.trim();
    if (!email) {
      showError('authEmail', 'Укажи корректный email');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError('authEmail', 'Email некорректный');
      return;
    }

    currentEmail = email;
    setLoading('authEmailSendBtn', true);

    try {
      await window.PokerSwipeAuth.sendMagicLink(email);
      showSuccess('authEmail', 'Проверь почту!');
      showWaitingScreen(email);
    } catch (e) {
      log('Email error:', e);
      showError('authEmail', 'Ошибка: ' + (e.message || 'Не удалось отправить'));
    } finally {
      setLoading('authEmailSendBtn', false);
    }
  };

  // Complete auth and proceed to assessment or home
  const completeAuth = async (authResult) => {
    hideAuthScreens();
    authState = 'AUTHENTICATED';

    const profile = authResult.profile || await window.PokerSwipeAuth.loadProfile(authResult.user.id);

    // Check for legacy assessment migration
    if (window.PokerSwipeAuth.hasLegacyAssessment() && !profile?.onboarding_completed) {
      log('Detected legacy assessment, migrating...');
      await window.PokerSwipeAuth.migrateLegacyAssessment(profile);
      profile.onboarding_completed = true;
    }

    // If onboarding already completed, go to home
    if (profile?.onboarding_completed) {
      log('Profile onboarding completed, going to HOME');
      showHome(profile);
      return;
    }

    // Otherwise show assessment (existing diagnostic)
    log('Profile needs onboarding, showing assessment');
    showAssessment(profile);
  };

  // Show home screen
  const showHome = (profile) => {
    log('Showing HOME');
    authState = 'HOME';
    hideAuthScreens();
    const onboarding = document.getElementById('onboarding');
    const mainApp = document.getElementById('mainApp');
    if (onboarding) onboarding.classList.add('hidden');
    if (mainApp) mainApp.classList.remove('hidden');
    // Existing app initialization will handle rendering home
    if (typeof window.renderStory === 'function') {
      window.renderStory('home');
    }
  };

  // Show assessment
  const showAssessment = (profile) => {
    log('Showing ASSESSMENT');
    authState = 'ASSESSMENT';
    hideAuthScreens();
    const onboarding = document.getElementById('onboarding');
    const mainApp = document.getElementById('mainApp');
    if (onboarding) onboarding.classList.add('hidden');
    if (mainApp) mainApp.classList.remove('hidden');
    // Show diagnostic assessment
    if (typeof window.renderDiagnostic === 'function') {
      window.renderDiagnostic();
    }
  };

  // Show welcome screen
  const showWelcome = () => {
    authState = 'WELCOME';
    const onboarding = document.getElementById('onboarding');
    if (onboarding) onboarding.classList.add('hidden');  // Hide loading screen
    showScreen('authWelcome');
  };

  // Show email screen
  const showEmailEntry = () => {
    authState = 'EMAIL';
    currentEmail = '';
    const emailInput = document.getElementById('authEmailInput');
    if (emailInput) {
      emailInput.value = '';
      emailInput.focus();
    }
    const errorEl = document.getElementById('authEmailError');
    if (errorEl) errorEl.classList.add('hidden');
    const successEl = document.getElementById('authEmailSuccess');
    if (successEl) successEl.classList.add('hidden');
    showScreen('authEmail');
  };

  // Show waiting screen after email sent
  const showWaitingScreen = (email) => {
    authState = 'WAITING_LINK';
    hideAuthScreens();

    // Create or update waiting screen
    let waitScreen = document.getElementById('authWaitingLink');
    if (!waitScreen) {
      waitScreen = document.createElement('section');
      waitScreen.id = 'authWaitingLink';
      waitScreen.className = 'pokerswipe-auth-screen';
      const onboarding = document.getElementById('onboarding');
      if (onboarding) onboarding.appendChild(waitScreen);
    }

    waitScreen.innerHTML = `
      <div class="pokerswipe-auth-container">
        <h2>ПРОВЕРЬ ПОЧТУ</h2>
        <p>Мы отправили ссылку для входа на:</p>
        <p style="font-weight: bold; margin: 1rem 0;">${email}</p>
        <p>Нажми на ссылку в письме, чтобы вернуться и войти.</p>
        <div style="margin-top: 2rem;">
          <button id="authResendBtn" class="pokerswipe-auth-button">ОТПРАВИТЬ ЕЩЁ РАЗ</button>
        </div>
        <button id="authChangeEmailBtn" class="pokerswipe-auth-button-secondary" style="margin-top: 1rem;">← ИЗМЕНИТЬ ПОЧТУ</button>
      </div>
    `;

    const resendBtn = document.getElementById('authResendBtn');
    if (resendBtn) {
      resendBtn.addEventListener('click', () => handleResendEmail(email));
    }

    const changeEmailBtn = document.getElementById('authChangeEmailBtn');
    if (changeEmailBtn) {
      changeEmailBtn.addEventListener('click', () => showEmailEntry());
    }

    waitScreen.classList.remove('hidden');
    log('Waiting screen shown for:', email);
  };

  // Resend magic link to same email
  const handleResendEmail = async (email) => {
    const btn = document.getElementById('authResendBtn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="pokerswipe-auth-loading"></span>';
    }

    try {
      await window.PokerSwipeAuth.sendMagicLink(email);
      log('Magic link resent to:', email);
      if (btn) {
        btn.textContent = 'ССЫЛКА ОТПРАВЛЕНА!';
        btn.disabled = false;
      }
    } catch (e) {
      log('Resend error:', e);
      if (btn) {
        btn.textContent = 'ОТПРАВИТЬ ЕЩЁ РАЗ';
        btn.disabled = false;
      }
      // Show error but don't break the flow
      const errorEl = document.createElement('div');
      errorEl.className = 'pokerswipe-auth-error';
      errorEl.textContent = 'Ошибка: ' + (e.message || 'Не удалось переотправить');
      const container = document.querySelector('.pokerswipe-auth-container');
      if (container) container.insertBefore(errorEl, btn);
    }
  };

  // Event listeners
  const bindEvents = () => {
    // Welcome screen
    const authEmailBtn = document.getElementById('authEmailBtn');
    if (authEmailBtn) {
      authEmailBtn.addEventListener('click', showEmailEntry);
    }

    // Email screen
    const emailInput = document.getElementById('authEmailInput');
    if (emailInput) {
      emailInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleEmailSubmit();
      });
    }

    const emailSendBtn = document.getElementById('authEmailSendBtn');
    if (emailSendBtn) {
      emailSendBtn.addEventListener('click', handleEmailSubmit);
    }

    const backToWelcome = document.getElementById('authBackToWelcome');
    if (backToWelcome) {
      backToWelcome.addEventListener('click', (e) => {
        e.preventDefault();
        showWelcome();
      });
    }
  };

  // Main bootstrap function
  const bootstrap = async () => {
    log('Starting auth bootstrap');

    // Wait for PokerSwipeAuth to be available
    if (!window.PokerSwipeAuth) {
      console.error('[AuthBootstrap] PokerSwipeAuth not available');
      const bootStatus = document.getElementById('bootStatus');
      if (bootStatus) bootStatus.textContent = 'Ошибка: Auth модуль не загружен';
      return;
    }

    // Ensure onboarding and mainApp elements exist
    const onboardingEl = document.getElementById('onboarding');
    const mainAppEl = document.getElementById('mainApp');
    if (!onboardingEl) {
      console.error('[AuthBootstrap] onboarding element not found');
      return;
    }

    // Bind events early
    bindEvents();

    // Check for magic link callback in URL
    const callbackData = parseCallbackUrl();
    if (callbackData) {
      log('Magic link callback detected');
      await processCallback(callbackData);
      return;
    }

    // Check for error callback
    const errorParam = new URL(window.location.href).searchParams.get('error');
    if (errorParam) {
      log('Auth error in callback:', errorParam);
      const errorDesc = new URL(window.location.href).searchParams.get('error_description');
      showError('authWelcome', `Ошибка входа: ${errorDesc || errorParam}`);
      cleanCallbackUrl();
      showWelcome();
      return;
    }

    // No callback, check for existing session
    const authData = await window.PokerSwipeAuth.init();

    if (!authData) {
      // No existing session, show welcome screen
      log('No session found, showing welcome');
      showWelcome();
      return;
    }

    // Session exists, proceed to profile check
    log('Session found, proceeding to profile');
    completeAuth(authData);
  };

  // Export for testing
  window.PokerSwipeAuthBootstrap = {
    bootstrap,
    showWelcome,
    showHome,
    showAssessment,
    getState: () => authState
  };

  // Start bootstrap when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
