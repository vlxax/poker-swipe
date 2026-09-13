/**
 * PokerSwipe PWA - Install Helper (iOS)
 * Подсказки для установки на главный экран iPhone
 */

(function() {
  'use strict';

  const CONFIG = {
    STORAGE_KEY: 'poker_pwa_install_dismissed',
    TIMESTAMP_KEY: 'poker_pwa_install_last_prompt',
    REMINDER_DAYS: 7
  };

  function shouldShow() {
    if (typeof window.PokerPWA === 'undefined') {
      return false;
    }

    if (!window.PokerPWA.shouldShowInstall()) {
      return false;
    }

    const dismissed = localStorage.getItem(CONFIG.STORAGE_KEY);

    if (dismissed === 'true') {
      const lastPrompt = localStorage.getItem(CONFIG.TIMESTAMP_KEY);

      if (lastPrompt) {
        const daysPassed =
          (Date.now() - parseInt(lastPrompt)) /
          (1000 * 60 * 60 * 24);

        if (daysPassed < CONFIG.REMINDER_DAYS) {
          return false;
        }
      }
    }

    return true;
  }

  function createInstallPrompt() {
    if (document.querySelector('.poker-pwa-prompt')) {
      return;
    }

    const template = `
      <div class="poker-pwa-prompt" role="alert" aria-label="Установка приложения">
        <div class="poker-pwa-prompt-inner">
          <div class="poker-pwa-prompt-header">
            <span class="poker-pwa-prompt-icon">♠️</span>
            <span class="poker-pwa-prompt-title">PokerSwipe</span>

            <button class="poker-pwa-prompt-close" aria-label="Закрыть">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>

          <p class="poker-pwa-prompt-text">
            Добавьте PokerSwipe на экран Домой для удобной игры
          </p>

          <button class="poker-pwa-prompt-button">
            Как установить
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', template);
    bindEvents();
  }

  function bindEvents() {
    const prompt = document.querySelector('.poker-pwa-prompt');
    if (!prompt) return;

    const closeBtn = prompt.querySelector('.poker-pwa-prompt-close');
    const installBtn = prompt.querySelector('.poker-pwa-prompt-button');

    if (closeBtn) {
      closeBtn.addEventListener('click', function(e) {
        e.preventDefault();
        dismissPrompt();
      });
    }

    if (installBtn) {
      installBtn.addEventListener('click', function(e) {
        e.preventDefault();
        showInstructions();
      });
    }
  }

  function dismissPrompt() {
    const prompt = document.querySelector('.poker-pwa-prompt');

    if (prompt) {
      prompt.classList.add('poker-pwa-prompt-hidden');

      setTimeout(() => {
        if (prompt.parentNode) {
          prompt.remove();
        }
      }, 300);
    }

    localStorage.setItem(CONFIG.STORAGE_KEY, 'true');
    localStorage.setItem(CONFIG.TIMESTAMP_KEY, Date.now().toString());
  }

  function showInstructions() {
    const oldModal = document.querySelector('.poker-pwa-modal');

    if (oldModal) oldModal.remove();

    const modalHTML = `
      <div class="poker-pwa-modal" role="dialog" aria-modal="true">
        <div class="poker-pwa-modal-overlay"></div>

        <div class="poker-pwa-modal-content">
          <button class="poker-pwa-modal-close" aria-label="Закрыть">
            <svg width="24" height="24" viewBox="0 0 24 24"
                 fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>

          <div class="poker-pwa-modal-icon">📱</div>

          <h2 class="poker-pwa-modal-title">
            Установка на iPhone
          </h2>

          <ol class="poker-pwa-modal-steps">
            <li>Нажмите <strong>«Поделиться»</strong> в Safari</li>
            <li>Выберите <strong>«На экран Домой»</strong></li>
            <li>Нажмите <strong>«Добавить»</strong></li>
          </ol>

          <p class="poker-pwa-modal-note">
            После установки приложение будет открываться без браузера
          </p>

          <button class="poker-pwa-modal-done">
            Понятно
          </button>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);
    bindModalEvents();

    localStorage.setItem(CONFIG.STORAGE_KEY, 'true');
    localStorage.setItem(CONFIG.TIMESTAMP_KEY, Date.now().toString());
  }

  function bindModalEvents() {
    const modal = document.querySelector('.poker-pwa-modal');
    if (!modal) return;

    const closeModal = function() {
      modal.classList.add('poker-pwa-modal-hidden');

      setTimeout(() => {
        if (modal.parentNode) {
          modal.remove();
        }
      }, 300);
    };

    const closeBtn = modal.querySelector('.poker-pwa-modal-close');
    const doneBtn = modal.querySelector('.poker-pwa-modal-done');
    const overlay = modal.querySelector('.poker-pwa-modal-overlay');

    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (doneBtn) doneBtn.addEventListener('click', closeModal);
    if (overlay) overlay.addEventListener('click', closeModal);

    document.addEventListener('keydown', function handler(e) {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', handler);
      }
    });
  }

  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function() {
        if (shouldShow()) {
          createInstallPrompt();
        }
      });
    } else {
      if (shouldShow()) {
        createInstallPrompt();
      }
    }
  }

  init();

})();
