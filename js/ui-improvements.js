/**
 * Reelix - Shared UI Improvements
 * Load this on all pages
 */

// ──────────────────────────────────────────────
// LOADING SKELETON
// ──────────────────────────────────────────────

function showSkeleton(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.classList.remove('hidden');
}

function hideSkeleton(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  el.classList.add('hidden');
}

// ──────────────────────────────────────────────
// ERROR COMPONENT
// ──────────────────────────────────────────────

function showError(title, message, actions = null) {
  // Check if error container exists, if not create it
  let container = document.getElementById('error-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'error-container';
    container.className = 'error-container';
    container.style.display = 'none';
    
    container.innerHTML = `
      <div class="error-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span class="error-title" id="error-title">Something Went Wrong</span>
      </div>
      <div class="error-message" id="error-message"></div>
      <div class="error-actions" id="error-actions"></div>
    `;
    
    // Insert at the top of the card or body
    const card = document.querySelector('.card') || document.body;
    card.insertBefore(container, card.firstChild);
  }
  
  document.getElementById('error-title').textContent = title || 'Something Went Wrong';
  document.getElementById('error-message').textContent = message || 'We couldn\'t complete your request. Please try again.';
  
  const actionsContainer = document.getElementById('error-actions');
  actionsContainer.innerHTML = '';
  
  if (actions && actions.length) {
    actions.forEach(action => {
      const btn = document.createElement('button');
      btn.className = `error-btn ${action.primary ? 'primary' : ''}`;
      btn.innerHTML = action.icon ? `${action.icon} ${action.label}` : action.label;
      btn.onclick = action.onClick;
      actionsContainer.appendChild(btn);
    });
  } else {
    // Default actions
    const defaultActions = [
      { label: '🔄 Retry', onClick: () => location.reload(), primary: true },
      { label: '🏠 Home', onClick: () => window.location.href = 'index.html' }
    ];
    defaultActions.forEach(action => {
      const btn = document.createElement('button');
      btn.className = `error-btn ${action.primary ? 'primary' : ''}`;
      btn.textContent = action.label;
      btn.onclick = action.onClick;
      actionsContainer.appendChild(btn);
    });
  }
  
  container.style.display = 'block';
}

function hideError() {
  const container = document.getElementById('error-container');
  if (container) container.style.display = 'none';
}

// ──────────────────────────────────────────────
// COUNTDOWN TIMER
// ──────────────────────────────────────────────

class CountdownTimer {
  constructor(options = {}) {
    this.duration = options.duration || 30;
    this.onComplete = options.onComplete || null;
    this.onTick = options.onTick || null;
    this.containerId = options.containerId || 'countdown-container';
    this.remaining = this.duration;
    this.interval = null;
  }
  
  init() {
    const container = document.getElementById(this.containerId);
    if (!container) return;
    
    container.innerHTML = `
      <div class="countdown-text">
        <span>Auto-retry in</span>
        <span class="countdown-number" id="countdown-number">${this.duration}</span>
        <span>seconds</span>
      </div>
      <div class="countdown-bar">
        <div class="countdown-fill" id="countdown-fill" style="width:100%"></div>
      </div>
      <button class="countdown-retry-btn" onclick="window.countdownTimer?.retry()">
        <svg viewBox="0 0 24 24"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
        Retry Now
      </button>
    `;
    
    this.start();
  }
  
  start() {
    this.remaining = this.duration;
    this.updateDisplay();
    
    clearInterval(this.interval);
    this.interval = setInterval(() => {
      this.remaining--;
      this.updateDisplay();
      
      if (this.onTick) this.onTick(this.remaining);
      
      if (this.remaining <= 0) {
        clearInterval(this.interval);
        if (this.onComplete) this.onComplete();
      }
    }, 1000);
  }
  
  updateDisplay() {
    const numberEl = document.getElementById('countdown-number');
    const fillEl = document.getElementById('countdown-fill');
    
    if (numberEl) numberEl.textContent = Math.max(0, this.remaining);
    if (fillEl) fillEl.style.width = `${(Math.max(0, this.remaining) / this.duration) * 100}%`;
  }
  
  retry() {
    clearInterval(this.interval);
    this.start();
    if (this.onRetry) this.onRetry();
  }
  
  stop() {
    clearInterval(this.interval);
  }
}

// ──────────────────────────────────────────────
// INSTALL BANNER (PWA)
// ──────────────────────────────────────────────

let deferredPrompt = null;

function initInstallBanner() {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    // Don't show if user already dismissed it
    if (localStorage.getItem('reelix-install-dismissed') === 'true') return;
    showInstallBanner();
  });
  
  window.addEventListener('appinstalled', () => {
    hideInstallBanner();
    deferredPrompt = null;
  });
}

function showInstallBanner() {
  const banner = document.getElementById('install-banner');
  if (!banner) return;

  banner.innerHTML = `
    <div class="install-content">
      <div class="install-icon">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 3v12"/><polyline points="7 10 12 15 17 10"/><path d="M5 19h14"/>
        </svg>
      </div>
      <div class="install-text">
        <strong>Install Reelix</strong>
        <span>Add to your home screen for quick access</span>
      </div>
      <button class="install-btn" id="install-banner-install-btn">Install</button>
      <button class="install-close" id="install-banner-close-btn" aria-label="Dismiss">&times;</button>
    </div>
  `;

  document.getElementById('install-banner-install-btn').onclick = installApp;
  document.getElementById('install-banner-close-btn').onclick = dismissInstall;

  banner.classList.add('show');
}

function hideInstallBanner() {
  const banner = document.getElementById('install-banner');
  if (banner) banner.classList.remove('show');
}

async function installApp() {
  if (!deferredPrompt) { hideInstallBanner(); return; }
  hideInstallBanner();
  deferredPrompt.prompt();
  try {
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      hapticFeedback('success');
    }
  } catch {}
  deferredPrompt = null;
}

function dismissInstall() {
  hideInstallBanner();
  localStorage.setItem('reelix-install-dismissed', 'true');
}

// ──────────────────────────────────────────────
// OFFLINE MODE
// ──────────────────────────────────────────────

function initOfflineBanner() {
  const banner = document.getElementById('offline-banner');
  if (!banner) return;
  
  window.addEventListener('online', () => {
    banner.style.display = 'none';
    showToast('🔄 Back online!');
  });
  
  window.addEventListener('offline', () => {
    banner.style.display = 'block';
    showToast('📡 You are offline. Please check your connection.');
  });
  
  // Check initial state
  if (!navigator.onLine) {
    banner.style.display = 'block';
  }
}

// ──────────────────────────────────────────────
// KEYBOARD SHORTCUTS
// ──────────────────────────────────────────────

function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Don't trigger if typing in input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    // Show shortcuts help with ?
    if (e.key === '?') {
      toggleShortcuts();
    }
    
    // Escape closes modals
    if (e.key === 'Escape') {
      closeShortcuts();
      if (typeof closeModal === 'function') closeModal();
      if (typeof closeTrailer === 'function') closeTrailer();
    }
    
    // Fullscreen on watch page (f key)
    if (e.key === 'f' || e.key === 'F') {
      const iframe = document.getElementById('player-iframe');
      if (iframe) {
        if (iframe.requestFullscreen) {
          iframe.requestFullscreen();
        } else if (iframe.webkitRequestFullscreen) {
          iframe.webkitRequestFullscreen();
        }
      }
    }
  });
}

function toggleShortcuts() {
  const overlay = document.getElementById('shortcuts-overlay');
  if (overlay) {
    overlay.classList.toggle('open');
  }
}

function closeShortcuts() {
  const overlay = document.getElementById('shortcuts-overlay');
  if (overlay) {
    overlay.classList.remove('open');
  }
}

// ──────────────────────────────────────────────
// TOAST NOTIFICATION (Enhanced)
// ──────────────────────────────────────────────

function showToast(message, duration = 3000) {
  let toast = document.getElementById('toast');
  
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  
  toast.textContent = message;
  toast.classList.add('show');
  
  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.classList.remove('show');
  }, duration);
}

// ──────────────────────────────────────────────
// SMOOTH PAGE TRANSITIONS
// ──────────────────────────────────────────────

function initPageTransitions() {
  const style = document.createElement('style');
  style.textContent = `
    body {
      opacity: 0;
      transition: opacity 0.3s ease;
    }
    body.page-loaded {
      opacity: 1;
    }
  `;
  document.head.appendChild(style);

  // This runs from inside a DOMContentLoaded handler, so the DOM is already
  // ready — don't wait on that event again, it already fired. Defer one
  // frame so the injected style is applied first and the fade actually animates.
  requestAnimationFrame(() => {
    document.body.classList.add('page-loaded');
  });
}

// ──────────────────────────────────────────────
// HAPTIC FEEDBACK (Mobile)
// ──────────────────────────────────────────────

function hapticFeedback(style = 'light') {
  if (navigator.vibrate) {
    switch (style) {
      case 'light':
        navigator.vibrate(10);
        break;
      case 'medium':
        navigator.vibrate(20);
        break;
      case 'heavy':
        navigator.vibrate([30, 50, 30]);
        break;
      case 'success':
        navigator.vibrate([30, 80, 30, 80, 30]);
        break;
      case 'error':
        navigator.vibrate([50, 50, 50]);
        break;
      default:
        navigator.vibrate(15);
    }
  }
}

// ──────────────────────────────────────────────
// PULL-TO-REFRESH (Mobile)
// ──────────────────────────────────────────────

let touchStartY = 0;
let isRefreshing = false;

function initPullToRefresh() {
  let container = document.querySelector('.card') || document.body;
  
  container.addEventListener('touchstart', (e) => {
    touchStartY = e.touches[0].clientY;
  }, { passive: true });
  
  container.addEventListener('touchmove', (e) => {
    if (isRefreshing) return;
    if (window.scrollY > 0) return;
    
    const deltaY = e.touches[0].clientY - touchStartY;
    if (deltaY > 80) {
      isRefreshing = true;
      showToast('🔄 Refreshing...');
      setTimeout(() => {
        location.reload();
      }, 500);
    }
  }, { passive: true });
}

// ──────────────────────────────────────────────
// INITIALIZE ALL
// ──────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  initPageTransitions();
  initOfflineBanner();
  initKeyboardShortcuts();
  initInstallBanner();
  initPullToRefresh();
});

// Expose to global scope
window.showError = showError;
window.hideError = hideError;
window.showSkeleton = showSkeleton;
window.hideSkeleton = hideSkeleton;
window.CountdownTimer = CountdownTimer;
window.showToast = showToast;
window.hapticFeedback = hapticFeedback;
window.showInstallBanner = showInstallBanner;
window.hideInstallBanner = hideInstallBanner;
window.installApp = installApp;
window.dismissInstall = dismissInstall;
window.toggleShortcuts = toggleShortcuts;
window.closeShortcuts = closeShortcuts;
