// PokerSwipe Auth Bootstrap — iOS registration visibility + magic-link recovery hotfix
// Rebuilds the email form at runtime so stale/overridden CSS cannot hide the input on iPhone.

(function () {
  'use strict';

  let authState = 'INITIALIZING';
  let currentEmail = '';

  const log = (msg, data) => {
    if (window.DEBUG_AUTH) console.log('[AuthBootstrap]', msg, data || '');
  };

  const AUTH_KEYS = [
    'access_token', 'refresh_token', 'token_type', 'type',
    'expires_in', 'expires_at', 'error', 'error_code', 'error_description'
  ];

  const withTimeout = (promise, ms, label) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label || 'Операция'}: таймаут`)), ms))
  ]);

  const injectCriticalAuthStyles = () => {
    if (document.getElementById('pokerswipe-auth-runtime-fix')) return;
    const style = document.createElement('style');
    style.id = 'pokerswipe-auth-runtime-fix';
    style.textContent = `
      #authEmail.pokerswipe-auth-screen,
      #authWelcome.pokerswipe-auth-screen,
      #authWaitingLink.pokerswipe-auth-screen {
        position: fixed !important;
        inset: 0 !important;
        z-index: 2147483000 !important;
        width: 100% !important;
        min-height: 100dvh !important;
        height: 100dvh !important;
        overflow-y: auto !important;
        background: radial-gradient(circle at 50% 38%, rgba(200,255,61,.07), transparent 30%), #030604 !important;
        color: #fff !important;
      }
      #authEmail .pokerswipe-auth-container,
      #authWelcome .pokerswipe-auth-container,
      #authWaitingLink .pokerswipe-auth-container {
        min-height: 100dvh !important;
        width: min(100%, 480px) !important;
        margin: 0 auto !important;
        padding: calc(28px + env(safe-area-inset-top, 0px)) 28px calc(28px + env(safe-area-inset-bottom, 0px)) !important;
        display: flex !important;
        flex-direction: column !important;
        align-items: stretch !important;
        justify-content: center !important;
        gap: 28px !important;
        opacity: 1 !important;
        visibility: visible !important;
      }
      #authEmail .pokerswipe-auth-header,
      #authWelcome .pokerswipe-auth-header {
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        gap: 12px !important;
        opacity: 1 !important;
        visibility: visible !important;
        text-align: center !important;
      }
      #authEmail .pokerswipe-auth-icon,
      #authWelcome .pokerswipe-auth-icon {
        display: block !important;
        opacity: 1 !important;
        visibility: visible !important;
        font-size: 62px !important;
        line-height: 1 !important;
        filter: drop-shadow(0 0 22px rgba(200,255,61,.22)) !important;
      }
      #authEmail .pokerswipe-auth-title,
      #authWelcome .pokerswipe-auth-title {
        display: block !important;
        opacity: 1 !important;
        visibility: visible !important;
        color: #fff !important;
        margin: 0 !important;
        font-size: clamp(28px, 8vw, 38px) !important;
        line-height: 1 !important;
        font-weight: 950 !important;
        letter-spacing: -.04em !important;
      }
      #authEmail .pokerswipe-auth-title .pink,
      #authWelcome .pokerswipe-auth-title .pink {
        display: inline !important;
        color: #c8ff3d !important;
      }
      #authEmail .pokerswipe-auth-subtitle,
      #authWelcome .pokerswipe-auth-subtitle {
        display: block !important;
        opacity: 1 !important;
        visibility: visible !important;
        color: #aaa6ad !important;
        margin: 0 !important;
        font-size: 14px !important;
        line-height: 1.45 !important;
      }
      #authEmail .pokerswipe-auth-form,
      #authWelcome .pokerswipe-auth-form {
        display: flex !important;
        flex-direction: column !important;
        gap: 14px !important;
        width: 100% !important;
        max-width: 420px !important;
        margin: 0 auto !important;
        opacity: 1 !important;
        visibility: visible !important;
      }
      #authEmailInput {
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        width: 100% !important;
        min-height: 56px !important;
        padding: 0 16px !important;
        border: 1px solid rgba(255,255,255,.22) !important;
        border-radius: 18px !important;
        outline: none !important;
        background: #111512 !important;
        color: #fff !important;
        caret-color: #c8ff3d !important;
        -webkit-text-fill-color: #fff !important;
        font-size: 16px !important;
        appearance: none !important;
        -webkit-appearance: none !important;
      }
      #authEmailInput::placeholder { color: #777d78 !important; opacity: 1 !important; }
      #authEmailInput:focus {
        border-color: #c8ff3d !important;
        box-shadow: 0 0 0 3px rgba(200,255,61,.13) !important;
      }
      #authEmailSendBtn,
      #authEmailBtn,
      #authResendBtn {
        display: flex !important;
        visibility: visible !important;
        opacity: 1 !important;
        width: 100% !important;
        min-height: 56px !important;
        align-items: center !important;
        justify-content: center !important;
        border: 0 !important;
        border-radius: 18px !important;
        background: linear-gradient(90deg, #c8ff3d, #dcff77) !important;
        color: #060806 !important;
        font-weight: 950 !important;
        font-size: 16px !important;
        letter-spacing: .05em !important;
        box-shadow: 0 10px 32px rgba(200,255,61,.16) !important;
      }
      #authEmailSendBtn:disabled,
      #authResendBtn:disabled { opacity: .55 !important; }
      #authEmailError,
      #authEmailSuccess,
      #authEmailState,
      #authBackToWelcome {
        visibility: visible !important;
      }
      #authEmailError:not(.hidden),
      #authEmailSuccess:not(.hidden),
      #authEmailState:not(.hidden),
      #authBackToWelcome:not(.hidden) {
        opacity: 1 !important;
      }
      #authBackToWelcome {
        color: #c8ff3d !important;
        text-align: center !important;
        font-size: 13px !important;
        text-decoration: none !important;
      }
      .pokerswipe-auth-error {
        padding: 12px 14px !important;
        border: 1px solid rgba(255,75,104,.5) !important;
        border-radius: 12px !important;
        background: rgba(255,75,104,.12) !important;
        color: #ff9bad !important;
      }
      .pokerswipe-auth-success {
        padding: 12px 14px !important;
        border: 1px solid rgba(66,231,134,.5) !important;
        border-radius: 12px !important;
        background: rgba(66,231,134,.12) !important;
        color: #8cffb8 !important;
      }
      .hidden { display: none !important; }
    `;
    document.head.appendChild(style);
  };

  const ensureEmailScreen = () => {
    let screen = document.getElementById('authEmail');
    if (!screen) {
      screen = document.createElement('section');
      screen.id = 'authEmail';
      document.body.appendChild(screen);
    }

    screen.className = 'pokerswipe-auth-screen hidden';
    screen.innerHTML = `
      <div class="pokerswipe-auth-container">
        <div class="pokerswipe-auth-header">
          <div class="pokerswipe-auth-icon" aria-hidden="true">✉️</div>
          <h1 class="pokerswipe-auth-title">ВОЙТИ В <span class="pink">POKERSWIPE</span></h1>
          <p class="pokerswipe-auth-subtitle">Введи почту — отправим ссылку для входа и регистрации.</p>
        </div>
        <div class="pokerswipe-auth-form">
          <input
            type="email"
            class="pokerswipe-auth-input"
            id="authEmailInput"
            placeholder="твоя@почта.ru"
            autocomplete="email"
            autocapitalize="none"
            spellcheck="false"
            inputmode="email"
          >
          <button type="button" class="pokerswipe-auth-button" id="authEmailSendBtn">ПОЛУЧИТЬ ССЫЛКУ</button>
          <div class="pokerswipe-auth-error hidden" id="authEmailError" role="alert"></div>
          <div class="pokerswipe-auth-success hidden" id="authEmailSuccess" role="status"></div>
          <p class="pokerswipe-auth-state" id="authEmailState"></p>
          <a href="#" id="authBackToWelcome">← НАЗАД</a>
        </div>
      </div>
    `;
    return screen;
  };

  const getAuthParams = () => {
    const url = new URL(window.location.href);
    const query = url.searchParams;
    const hash = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash);
    const pick = name => hash.get(name) ?? query.get(name);

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

    const expiresInRaw = Number.parseInt(p.expires_in || '3600', 10);
    const expiresIn = Number.isFinite(expiresInRaw) ? expiresInRaw : 3600;
    let expiresAt = Number.parseInt(p.expires_at || '', 10);
    if (!Number.isFinite(expiresAt) || expiresAt <= 0) {
      expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
    }

    return {
      access_token: p.access_token,
      refresh_token: p.refresh_token || null,
      token_type: p.token_type || 'Bearer',
      type: p.type || 'magiclink',
      expires_in: expiresIn,
      expires_at: expiresAt
    };
  };

  const cleanCallbackUrl = () => {
    const url = new URL(window.location.href);
    AUTH_KEYS.forEach(key => url.searchParams.delete(key));

    const hash = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash);
    AUTH_KEYS.forEach(key => hash.delete(key));
    url.hash = hash.toString() ? `#${hash.toString()}` : '';

    window.history.replaceState({}, '', url.toString());
  };

  const decodeJWT = token => {
    try {
      const parts = String(token || '').split('.');
      if (parts.length !== 3) return null;
      let payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      while (payload.length % 4) payload += '=';
      const bytes = atob(payload);
      const json = decodeURIComponent(Array.from(bytes)
        .map(ch => `%${ch.charCodeAt(0).toString(16).padStart(2, '0')}`)
        .join(''));
      const decoded = JSON.parse(json);
      return { id: decoded.sub, email: decoded.email || '', aud: decoded.aud };
    } catch (e) {
      log('JWT decode error', e);
      return null;
    }
  };

  const hideAuthScreens = () => {
    document.querySelectorAll('.pokerswipe-auth-screen').forEach(el => el.classList.add('hidden'));
  };

  const hideBootLayer = () => {
    document.getElementById('onboarding')?.classList.add('hidden');
  };

  const showScreen = id => {
    hideAuthScreens();
    hideBootLayer();
    const screen = document.getElementById(id);
    if (screen) {
      screen.classList.remove('hidden');
      screen.style.removeProperty('display');
      screen.removeAttribute('aria-hidden');
    }
  };

  const showError = (screenId, message) => {
    const el = document.getElementById(`${screenId}Error`);
    if (el) {
      el.textContent = message;
      el.classList.remove('hidden');
    }
    document.getElementById(`${screenId}Success`)?.classList.add('hidden');
  };

  const showSuccess = (screenId, message) => {
    const el = document.getElementById(`${screenId}Success`);
    if (el) {
      el.textContent = message;
      el.classList.remove('hidden');
    }
    document.getElementById(`${screenId}Error`)?.classList.add('hidden');
  };

  const setLoading = (buttonId, loading) => {
    const btn = document.getElementById(buttonId);
    if (!btn) return;
    btn.disabled = loading;
    btn.textContent = loading ? 'ОТПРАВЛЯЮ…' : 'ПОЛУЧИТЬ ССЫЛКУ';
  };

  const showEmailEntry = (message = '') => {
    authState = 'EMAIL';
    ensureEmailScreen();
    bindEmailEvents();
    showScreen('authEmail');

    const input = document.getElementById('authEmailInput');
    if (input) {
      input.disabled = false;
      input.style.removeProperty('display');
      input.style.removeProperty('opacity');
      input.style.removeProperty('visibility');
    }

    if (message) showError('authEmail', message);

    // Do not force the iOS keyboard during page bootstrap; focus only after a user tap.
    log('Email screen ready');
  };

  const showWelcome = () => {
    // One less fragile screen in the unauthenticated flow: go straight to email entry.
    showEmailEntry();
  };

  const showHome = () => {
    authState = 'HOME';
    hideAuthScreens();
    hideBootLayer();
    document.getElementById('mainApp')?.classList.remove('hidden');
    if (typeof window.renderStory === 'function') window.renderStory('home');
  };

  const showAssessment = () => {
    authState = 'ASSESSMENT';
    hideAuthScreens();
    hideBootLayer();
    document.getElementById('mainApp')?.classList.remove('hidden');
    if (typeof window.renderDiagnostic === 'function') window.renderDiagnostic();
  };

  const completeAuth = async authResult => {
    if (!authResult?.user?.id) {
      showEmailEntry('Не удалось определить пользователя. Запроси новую ссылку.');
      return;
    }

    let profile = authResult.profile || null;
    if (!profile) {
      try {
        profile = await withTimeout(window.PokerSwipeAuth.loadProfile(authResult.user.id), 8000, 'Профиль');
      } catch (e) {
        log('Profile load timed out; continuing to assessment', e);
      }
    }

    if (window.PokerSwipeAuth.hasLegacyAssessment?.() && !profile?.onboarding_completed) {
      try {
        const migrated = await withTimeout(window.PokerSwipeAuth.migrateLegacyAssessment(profile), 8000, 'Миграция');
        if (migrated) profile = { ...(profile || {}), onboarding_completed: true };
      } catch (e) {
        log('Legacy migration skipped', e);
      }
    }

    if (profile?.onboarding_completed) showHome();
    else showAssessment();
  };

  const processCallback = async callbackData => {
    try {
      const userInfo = decodeJWT(callbackData?.access_token);
      if (!userInfo?.id) {
        cleanCallbackUrl();
        showEmailEntry('Ссылка повреждена или устарела. Запроси новую.');
        return;
      }

      const session = {
        access_token: callbackData.access_token,
        refresh_token: callbackData.refresh_token,
        token_type: callbackData.token_type || 'Bearer',
        expires_in: callbackData.expires_in || 3600,
        expires_at: callbackData.expires_at,
        user: { id: userInfo.id, email: userInfo.email },
        savedAt: Date.now()
      };

      localStorage.setItem('pokerswipe_auth_session', JSON.stringify(session));
      cleanCallbackUrl();

      const restored = await withTimeout(window.PokerSwipeAuth.getCurrentSession(), 10000, 'Восстановление входа');
      if (!restored) {
        localStorage.removeItem('pokerswipe_auth_session');
        showEmailEntry('Не удалось сохранить вход. Запроси новую ссылку.');
        return;
      }

      await completeAuth({ session: restored, user: restored.user, profile: null });
    } catch (e) {
      console.error('[AuthBootstrap] Callback error', e);
      localStorage.removeItem('pokerswipe_auth_session');
      cleanCallbackUrl();
      showEmailEntry('Ошибка входа. Запроси новую ссылку.');
    }
  };

  const showWaitingScreen = email => {
    authState = 'WAITING_LINK';
    hideAuthScreens();
    hideBootLayer();

    let screen = document.getElementById('authWaitingLink');
    if (!screen) {
      screen = document.createElement('section');
      screen.id = 'authWaitingLink';
      document.body.appendChild(screen);
    }

    screen.className = 'pokerswipe-auth-screen';
    screen.innerHTML = `
      <div class="pokerswipe-auth-container">
        <div class="pokerswipe-auth-header">
          <div class="pokerswipe-auth-icon" aria-hidden="true">✉️</div>
          <h1 class="pokerswipe-auth-title">ПРОВЕРЬ <span class="pink">ПОЧТУ</span></h1>
          <p class="pokerswipe-auth-subtitle">Ссылка для входа отправлена на:</p>
          <p id="authWaitingEmail" style="font-weight:900;color:#fff;margin:0;text-align:center"></p>
        </div>
        <div class="pokerswipe-auth-form">
          <button type="button" id="authResendBtn" class="pokerswipe-auth-button">ОТПРАВИТЬ ЕЩЁ РАЗ</button>
          <a href="#" id="authChangeEmailBtn" style="color:#c8ff3d;text-align:center;text-decoration:none">← ИЗМЕНИТЬ ПОЧТУ</a>
        </div>
      </div>
    `;
    document.getElementById('authWaitingEmail').textContent = email;
    document.getElementById('authResendBtn')?.addEventListener('click', () => handleResendEmail(email));
    document.getElementById('authChangeEmailBtn')?.addEventListener('click', e => {
      e.preventDefault();
      showEmailEntry();
    });
  };

  const handleEmailSubmit = async () => {
    const input = document.getElementById('authEmailInput');
    const email = String(input?.value || '').trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showError('authEmail', 'Введи нормальный email.');
      input?.focus();
      return;
    }

    currentEmail = email;
    setLoading('authEmailSendBtn', true);
    try {
      await withTimeout(window.PokerSwipeAuth.sendMagicLink(email), 15000, 'Отправка ссылки');
      showSuccess('authEmail', 'Ссылка отправлена.');
      showWaitingScreen(email);
    } catch (e) {
      console.error('[AuthBootstrap] Email send error', e);
      showError('authEmail', 'Не удалось отправить ссылку. Проверь интернет и попробуй ещё раз.');
    } finally {
      setLoading('authEmailSendBtn', false);
    }
  };

  const handleResendEmail = async email => {
    const btn = document.getElementById('authResendBtn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'ОТПРАВЛЯЮ…';
    }
    try {
      await withTimeout(window.PokerSwipeAuth.sendMagicLink(email), 15000, 'Повторная отправка');
      if (btn) btn.textContent = 'ССЫЛКА ОТПРАВЛЕНА';
    } catch (e) {
      if (btn) btn.textContent = 'ПОПРОБОВАТЬ ЕЩЁ РАЗ';
    } finally {
      if (btn) btn.disabled = false;
    }
  };

  const bindEmailEvents = () => {
    const input = document.getElementById('authEmailInput');
    const send = document.getElementById('authEmailSendBtn');
    const back = document.getElementById('authBackToWelcome');

    if (input && input.dataset.bound !== '1') {
      input.dataset.bound = '1';
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter') handleEmailSubmit();
      });
    }
    if (send && send.dataset.bound !== '1') {
      send.dataset.bound = '1';
      send.addEventListener('click', handleEmailSubmit);
    }
    if (back && back.dataset.bound !== '1') {
      back.dataset.bound = '1';
      back.addEventListener('click', e => {
        e.preventDefault();
        const inputEl = document.getElementById('authEmailInput');
        if (inputEl) inputEl.value = '';
      });
    }
  };

  const bindLegacyWelcomeButton = () => {
    const btn = document.getElementById('authEmailBtn');
    if (btn && btn.dataset.bound !== '1') {
      btn.dataset.bound = '1';
      btn.addEventListener('click', () => {
        showEmailEntry();
        setTimeout(() => document.getElementById('authEmailInput')?.focus(), 50);
      });
    }
  };

  const bootstrap = async () => {
    injectCriticalAuthStyles();
    ensureEmailScreen();
    bindEmailEvents();
    bindLegacyWelcomeButton();

    if (!window.PokerSwipeAuth) {
      console.error('[AuthBootstrap] PokerSwipeAuth not available');
      showEmailEntry('Модуль входа не загрузился. Обнови страницу.');
      return;
    }

    const params = getAuthParams();
    if (params.access_token) {
      await processCallback(parseCallbackUrl());
      return;
    }

    if (params.error || params.error_code || params.error_description) {
      let message = String(params.error_description || params.error || params.error_code || 'Ошибка входа').replace(/\+/g, ' ');
      try { message = decodeURIComponent(message); } catch (_) {}
      cleanCallbackUrl();
      showEmailEntry(`Ошибка входа: ${message}`);
      return;
    }

    try {
      const authData = await withTimeout(window.PokerSwipeAuth.init(), 10000, 'Проверка сессии');
      if (!authData) {
        showEmailEntry();
        return;
      }
      await completeAuth(authData);
    } catch (e) {
      console.error('[AuthBootstrap] Init timeout/error', e);
      showEmailEntry('Не удалось восстановить прошлый вход. Войди по почте.');
    }
  };

  window.PokerSwipeAuthBootstrap = {
    bootstrap,
    showWelcome,
    showEmailEntry,
    showHome,
    showAssessment,
    parseCallbackUrl,
    getAuthParams,
    getState: () => authState,
    getEmail: () => currentEmail
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
  } else {
    bootstrap();
  }
})();
