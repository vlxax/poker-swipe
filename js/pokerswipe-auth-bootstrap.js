// PokerSwipe Auth Bootstrap — Initialize auth flow on page load
// Handles Welcome → Email → OTP → Profile → Assessment → Home

(function() {
  'use strict';

  let currentEmail = '';
  let authState = 'INITIALIZING'; // INITIALIZING, WELCOME, EMAIL, OTP, AUTHENTICATED, ASSESSMENT, HOME

  const log = (msg, data) => {
    if (window.DEBUG_AUTH) console.log('[AuthBootstrap]', msg, data || '');
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

  // Create OTP input fields
  const initOTPInputs = () => {
    const container = document.getElementById('authOTPInputs');
    if (!container) return;
    container.innerHTML = '';
    for (let i = 0; i < 6; i++) {
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = '1';
      input.class = 'pokerswipe-auth-otp-input';
      input.classList.add('pokerswipe-auth-otp-input');
      input.setAttribute('data-index', i);
      input.inputMode = 'numeric';
      input.autocomplete = 'off';
      input.addEventListener('input', (e) => {
        if (e.target.value && e.target.value.match(/\D/)) {
          e.target.value = '';
          return;
        }
        if (e.target.value && i < 5) {
          const next = container.querySelector(`[data-index="${i + 1}"]`);
          if (next) next.focus();
        }
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !e.target.value && i > 0) {
          const prev = container.querySelector(`[data-index="${i - 1}"]`);
          if (prev) prev.focus();
        }
      });
      container.appendChild(input);
    }
  };

  // Get OTP value
  const getOTPValue = () => {
    const inputs = document.querySelectorAll('.pokerswipe-auth-otp-input');
    return Array.from(inputs).map(el => el.value).join('');
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
        if (btnId === 'authEmailSendBtn') btn.textContent = 'ОТПРАВИТЬ КОД';
        if (btnId === 'authOTPVerifyBtn') btn.textContent = 'ПОДТВЕРДИТЬ';
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
      showSuccess('authEmail', 'Проверь почту! Отправили код.');
      document.getElementById('authOTPEmail').textContent = `Код отправлен на ${email}`;
      setTimeout(() => showScreen('authOTP'), 800);
    } catch (e) {
      log('Email error:', e);
      showError('authEmail', 'Ошибка: ' + (e.message || 'Не удалось отправить'));
    } finally {
      setLoading('authEmailSendBtn', false);
    }
  };

  // Handle OTP submission
  const handleOTPSubmit = async () => {
    const otp = getOTPValue();
    if (otp.length !== 6) {
      showError('authOTP', 'Введи все 6 цифр');
      return;
    }

    setLoading('authOTPVerifyBtn', true);

    try {
      const result = await window.PokerSwipeAuth.verifyOTP(currentEmail, otp);
      showSuccess('authOTP', 'Вошли успешно!');
      log('OTP verified:', result.user);
      setTimeout(() => completeAuth(result), 800);
    } catch (e) {
      log('OTP error:', e);
      showError('authOTP', 'Неверный код. Попробуй снова.');
    } finally {
      setLoading('authOTPVerifyBtn', false);
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
    document.getElementById('onboarding').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
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
    document.getElementById('onboarding').classList.add('hidden');
    document.getElementById('mainApp').classList.remove('hidden');
    // Show diagnostic assessment
    if (typeof window.renderDiagnostic === 'function') {
      window.renderDiagnostic();
    }
  };

  // Show welcome screen
  const showWelcome = () => {
    authState = 'WELCOME';
    document.getElementById('onboarding').classList.add('hidden');
    showScreen('authWelcome');
  };

  // Show email screen
  const showEmailEntry = () => {
    authState = 'EMAIL';
    currentEmail = '';
    document.getElementById('authEmailInput').value = '';
    document.getElementById('authEmailInput').focus();
    document.getElementById('authEmailError').classList.add('hidden');
    document.getElementById('authEmailSuccess').classList.add('hidden');
    showScreen('authEmail');
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

    // OTP screen
    initOTPInputs();

    const otpVerifyBtn = document.getElementById('authOTPVerifyBtn');
    if (otpVerifyBtn) {
      otpVerifyBtn.addEventListener('click', handleOTPSubmit);
    }

    const backToEmail = document.getElementById('authBackToEmail');
    if (backToEmail) {
      backToEmail.addEventListener('click', (e) => {
        e.preventDefault();
        showEmailEntry();
      });
    }
  };

  // Main bootstrap function
  const bootstrap = async () => {
    log('Starting auth bootstrap');

    // Wait for PokerSwipeAuth to be available
    if (!window.PokerSwipeAuth) {
      console.error('[AuthBootstrap] PokerSwipeAuth not available');
      document.getElementById('bootStatus').textContent = 'Ошибка: Auth модуль не загружен';
      return;
    }

    // Bind events early
    bindEvents();

    // Initialize auth system
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
