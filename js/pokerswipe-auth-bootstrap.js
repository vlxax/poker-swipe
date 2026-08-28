// PokerSwipe Auth Bootstrap — EMAIL OTP CODE FLOW
// Flow: email -> code from email -> verify inside PokerSwipe -> persistent session -> app.
// Keeps a compatibility path for old magic-link callbacks during the transition.

(function () {
  'use strict';

  let authState = 'INITIALIZING';
  let currentEmail = '';

  const AUTH_KEYS = [
    'access_token', 'refresh_token', 'token_type', 'type',
    'expires_in', 'expires_at', 'error', 'error_code', 'error_description'
  ];

  const log = (msg, data) => {
    if (window.DEBUG_AUTH) console.log('[AuthBootstrap]', msg, data || '');
  };

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

  const withTimeout = (promise, ms, label) => Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`${label || 'Операция'}: таймаут`)), ms)
    )
  ]);

  const hideBootLayer = () => {
    document.getElementById('onboarding')?.classList.add('hidden');
  };

  const hideAuthScreens = () => {
    document.querySelectorAll('.pokerswipe-auth-screen')
      .forEach(el => el.classList.add('hidden'));
  };

  const showScreen = id => {
    hideAuthScreens();
    hideBootLayer();

    const screen = document.getElementById(id);
    if (!screen) return;

    screen.classList.remove('hidden');
    screen.style.removeProperty('display');
    screen.removeAttribute('aria-hidden');
  };

  const injectStyles = () => {
    if (document.getElementById('pokerswipe-email-otp-styles')) return;

    const style = document.createElement('style');
    style.id = 'pokerswipe-email-otp-styles';
    style.textContent = `
      #authEmail,
      #authOtp,
      #authOtpSuccess {
        position: fixed !important;
        inset: 0 !important;
        z-index: 2147483000 !important;
        width: 100% !important;
        height: 100dvh !important;
        min-height: 100dvh !important;
        overflow-y: auto !important;
        background:
          radial-gradient(circle at 50% 37%, rgba(200,255,61,.08), transparent 31%),
          #020503 !important;
        color: #fff !important;
      }

      #authEmail .pokerswipe-auth-container,
      #authOtp .pokerswipe-auth-container,
      #authOtpSuccess .pokerswipe-auth-container {
        width: min(100%, 480px) !important;
        min-height: 100dvh !important;
        margin: 0 auto !important;
        padding:
          calc(28px + env(safe-area-inset-top, 0px))
          28px
          calc(30px + env(safe-area-inset-bottom, 0px)) !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: center !important;
        align-items: stretch !important;
        gap: 30px !important;
      }

      #authEmail .pokerswipe-auth-header,
      #authOtp .pokerswipe-auth-header,
      #authOtpSuccess .pokerswipe-auth-header {
        display: flex !important;
        flex-direction: column !important;
        align-items: center !important;
        text-align: center !important;
        gap: 12px !important;
      }

      #authEmail .pokerswipe-auth-icon,
      #authOtp .pokerswipe-auth-icon,
      #authOtpSuccess .pokerswipe-auth-icon {
        display: block !important;
        font-size: 64px !important;
        line-height: 1 !important;
        filter: drop-shadow(0 0 24px rgba(200,255,61,.22)) !important;
      }

      #authEmail .pokerswipe-auth-title,
      #authOtp .pokerswipe-auth-title,
      #authOtpSuccess .pokerswipe-auth-title {
        display: block !important;
        margin: 0 !important;
        color: #fff !important;
        font-size: clamp(30px, 8vw, 40px) !important;
        line-height: .98 !important;
        letter-spacing: -.045em !important;
        font-weight: 950 !important;
      }

      #authEmail .pink,
      #authOtp .pink,
      #authOtpSuccess .pink {
        display: inline !important;
        color: #c8ff3d !important;
      }

      #authEmail .pokerswipe-auth-subtitle,
      #authOtp .pokerswipe-auth-subtitle,
      #authOtpSuccess .pokerswipe-auth-subtitle {
        display: block !important;
        margin: 0 !important;
        color: #a9a1ad !important;
        font-size: 14px !important;
        line-height: 1.5 !important;
      }

      #authEmail .pokerswipe-auth-form,
      #authOtp .pokerswipe-auth-form {
        display: flex !important;
        flex-direction: column !important;
        gap: 14px !important;
        width: 100% !important;
        max-width: 420px !important;
        margin: 0 auto !important;
      }

      #authEmailInput,
      #authOtpInput {
        display: block !important;
        width: 100% !important;
        min-height: 58px !important;
        border: 1px solid rgba(255,255,255,.22) !important;
        border-radius: 18px !important;
        background: #101411 !important;
        color: #fff !important;
        -webkit-text-fill-color: #fff !important;
        caret-color: #c8ff3d !important;
        outline: none !important;
        box-sizing: border-box !important;
        appearance: none !important;
        -webkit-appearance: none !important;
      }

      #authEmailInput {
        padding: 0 17px !important;
        font-size: 17px !important;
      }

      #authOtpInput {
        padding: 0 12px !important;
        text-align: center !important;
        font-size: 30px !important;
        font-weight: 900 !important;
        letter-spacing: .28em !important;
        font-variant-numeric: tabular-nums !important;
      }

      #authEmailInput:focus,
      #authOtpInput:focus {
        border-color: #c8ff3d !important;
        box-shadow: 0 0 0 3px rgba(200,255,61,.13) !important;
      }

      #authEmailInput::placeholder,
      #authOtpInput::placeholder {
        color: #6f756f !important;
        opacity: 1 !important;
      }

      #authEmailSendBtn,
      #authOtpVerifyBtn,
      #authOtpResendBtn {
        display: flex !important;
        width: 100% !important;
        min-height: 58px !important;
        align-items: center !important;
        justify-content: center !important;
        border: 0 !important;
        border-radius: 18px !important;
        background: linear-gradient(90deg, #c8ff3d, #ddff79) !important;
        color: #050705 !important;
        font-size: 16px !important;
        font-weight: 950 !important;
        letter-spacing: .055em !important;
        box-shadow: 0 10px 32px rgba(200,255,61,.16) !important;
      }

      #authOtpResendBtn {
        background: #151a16 !important;
        color: #c8ff3d !important;
        border: 1px solid rgba(200,255,61,.28) !important;
        box-shadow: none !important;
      }

      #authEmailSendBtn:disabled,
      #authOtpVerifyBtn:disabled,
      #authOtpResendBtn:disabled {
        opacity: .55 !important;
      }

      #authOtpEmail {
        margin: 0 !important;
        color: #fff !important;
        text-align: center !important;
        font-size: 17px !important;
        font-weight: 900 !important;
        word-break: break-word !important;
      }

      .otp-inline-link {
        display: block !important;
        color: #c8ff3d !important;
        text-align: center !important;
        text-decoration: none !important;
        font-size: 14px !important;
        font-weight: 800 !important;
        padding: 8px !important;
      }

      .otp-message {
        padding: 12px 14px !important;
        border-radius: 13px !important;
        font-size: 13px !important;
        line-height: 1.45 !important;
      }

      .otp-error {
        color: #ff9bad !important;
        background: rgba(255,75,104,.12) !important;
        border: 1px solid rgba(255,75,104,.46) !important;
      }

      .otp-ok {
        color: #9bffc0 !important;
        background: rgba(66,231,134,.11) !important;
        border: 1px solid rgba(66,231,134,.42) !important;
      }

      #authOtpSuccess .otp-success-check {
        width: 86px !important;
        height: 86px !important;
        margin: 0 auto !important;
        border-radius: 50% !important;
        display: grid !important;
        place-items: center !important;
        background: #c8ff3d !important;
        color: #050705 !important;
        font-size: 48px !important;
        font-weight: 950 !important;
        box-shadow: 0 0 42px rgba(200,255,61,.28) !important;
      }

      #authOtpSuccess .otp-success-copy {
        text-align: center !important;
        color: #a9a1ad !important;
        font-size: 15px !important;
        line-height: 1.5 !important;
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
          <p class="pokerswipe-auth-subtitle">
            Введи почту. Мы пришлём код — приложение закрывать не нужно.
          </p>
        </div>

        <div class="pokerswipe-auth-form">
          <input
            id="authEmailInput"
            class="pokerswipe-auth-input"
            type="email"
            placeholder="твоя@почта.ru"
            autocomplete="email"
            autocapitalize="none"
            spellcheck="false"
            inputmode="email"
          >
          <button id="authEmailSendBtn" type="button">ПОЛУЧИТЬ КОД</button>
          <div id="authEmailError" class="otp-message otp-error hidden" role="alert"></div>
        </div>
      </div>
    `;
  };

  const ensureOtpScreen = () => {
    let screen = document.getElementById('authOtp');
    if (!screen) {
      screen = document.createElement('section');
      screen.id = 'authOtp';
      document.body.appendChild(screen);
    }

    screen.className = 'pokerswipe-auth-screen hidden';
    screen.innerHTML = `
      <div class="pokerswipe-auth-container">
        <div class="pokerswipe-auth-header">
          <div class="pokerswipe-auth-icon" aria-hidden="true">✉️</div>
          <h1 class="pokerswipe-auth-title">ВВЕДИ <span class="pink">КОД</span></h1>
          <p class="pokerswipe-auth-subtitle">Код отправлен на:</p>
          <p id="authOtpEmail"></p>
        </div>

        <div class="pokerswipe-auth-form">
          <input
            id="authOtpInput"
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            enterkeyhint="done"
            maxlength="8"
            placeholder="000000"
            aria-label="Код из письма"
          >
          <button id="authOtpVerifyBtn" type="button">ВОЙТИ</button>
          <div id="authOtpError" class="otp-message otp-error hidden" role="alert"></div>
          <div id="authOtpInfo" class="otp-message otp-ok hidden" role="status"></div>
          <button id="authOtpResendBtn" type="button">ОТПРАВИТЬ КОД ЕЩЁ РАЗ</button>
          <a href="#" id="authOtpChangeEmail" class="otp-inline-link">← ИЗМЕНИТЬ ПОЧТУ</a>
        </div>
      </div>
    `;
  };

  const ensureSuccessScreen = () => {
    let screen = document.getElementById('authOtpSuccess');
    if (!screen) {
      screen = document.createElement('section');
      screen.id = 'authOtpSuccess';
      document.body.appendChild(screen);
    }

    screen.className = 'pokerswipe-auth-screen hidden';
    screen.innerHTML = `
      <div class="pokerswipe-auth-container">
        <div class="pokerswipe-auth-header">
          <div class="otp-success-check">✓</div>
          <h1 class="pokerswipe-auth-title">ВХОД <span class="pink">УСПЕШЕН</span></h1>
          <p class="otp-success-copy">
            Готово. Сессия сохранена — при следующем запуске повторно входить не нужно.
          </p>
        </div>
      </div>
    `;
  };

  const setError = (id, message) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = message;
    el.classList.remove('hidden');
  };

  const clearMessage = id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = '';
    el.classList.add('hidden');
  };

  const setButtonLoading = (id, loading, idleText, loadingText) => {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.disabled = loading;
    btn.textContent = loading ? loadingText : idleText;
  };

  const normalizeEmail = value =>
    String(value || '').trim().toLowerCase();

  const validEmail = email =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const getAuthParams = () => {
    const url = new URL(window.location.href);
    const query = url.searchParams;
    const hash = new URLSearchParams(
      url.hash.startsWith('#') ? url.hash.slice(1) : url.hash
    );
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

  const cleanCallbackUrl = () => {
    const url = new URL(window.location.href);
    AUTH_KEYS.forEach(key => url.searchParams.delete(key));

    const hash = new URLSearchParams(
      url.hash.startsWith('#') ? url.hash.slice(1) : url.hash
    );
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
      const json = decodeURIComponent(
        Array.from(bytes)
          .map(ch => `%${ch.charCodeAt(0).toString(16).padStart(2, '0')}`)
          .join('')
      );

      const decoded = JSON.parse(json);
      return {
        id: decoded.sub,
        email: decoded.email || ''
      };
    } catch (e) {
      console.warn('[AuthBootstrap] JWT decode failed', e);
      return null;
    }
  };

  const saveSession = session => {
    if (!session?.access_token || !session?.user?.id) {
      throw new Error('Сервер не вернул сессию');
    }

    const expiresIn = Number(session.expires_in) > 0
      ? Number(session.expires_in)
      : 3600;

    let expiresAt = Number(session.expires_at);
    if (!Number.isFinite(expiresAt) || expiresAt <= 0) {
      expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
    } else if (expiresAt > 1e12) {
      expiresAt = Math.floor(expiresAt / 1000);
    }

    const normalized = {
      access_token: session.access_token,
      refresh_token: session.refresh_token || null,
      token_type: session.token_type || 'Bearer',
      expires_in: expiresIn,
      expires_at: expiresAt,
      user: session.user,
      savedAt: Date.now()
    };

    localStorage.setItem(
      'pokerswipe_auth_session',
      JSON.stringify(normalized)
    );

    return normalized;
  };

  const showEmailEntry = (message = '') => {
    authState = 'EMAIL';
    currentEmail = '';
    ensureEmailScreen();
    bindEvents();
    showScreen('authEmail');

    const input = document.getElementById('authEmailInput');
    if (input) input.value = '';

    clearMessage('authEmailError');
    if (message) setError('authEmailError', message);
  };

  const showOtpEntry = (email, info = '') => {
    authState = 'OTP';
    currentEmail = normalizeEmail(email);

    ensureOtpScreen();
    bindEvents();
    showScreen('authOtp');

    const emailEl = document.getElementById('authOtpEmail');
    if (emailEl) emailEl.textContent = currentEmail;

    const codeInput = document.getElementById('authOtpInput');
    if (codeInput) {
      codeInput.value = '';
      setTimeout(() => codeInput.focus(), 80);
    }

    clearMessage('authOtpError');
    clearMessage('authOtpInfo');
    if (info) {
      const infoEl = document.getElementById('authOtpInfo');
      if (infoEl) {
        infoEl.textContent = info;
        infoEl.classList.remove('hidden');
      }
    }
  };

  const showSuccess = async authResult => {
    authState = 'SUCCESS';
    ensureSuccessScreen();
    showScreen('authOtpSuccess');

    await sleep(900);
    await completeAuth(authResult);
  };

  const showHome = () => {
    authState = 'HOME';
    hideAuthScreens();
    hideBootLayer();

    const mainApp = document.getElementById('mainApp');
    if (mainApp) mainApp.classList.remove('hidden');

    if (typeof window.renderStory === 'function') {
      window.renderStory('home');
    }
  };

  const showAssessment = () => {
    authState = 'ASSESSMENT';
    hideAuthScreens();
    hideBootLayer();

    const mainApp = document.getElementById('mainApp');
    if (mainApp) mainApp.classList.remove('hidden');

    if (typeof window.renderDiagnostic === 'function') {
      window.renderDiagnostic();
    }
  };

  const completeAuth = async authResult => {
    if (!authResult?.user?.id) {
      showEmailEntry('Не удалось сохранить вход. Введи почту ещё раз.');
      return;
    }

    let profile = authResult.profile || null;

    if (!profile && window.PokerSwipeAuth?.loadProfile) {
      try {
        profile = await withTimeout(
          window.PokerSwipeAuth.loadProfile(authResult.user.id),
          8000,
          'Профиль'
        );
      } catch (e) {
        log('Profile load skipped after timeout/error', e);
      }
    }

    if (
      window.PokerSwipeAuth?.hasLegacyAssessment?.() &&
      !profile?.onboarding_completed
    ) {
      try {
        const migrated = await withTimeout(
          window.PokerSwipeAuth.migrateLegacyAssessment(profile),
          8000,
          'Миграция'
        );
        if (migrated) {
          profile = {
            ...(profile || {}),
            onboarding_completed: true
          };
        }
      } catch (e) {
        log('Legacy migration skipped', e);
      }
    }

    if (profile?.onboarding_completed) showHome();
    else showAssessment();
  };

  // Supabase email OTP and Magic Link use the same /otp endpoint.
  // Whether the email contains a link or a code is controlled by the Supabase template.
  const requestEmailCode = async email => {
    if (!window.PokerSwipeAuth?.sendMagicLink) {
      throw new Error('Auth module unavailable');
    }

    return withTimeout(
      window.PokerSwipeAuth.sendMagicLink(email),
      15000,
      'Отправка кода'
    );
  };

  // Verify exactly once against GoTrue and accept both common response shapes:
  // 1) { access_token, refresh_token, user, ... }
  // 2) { session: { access_token, ... }, user }
  const verifyEmailCode = async (email, token) => {
    const cfg = window.PokerSwipeSupabase;
    if (!cfg?.url || !cfg?.publishableKey) {
      throw new Error('Supabase config is missing');
    }

    const url = cfg.url + '/auth/v1/verify';
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          'apikey': cfg.publishableKey
        },
        body: JSON.stringify({
          type: 'email',
          email: normalizeEmail(email),
          token: String(token || '').trim()
        })
      });
    } catch (e) {
      if (e?.name === 'AbortError') {
        throw new Error('Проверка кода заняла слишком много времени');
      }
      throw e;
    } finally {
      clearTimeout(timeoutId);
    }

    let payload = {};
    const rawText = await response.text();
    if (rawText) {
      try {
        payload = JSON.parse(rawText);
      } catch (_) {
        payload = {};
      }
    }

    if (!response.ok) {
      const serverMessage =
        payload?.msg ||
        payload?.message ||
        payload?.error_description ||
        payload?.error ||
        '';

      if (/expired/i.test(serverMessage)) {
        throw new Error('Код истёк. Отправь новый.');
      }

      if (/invalid/i.test(serverMessage) || response.status === 403) {
        throw new Error('Неверный код. Проверь цифры.');
      }

      if (response.status === 429) {
        throw new Error('Слишком много попыток. Подожди немного.');
      }

      throw new Error(serverMessage || `Ошибка проверки (${response.status})`);
    }

    const source = payload?.session?.access_token
      ? payload.session
      : payload;

    const user =
      payload?.user ||
      source?.user ||
      null;

    const session = {
      access_token: source?.access_token,
      refresh_token: source?.refresh_token,
      token_type: source?.token_type || 'Bearer',
      expires_in: source?.expires_in || 3600,
      expires_at: source?.expires_at,
      user
    };

    const saved = saveSession(session);

    // Hydrate PokerSwipeAuth's in-memory token/user from the same stored session.
    let hydrated = saved;
    if (window.PokerSwipeAuth?.getCurrentSession) {
      try {
        hydrated = await withTimeout(
          window.PokerSwipeAuth.getCurrentSession(),
          10000,
          'Сохранение сессии'
        ) || saved;
      } catch (e) {
        log('Session hydration warning', e);
      }
    }

    return {
      ok: true,
      session: hydrated,
      user: hydrated?.user || saved.user
    };
  };

  const sendCodeFromEmailScreen = async () => {
    const input = document.getElementById('authEmailInput');
    const email = normalizeEmail(input?.value);

    clearMessage('authEmailError');

    if (!validEmail(email)) {
      setError('authEmailError', 'Введи корректный email.');
      input?.focus();
      return;
    }

    currentEmail = email;
    setButtonLoading(
      'authEmailSendBtn',
      true,
      'ПОЛУЧИТЬ КОД',
      'ОТПРАВЛЯЮ…'
    );

    try {
      await requestEmailCode(email);
      showOtpEntry(email);
    } catch (e) {
      console.error('[AuthBootstrap] OTP request failed', e);
      const msg = String(e?.message || '');
      if (/429|rate/i.test(msg)) {
        setError('authEmailError', 'Код уже отправлен. Подожди минуту и попробуй снова.');
      } else {
        setError('authEmailError', 'Не удалось отправить код. Проверь интернет и попробуй ещё раз.');
      }
    } finally {
      setButtonLoading(
        'authEmailSendBtn',
        false,
        'ПОЛУЧИТЬ КОД',
        'ОТПРАВЛЯЮ…'
      );
    }
  };

  const handleVerifyCode = async () => {
    const input = document.getElementById('authOtpInput');
    const code = String(input?.value || '').replace(/\D/g, '');

    clearMessage('authOtpError');
    clearMessage('authOtpInfo');

    if (code.length < 6 || code.length > 8) {
      setError('authOtpError', 'Введи код из письма.');
      input?.focus();
      return;
    }

    setButtonLoading(
      'authOtpVerifyBtn',
      true,
      'ВОЙТИ',
      'ПРОВЕРЯЮ…'
    );

    try {
      const authResult = await verifyEmailCode(currentEmail, code);
      await showSuccess(authResult);
    } catch (e) {
      console.error('[AuthBootstrap] OTP verify failed', e);
      setError(
        'authOtpError',
        e?.message || 'Не удалось проверить код. Попробуй ещё раз.'
      );
      input?.select();
    } finally {
      setButtonLoading(
        'authOtpVerifyBtn',
        false,
        'ВОЙТИ',
        'ПРОВЕРЯЮ…'
      );
    }
  };

  const handleResendCode = async () => {
    if (!currentEmail) {
      showEmailEntry();
      return;
    }

    clearMessage('authOtpError');
    clearMessage('authOtpInfo');

    setButtonLoading(
      'authOtpResendBtn',
      true,
      'ОТПРАВИТЬ КОД ЕЩЁ РАЗ',
      'ОТПРАВЛЯЮ…'
    );

    try {
      await requestEmailCode(currentEmail);
      const info = document.getElementById('authOtpInfo');
      if (info) {
        info.textContent = 'Новый код отправлен.';
        info.classList.remove('hidden');
      }
      document.getElementById('authOtpInput')?.focus();
    } catch (e) {
      console.error('[AuthBootstrap] OTP resend failed', e);
      setError(
        'authOtpError',
        'Не удалось отправить новый код. Подожди немного и попробуй снова.'
      );
    } finally {
      setButtonLoading(
        'authOtpResendBtn',
        false,
        'ОТПРАВИТЬ КОД ЕЩЁ РАЗ',
        'ОТПРАВЛЯЮ…'
      );
    }
  };

  const bindEvents = () => {
    const emailInput = document.getElementById('authEmailInput');
    const emailSend = document.getElementById('authEmailSendBtn');
    const otpInput = document.getElementById('authOtpInput');
    const verifyBtn = document.getElementById('authOtpVerifyBtn');
    const resendBtn = document.getElementById('authOtpResendBtn');
    const changeEmail = document.getElementById('authOtpChangeEmail');

    if (emailInput && emailInput.dataset.bound !== '1') {
      emailInput.dataset.bound = '1';
      emailInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') sendCodeFromEmailScreen();
      });
    }

    if (emailSend && emailSend.dataset.bound !== '1') {
      emailSend.dataset.bound = '1';
      emailSend.addEventListener('click', sendCodeFromEmailScreen);
    }

    if (otpInput && otpInput.dataset.bound !== '1') {
      otpInput.dataset.bound = '1';
      otpInput.addEventListener('input', () => {
        otpInput.value = otpInput.value.replace(/\D/g, '').slice(0, 8);
        clearMessage('authOtpError');
      });
      otpInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') handleVerifyCode();
      });
    }

    if (verifyBtn && verifyBtn.dataset.bound !== '1') {
      verifyBtn.dataset.bound = '1';
      verifyBtn.addEventListener('click', handleVerifyCode);
    }

    if (resendBtn && resendBtn.dataset.bound !== '1') {
      resendBtn.dataset.bound = '1';
      resendBtn.addEventListener('click', handleResendCode);
    }

    if (changeEmail && changeEmail.dataset.bound !== '1') {
      changeEmail.dataset.bound = '1';
      changeEmail.addEventListener('click', e => {
        e.preventDefault();
        showEmailEntry();
      });
    }
  };

  const processLegacyMagicLink = async params => {
    const token = params?.access_token;
    const userInfo = decodeJWT(token);

    if (!token || !userInfo?.id) {
      cleanCallbackUrl();
      showEmailEntry('Старая ссылка входа недействительна. Получи код.');
      return;
    }

    const expiresIn = Number(params.expires_in) > 0
      ? Number(params.expires_in)
      : 3600;

    let expiresAt = Number(params.expires_at);
    if (!Number.isFinite(expiresAt) || expiresAt <= 0) {
      expiresAt = Math.floor(Date.now() / 1000) + expiresIn;
    }

    const saved = saveSession({
      access_token: token,
      refresh_token: params.refresh_token || null,
      token_type: params.token_type || 'Bearer',
      expires_in: expiresIn,
      expires_at: expiresAt,
      user: {
        id: userInfo.id,
        email: userInfo.email
      }
    });

    cleanCallbackUrl();

    let hydrated = saved;
    if (window.PokerSwipeAuth?.getCurrentSession) {
      try {
        hydrated = await withTimeout(
          window.PokerSwipeAuth.getCurrentSession(),
          10000,
          'Восстановление входа'
        ) || saved;
      } catch (_) {}
    }

    await showSuccess({
      session: hydrated,
      user: hydrated.user
    });
  };

  const bootstrap = async () => {
    injectStyles();
    ensureEmailScreen();
    ensureOtpScreen();
    ensureSuccessScreen();
    bindEvents();

    hideBootLayer();

    if (!window.PokerSwipeAuth) {
      showEmailEntry('Модуль входа не загрузился. Обнови страницу.');
      return;
    }

    const params = getAuthParams();

    // Backward compatibility while old magic-link emails can still exist.
    if (params.access_token) {
      try {
        await processLegacyMagicLink(params);
      } catch (e) {
        console.error('[AuthBootstrap] Legacy callback failed', e);
        localStorage.removeItem('pokerswipe_auth_session');
        cleanCallbackUrl();
        showEmailEntry('Ссылка входа не сработала. Получи новый код.');
      }
      return;
    }

    if (params.error || params.error_code || params.error_description) {
      cleanCallbackUrl();
      showEmailEntry('Ссылка устарела. Теперь вход выполняется кодом из письма.');
      return;
    }

    try {
      const authData = await withTimeout(
        window.PokerSwipeAuth.init(),
        10000,
        'Проверка сессии'
      );

      if (authData?.session && authData?.user?.id) {
        await completeAuth(authData);
        return;
      }

      showEmailEntry();
    } catch (e) {
      console.error('[AuthBootstrap] Session restore failed', e);
      showEmailEntry('Не удалось восстановить прошлый вход. Введи почту.');
    }
  };

  window.PokerSwipeAuthBootstrap = {
    bootstrap,
    showEmailEntry,
    showOtpEntry,
    showHome,
    showAssessment,
    getState: () => authState,
    getEmail: () => currentEmail
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap, { once: true });
  } else {
    bootstrap();
  }
})();
