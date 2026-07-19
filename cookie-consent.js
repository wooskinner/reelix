/**
 * Reelix - Cookie Consent Banner
 * Self-contained: injects its own styles and markup, so pages only need
 * to include this one script. Stores the user's choice in localStorage
 * under 'reelix-cookie-consent' ('accepted' | 'declined').
 *
 * Only essential cookies (auth/session, trial/subscription status) run
 * regardless of choice, since the service can't function without them.
 * Any future non-essential script (analytics, etc.) should check
 * window.reelixConsentGiven() before loading, e.g.:
 *
 *   if (window.reelixConsentGiven()) {
 *     // load analytics
 *   } else {
 *     document.addEventListener('reelix-cookie-consent', (e) => {
 *       if (e.detail === 'accepted') { / * load analytics * / }
 *     });
 *   }
 */
(function () {
  const STORAGE_KEY = 'reelix-cookie-consent';

  window.reelixConsentGiven = function () {
    try {
      return localStorage.getItem(STORAGE_KEY) === 'accepted';
    } catch (e) {
      return false;
    }
  };

  function getChoice() {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
  }

  function setChoice(value) {
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch (e) {}
    document.dispatchEvent(new CustomEvent('reelix-cookie-consent', { detail: value }));
  }

  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .reelix-cookie-banner {
        position: fixed;
        left: 16px;
        right: 16px;
        bottom: 16px;
        z-index: 10000;
        max-width: 560px;
        margin: 0 auto;
        background: rgba(20, 14, 32, 0.97);
        border: 1px solid rgba(227,184,115,.2);
        border-radius: 14px;
        padding: 18px 20px;
        box-shadow: 0 12px 40px rgba(0,0,0,.4);
        backdrop-filter: blur(12px);
        font-family: 'Manrope', 'Josefin Sans', sans-serif;
        display: flex;
        flex-direction: column;
        gap: 12px;
        animation: reelix-cookie-in .3s ease;
      }
      @keyframes reelix-cookie-in {
        from { opacity: 0; transform: translateY(12px); }
        to { opacity: 1; transform: translateY(0); }
      }
      .reelix-cookie-banner p {
        margin: 0;
        font-size: 13px;
        line-height: 1.6;
        color: rgba(246,241,233,.85);
      }
      .reelix-cookie-banner a {
        color: #F3D6A0;
        text-decoration: underline;
      }
      .reelix-cookie-actions {
        display: flex;
        gap: 10px;
        flex-wrap: wrap;
      }
      .reelix-cookie-btn {
        flex: 1;
        min-width: 100px;
        padding: 9px 16px;
        border-radius: 8px;
        font-size: 13px;
        font-weight: 600;
        cursor: pointer;
        border: 1px solid rgba(227,184,115,.3);
        background: transparent;
        color: rgba(246,241,233,.85);
        transition: background .2s, border-color .2s;
      }
      .reelix-cookie-btn:hover {
        border-color: #E3B873;
      }
      .reelix-cookie-btn.reelix-cookie-accept {
        background: #E3B873;
        color: #170F26;
        border-color: #E3B873;
      }
      .reelix-cookie-btn.reelix-cookie-accept:hover {
        background: #F3D6A0;
      }
      @media (max-width: 480px) {
        .reelix-cookie-banner { left: 10px; right: 10px; bottom: 10px; padding: 16px; }
      }
    `;
    document.head.appendChild(style);
  }

  function showBanner() {
    injectStyles();

    const banner = document.createElement('div');
    banner.className = 'reelix-cookie-banner';
    banner.setAttribute('role', 'dialog');
    banner.setAttribute('aria-label', 'Cookie consent');
    banner.innerHTML = `
      <p>We use essential cookies to keep you signed in and remember your subscription status, plus optional analytics cookies to improve Reelix. See our <a href="cookies.html">Cookie Policy</a>.</p>
      <div class="reelix-cookie-actions">
        <button class="reelix-cookie-btn reelix-cookie-decline" type="button">Decline</button>
        <button class="reelix-cookie-btn reelix-cookie-accept" type="button">Accept</button>
      </div>
    `;
    document.body.appendChild(banner);

    banner.querySelector('.reelix-cookie-accept').addEventListener('click', function () {
      setChoice('accepted');
      banner.remove();
    });
    banner.querySelector('.reelix-cookie-decline').addEventListener('click', function () {
      setChoice('declined');
      banner.remove();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    if (!getChoice()) {
      showBanner();
    }
  });
})();
