// PokerSwipe Auth Bootstrap — MAGIC LINK HOTFIX
// Fixes Supabase redirects delivered in URL hash (#access_token=...) as well as query params.

(function() {
  'use strict';

  let currentEmail = '';
  let authState = 'INITIALIZING';

  const log = (msg, data) => {
    if (window.DEBUG_AUTH) console.log('[AuthBootstrap]', msg, data || '');
  };

  const AUTH_KEYS = [
    'access_token',
    'refresh_token',
    'token_type',
    'type',
    'expires_in',
    'expires_at',
    'error',
    'error_code',
    'error_description'
  ];

  const getAuthParams = () => {
    const url = new URL(window.location.href);
    const query = url.searchParams;
    const hash = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash);

    // Supabase implicit auth normally places session data in the fragment.
    // Query params are supported too for compatibility.
    const pick = (name) => hash.get(name) ?? query.get(name);

    return {
      access_token: pick('access_token'),
      refresh_token: pick('refresh_token'),
      token_type: pick('token_type'),
      type: pick('type'),
      expires_in: pick('expires_in'),
      expires_at: pick('expires_at'),
      error: pick('error'),
      error_code: pick('error_code'),
      error_description: pick('error_description')
    };
  };

  const parseCallbackUrl = () => {
    const p = getAuthParams();
    if (!p.access_token) return null;

    const expiresIn = Number.parseInt(p.expires_in || '3600', 10);
    let expiresAt = Number.parseInt(p.expires_at || '', 10);

    if (!Number.isFinite(expiresAt) || expiresAt <= 0) {
      expiresAt = Math.floor(Date.now() / 1000) + (Number.isFinite(expiresIn) ? expiresIn : 3600);
    }

    log('Magic link callback detected', {
      type: p.type,
      hasRefresh: !!p.refresh_token,
      source: new URL(window.location.href).hash.includes('access_token=') ? 'hash' : 'query'
    });

    return {
      access_token: p.access_token,
      refresh_token: p.refresh_token || null,
      token_type: p.token_type || 'Bearer',
      type: p.type || 'magiclink',
      expires_in: Number.isFinite(expiresIn) ? expiresIn : 3600,
      expires_at: expiresAt
    };
  };

  const cleanCallbackUrl = () => {
    const url = new URL(window.location.href);

    AUTH_KEYS.forEach(key => url.searchParams.delete(key));

    const hash = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash);
    const hadAuthHash = AUTH_KEYS.some(key => hash.has(key));
    if (hadAuthHash) {
      AUTH_KEYS.forEach(key => hash.delete(key));
      const remaining = hash.toString();
      url.hash = remaining ? `#${remaining}` : '';
    }

    window.history.replaceState({}, '', url.toString());
    log('Auth tokens removed from address bar');
  };

  const decodeJWT = (token) => {
    try {
      const parts = String(token || '').split('.');
      if (parts.length !== 3) return null;

      // JWT uses base64url, while atob expects standard base64.
      let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (payload.length % 4) payload += '=';

      const json = decodeURIComponent(
        Array.from(atob(payload))
          .map(ch => '%' + ch.charCodeAt(0).toString(16).padStart(2, '0'))
          .join('')
      );
      const decoded = JSON.parse(json);

      return {
        id: decoded.sub,
        email: decoded.email,
        aud: decoded.aud
      };
    } catch (e) {
      log('JWT decode error', e);
      return null;
    }
  };

  const showScreen = (screenId) => {
    document.querySelectorAll('.pokerswipe-auth-screen').forEach(el => el.classList.add('hidden'));
    const screen = document.getElementById(screenId);
    if (screen) screen.classList.remove('hidden');
    log('Screen shown', screenId);
  };

  const hideAuthScreens = () => {
    document.querySelectorAll('.pokerswipe-auth-screen').forEach(el => el.classList.add('hidden'));
  };

  const showError = (screenId, msg) => {
    const errorEl = document.getElementById(`${screenId}Error`);
    if (errorEl) {
      errorEl.textContent = msg;
      errorEl.classList.remove('hidden');
    }
    const successEl = document.getElementById(`${screenId}Success`);
    if (successEl) successEl.classList.add('hidden');
  };

  const showSuccess = (screenId, msg) => {
    const successEl = document.getElementById(`${screenId}Success`);
    if (successEl) {
      successEl.textContent = msg;
      successEl.classList.remove('hidden');
    }
    const errorEl = document.getElementById(`${screenId}Error`);
    if (errorEl) errorEl.classList.add('hidden');
  };

  const setLoading = (btnId, loading) => {
    const btn = document.getElementById(btnId);
    if (!btn) return;

    btn.disabled = loading;
    if (loading) {
      btn.innerHTML = '<span class="pokerswipe-auth-loading"></span>';
      return;
    }

    if (btnId === 'authEmailSendBtn') btn.textContent = 'ПОЛУЧИТЬ ССЫЛКУ';
    if (btnId === 'authEmailBtn') btn.textContent = 'ВХОД ПО ПОЧТЕ';
  };

  const showHome = () => {
    authState = 'HOME';
    hideAuthScreens();

    const onboarding = document.getElementById('onboarding');
    const mainApp = document.getElementById('mainApp');
    if (onboarding) onboarding.classList.add('hidden');
    if (mainApp) mainApp.classList.remove('hidden');

    if (typeof window.renderStory === 'function') {
      window.renderStory('home');
    }
  };

  const showAssessment = () => {
    authState = 'ASSESSMENT';
    hideAuthScreens();

    const onboarding = document.getElementById('onboarding');
    const mainApp = document.getElementById('mainApp');
    if (onboarding) onboarding.classList.add('hidden');
    if (mainApp) mainApp.classList.remove('hidden');

    if (typeof window.renderDiagnostic === 'function') {
      window.renderDiagnostic();
    }
  };

  const showWelcome = () => {
    authState = 'WELCOME';
    const onboarding = document.getElementById('onboarding');
    if (onboarding) onboarding.classList.add('hidden');
    showScreen('authWelcome');
  };

  const showEmailEntry = () => {
    authState = 'EMAIL';
    currentEmail = '';

    const input = document.getElementById('authEmailInput');
    if (input) {
      input.value = '';
      input.focus();
    }

    const errorEl = document.getElementById('authEmailError');
    const successEl = document.getElementById('authEmailSuccess');
    if (errorEl) errorEl.classList.add('hidden');
    if (successEl) successEl.classList.add('hidden');

    showScreen('authEmail');
  };

  const completeAuth = async (authResult) => {
    hideAuthScreens();
    authState = 'AUTHENTICATED';

    if (!authResult?.user?.id) {
      showError('authWelcome', 'Не удалось определить пользователя. Открой ссылку из письма ещё раз.');
      showWelcome();
      return;
    }

    let profile = authResult.profile;
    if (!profile) {
      profile = await window.PokerSwipeAuth.loadProfile(authResult.user.id);
    }

    if (window.PokerSwipeAuth.hasLegacyAssessment() && !profile?.onboarding_completed) {
      const migrated = await window.PokerSwipeAuth.migrateLegacyAssessment(profile);
      if (migrated) {
        profile = { ...(profile || {}), onboarding_completed: true };
      }
    }

    if (profile?.onboarding_completed) {
      showHome();
    } else {
      showAssessment();
    }
  };

  const processCallback = async (callbackData) => {
    log('Processing magic link callback');

    try {
      const userInfo = decodeJWT(callbackData.access_token);
      if (!userInfo?.id) {
        cleanCallbackUrl();
        showWelcome();
        showError('authWelcome', 'Ссылка входа повреждена. Запроси новую.');
        return;
      }

      const session = {
        access_token: callbackData.access_token,
        refresh_token: callbackData.refresh_token,
        user: {
          id: userInfo.id,
          email: userInfo.email || ''
        },
        expires_at: callbackData.expires_at,
        expires_in: callbackData.expires_in || 3600,
        token_type: callbackData.token_type || 'Bearer',
        savedAt: Date.now()
      };

      // Save before touching the URL, then remove credentials from browser history immediately.
      localStorage.setItem('pokerswipe_auth_session', JSON.stringify(session));
      cleanCallbackUrl();

      const restoredSession = await window.PokerSwipeAuth.getCurrentSession();
      if (!restoredSession) {
        localStorage.removeItem('pokerswipe_auth_session');
        showWelcome();
        showError('authWelcome', 'Не удалось сохранить вход. Запроси новую ссылку.');
        return;
      }

      const profile = await window.PokerSwipeAuth.loadProfile(userInfo.id);
      await completeAuth({
        session: restoredSession,
        user: restoredSession.user,
        profile
      });
    } catch (e) {
      console.error('[AuthBootstrap] Callback processing error:', e);
      localStorage.removeItem('pokerswipe_auth_session');
      cleanCallbackUrl();
      showWelcome();
      showError('authWelcome', 'Ошибка входа. Запроси новую ссылку.');
    }
  };

  const showWaitingScreen = (email) => {
    authState = 'WAITING_LINK';
    hideAuthScreens();

    let waitScreen = document.getElementById('authWaitingLink');
    if (!waitScreen) {
      waitScreen = document.createElement('section');
      waitScreen.id = 'authWaitingLink';
      waitScreen.className = 'pokerswipe-auth-screen';
      document.body.appendChild(waitScreen);
    }

    // Avoid injecting the email as raw HTML.
    waitScreen.innerHTML = `
      <div class="pokerswipe-auth-container">
        <h2>ПРОВЕРЬ ПОЧТУ</h2>
        <p>Мы отправили ссылку для входа на:</p>
        <p id="authWaitingEmail" style="font-weight:bold;margin:1rem 0;"></p>
        <p>Нажми на ссылку в письме — она вернёт тебя в PokerSwipe и выполнит вход.</p>
        <div style="margin-top:2rem;">
          <button id="authResendBtn" class="pokerswipe-auth-button">ОТПРАВИТЬ ЕЩЁ РАЗ</button>
        </div>
        <button id="authChangeEmailBtn" class="pokerswipe-auth-button-secondary" style="margin-top:1rem;">← ИЗМЕНИТЬ ПОЧТУ</button>
      </div>
    `;

    const emailEl = document.getElementById('authWaitingEmail');
    if (emailEl) emailEl.textContent = email;

    document.getElementById('authResendBtn')?.addEventListener('click', () => handleResendEmail(email));
    document.getElementById('authChangeEmailBtn')?.addEventListener('click', showEmailEntry);

    waitScreen.classList.remove('hidden');
  };

  const handleEmailSubmit = async () => {
    const input = document.getElementById('authEmailInput');
    const email = String(input?.value || '').trim();

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError('authEmail', 'Укажи корректный email');
      return;
    }

    currentEmail = email;
    setLoading('authEmailSendBtn', true);

    try {
      await window.PokerSwipeAuth.sendMagicLink(email);
      showSuccess('authEmail', 'Проверь почту!');
      showWaitingScreen(email);
    } catch (e) {
      console.error('[AuthBootstrap] Email send error:', e);
      showError('authEmail', 'Не удалось отправить ссылку. Попробуй ещё раз.');
    } finally {
      setLoading('authEmailSendBtn', false);
    }
  };

  const handleResendEmail = async (email) => {
    const btn = document.getElementById('authResendBtn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span class="pokerswipe-auth-loading"></span>';
    }

    try {
      await window.PokerSwipeAuth.sendMagicLink(email);
      if (btn) btn.textContent = 'ССЫЛКА ОТПРАВЛЕНА';
    } catch (e) {
      console.error('[AuthBootstrap] Resend error:', e);
      if (btn) btn.textContent = 'ОТПРАВИТЬ ЕЩЁ РАЗ';
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  const bindEvents = () => {
    document.getElementById('authEmailBtn')?.addEventListener('click', showEmailEntry);

    document.getElementById('authEmailInput')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') handleEmailSubmit();
    });

    document.getElementById('authEmailSendBtn')?.addEventListener('click', handleEmailSubmit);

    document.getElementById('authBackToWelcome')?.addEventListener('click', e => {
      e.preventDefault();
      showWelcome();
    });
  };

  const bootstrap = async () => {
    log('Starting auth bootstrap');

    if (!window.PokerSwipeAuth) {
      console.error('[AuthBootstrap] PokerSwipeAuth not available');
      const bootStatus = document.getElementById('bootStatus');
      if (bootStatus) bootStatus.textContent = 'Ошибка: Auth модуль не загружен';
      return;
    }

    bindEvents();

    const params = getAuthParams();

    if (params.access_token) {
      await processCallback(parseCallbackUrl());
      return;
    }

    if (params.error || params.error_code || params.error_description) {
      const message = decodeURIComponent(
        String(params.error_description || params.error || params.error_code || 'Неизвестная ошибка').replace(/\+/g, ' ')
      );
      cleanCallbackUrl();
      showWelcome();
      showError('authWelcome', `Ошибка входа: ${message}`);
      return;
    }

    const authData = await window.PokerSwipeAuth.init();

    if (!authData) {
      showWelcome();
      return;
    }

    await completeAuth(authData);
  };

  window.PokerSwipeAuthBootstrap = {
    bootstrap,
    showWelcome,
    showHome,
    showAssessment,
    parseCallbackUrl,
    getAuthParams,
    getState: () => authState
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
  } else {
    bootstrap();
  }
})();
