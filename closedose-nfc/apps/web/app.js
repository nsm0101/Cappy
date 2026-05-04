/* ================================================================
   CAPPY — Application JavaScript
   Theme: System / Day (light) / Night (dark)
     - Stored in localStorage as 'cappy-theme'
     - Applied to <html data-theme="..."> immediately on load
     - System mode removes data-theme and relies on @media CSS
   ================================================================ */

(function () {
  'use strict';

  /* ── Theme ──────────────────────────────────────────────────── */
  const STORAGE_KEY = 'cappy-theme';
  const VALID_THEMES = ['system', 'light', 'dark'];

  function getSavedTheme() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return VALID_THEMES.includes(saved) ? saved : 'system';
    } catch {
      return 'system';
    }
  }

  function applyTheme(theme) {
    const html = document.documentElement;
    if (theme === 'system') {
      html.removeAttribute('data-theme');
    } else {
      html.setAttribute('data-theme', theme);
    }

    // Update all theme button sets
    document.querySelectorAll('[data-theme-value]').forEach(btn => {
      const isActive = btn.dataset.themeValue === theme;
      btn.classList.toggle('active', isActive);
      btn.setAttribute('aria-pressed', String(isActive));
    });

    // Persist
    try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* noop */ }
  }

  // Apply immediately to avoid flash of wrong theme
  applyTheme(getSavedTheme());

  /* ── DOM Ready ──────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', () => {

    /* Theme buttons (all contexts: desktop strip + hamburger menu) */
    document.querySelectorAll('[data-theme-value]').forEach(btn => {
      btn.addEventListener('click', () => applyTheme(btn.dataset.themeValue));
    });

    /* Keep in sync with OS changes when in System mode */
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', () => {
      if (getSavedTheme() === 'system') applyTheme('system');
    });

    /* ── Hamburger / Mobile Menu ──────────────────────────────── */
    const hamburger   = document.getElementById('hamburger');
    const menuPanel   = document.getElementById('mobileMenu');
    const backdrop    = document.getElementById('menuBackdrop');
    const menuClose   = document.getElementById('menuClose');

    function openMenu() {
      menuPanel.classList.add('open');
      backdrop.classList.add('open');
      hamburger.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      menuClose.focus();
    }

    function closeMenu() {
      menuPanel.classList.remove('open');
      backdrop.classList.remove('open');
      hamburger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      hamburger.focus();
    }

    hamburger?.addEventListener('click', openMenu);
    menuClose?.addEventListener('click', closeMenu);
    backdrop?.addEventListener('click', closeMenu);

    // Close menu on nav link click
    document.querySelectorAll('.menu-link').forEach(link => {
      link.addEventListener('click', closeMenu);
    });

    // Keyboard: Escape closes menu
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && menuPanel?.classList.contains('open')) {
        closeMenu();
      }
    });

    // Trap focus inside menu when open
    menuPanel?.addEventListener('keydown', (e) => {
      if (e.key !== 'Tab') return;
      const focusable = Array.from(
        menuPanel.querySelectorAll('a, button, input, select, [tabindex]:not([tabindex="-1"])')
      ).filter(el => !el.disabled);
      if (!focusable.length) return;
      const first = focusable[0];
      const last  = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault(); last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault(); first.focus();
      }
    });

    /* ── Header scroll shadow ──────────────────────────────────── */
    const header = document.getElementById('header');
    const onScroll = () => {
      header?.classList.toggle('scrolled', window.scrollY > 8);
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    /* ── Unit toggle (kg / lbs) ───────────────────────────────── */
    let currentUnit = 'kg';
    const weightInput = document.getElementById('weightInput');

    document.querySelectorAll('.unit-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const newUnit = btn.dataset.unit;
        if (newUnit === currentUnit) return;

        // Convert existing value
        const val = parseFloat(weightInput.value);
        if (!isNaN(val) && val > 0) {
          weightInput.value = newUnit === 'lbs'
            ? (val * 2.20462).toFixed(1)
            : (val / 2.20462).toFixed(2);
        }

        currentUnit = newUnit;
        document.querySelectorAll('.unit-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.unit === newUnit);
        });
      });
    });

    /* ── Dose Calculator ──────────────────────────────────────── */
    const calcBtn   = document.getElementById('calcBtn');
    const medSelect = document.getElementById('medSelect');
    const resultBox = document.getElementById('resultBox');
    const resultDose = document.getElementById('resultDose');
    const resultMeta = document.getElementById('resultMeta');

    calcBtn?.addEventListener('click', () => {
      const rawWeight = parseFloat(weightInput?.value);
      const selected  = medSelect?.options[medSelect.selectedIndex];

      // Validation
      if (!rawWeight || rawWeight <= 0) {
        shakeElement(weightInput);
        weightInput?.focus();
        return;
      }
      if (!medSelect?.value) {
        shakeElement(medSelect);
        medSelect?.focus();
        return;
      }

      // Convert to kg if needed
      const weightKg = currentUnit === 'lbs' ? rawWeight / 2.20462 : rawWeight;

      const dosePerKg = parseFloat(selected.dataset.dose);
      const maxDose   = parseFloat(selected.dataset.max);
      const unit      = selected.dataset.unit;
      const interval  = selected.dataset.interval;

      const calculated = weightKg * dosePerKg;
      const finalDose  = Math.min(calculated, maxDose);
      const capped     = calculated > maxDose;

      resultDose.textContent = `${finalDose.toFixed(1)} ${unit}`;
      resultMeta.textContent = `Based on ${weightKg.toFixed(1)} kg · ${interval}` +
        (capped ? ` · dose capped at ${maxDose} ${unit} maximum` : '');

      resultBox.hidden = false;
      resultBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });

    // Recalculate on Enter in weight field
    weightInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') calcBtn?.click();
    });

    /* ── NFC Scan (simulated) ─────────────────────────────────── */
    const nfcBtn       = document.getElementById('nfcBtn');
    const verifyStatus = document.getElementById('verifyStatus');

    nfcBtn?.addEventListener('click', async () => {
      // Check Web NFC API availability
      if ('NDEFReader' in window) {
        await scanNFC();
      } else {
        simulateScan();
      }
    });

    async function scanNFC() {
      nfcBtn.disabled = true;
      nfcBtn.textContent = 'Scanning…';
      setVerifyStatus('info', 'Hold your device near the cap…');

      try {
        const reader = new window.NDEFReader();
        await reader.scan();
        reader.onreading = ({ serialNumber, message }) => {
          const records = message.records;
          const urlRecord = records.find(r => r.recordType === 'url');
          setVerifyStatus('success', `✓ Cap verified — Serial ${serialNumber.slice(-8).toUpperCase()}`);
          nfcBtn.disabled = false;
          nfcBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg> Scan Cap';
        };
        reader.onerror = () => {
          setVerifyStatus('error', '✗ NFC read error. Try again.');
          resetNfcBtn();
        };
      } catch (err) {
        if (err.name === 'NotAllowedError') {
          setVerifyStatus('error', 'NFC permission denied. Check browser settings.');
        } else {
          simulateScan();
        }
        resetNfcBtn();
      }
    }

    function simulateScan() {
      nfcBtn.disabled = true;
      setVerifyStatus('info', 'Scanning…');

      setTimeout(() => {
        setVerifyStatus('success', '✓ Cap verified — Signature valid (demo mode)');
        resetNfcBtn();
      }, 1800);
    }

    function resetNfcBtn() {
      nfcBtn.disabled = false;
      nfcBtn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/></svg> Scan Cap';
    }

    function setVerifyStatus(type, message) {
      if (!verifyStatus) return;
      verifyStatus.textContent = message;
      verifyStatus.className = 'verify-status';
      if (type !== 'info') verifyStatus.classList.add(type);
    }

    /* ── Cappy button easter egg ─────────────────────────────── */
    const cappyBtn = document.getElementById('cappyBtn');
    const greetings = [
      'Hi there! 👋', "Let's check your meds!", 'Tap to verify your cap!',
      'Staying healthy? Good job! 💊', 'Time for your dose?', "I'm Cappy, your med pal!"
    ];
    let greetIdx = 0;

    cappyBtn?.addEventListener('click', () => {
      const msg = greetings[greetIdx % greetings.length];
      greetIdx++;

      // Show floating toast
      showToast(msg);
    });

    /* ── Toast notification ──────────────────────────────────── */
    function showToast(message) {
      const existing = document.getElementById('cappy-toast');
      if (existing) existing.remove();

      const toast = document.createElement('div');
      toast.id = 'cappy-toast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      toast.textContent = message;
      toast.style.cssText = `
        position: fixed;
        bottom: calc(env(safe-area-inset-bottom, 0px) + 1.5rem);
        left: 50%;
        transform: translateX(-50%) translateY(20px);
        background: var(--surface);
        color: var(--text);
        border: 1px solid var(--border);
        padding: 0.75rem 1.5rem;
        border-radius: 9999px;
        font-size: 0.9rem;
        font-weight: 600;
        box-shadow: 0 8px 24px rgba(0,0,0,0.2);
        z-index: 9999;
        opacity: 0;
        transition: opacity 0.2s ease, transform 0.2s ease;
        white-space: nowrap;
        max-width: calc(100vw - 2rem);
        text-align: center;
        font-family: inherit;
      `;
      document.body.appendChild(toast);

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          toast.style.opacity = '1';
          toast.style.transform = 'translateX(-50%) translateY(0)';
        });
      });

      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(-50%) translateY(10px)';
        setTimeout(() => toast.remove(), 250);
      }, 2500);
    }

    /* ── Smooth scroll for hash links ────────────────────────── */
    document.querySelectorAll('a[href^="#"]').forEach(link => {
      link.addEventListener('click', (e) => {
        const target = document.querySelector(link.getAttribute('href'));
        if (target) {
          e.preventDefault();
          const top = target.getBoundingClientRect().top + window.scrollY
                    - parseInt(getComputedStyle(document.documentElement)
                        .getPropertyValue('--header-h') || '64', 10) - 8;
          window.scrollTo({ top, behavior: 'smooth' });
        }
      });
    });

    /* ── Active nav link on scroll ──────────────────────────── */
    const sections = document.querySelectorAll('section[id]');
    const navLinks  = document.querySelectorAll('.nav-link');

    const observerOpts = {
      rootMargin: `-${parseInt(getComputedStyle(document.documentElement)
        .getPropertyValue('--header-h') || '64', 10) + 20}px 0px -50% 0px`
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          navLinks.forEach(link => {
            link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`);
          });
        }
      });
    }, observerOpts);

    sections.forEach(s => observer.observe(s));

  }); // end DOMContentLoaded

  /* ── Utility: shake animation on invalid input ─────────────── */
  function shakeElement(el) {
    if (!el) return;
    el.style.animation = 'none';
    el.offsetHeight; // reflow
    el.style.animation = 'shake 0.35s ease';
    el.addEventListener('animationend', () => { el.style.animation = ''; }, { once: true });
  }

  // Inject shake keyframes once
  const style = document.createElement('style');
  style.textContent = `
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      20%       { transform: translateX(-5px); }
      40%       { transform: translateX(5px); }
      60%       { transform: translateX(-4px); }
      80%       { transform: translateX(4px); }
    }
    .nav-link.active {
      color: var(--clr-accent) !important;
    }
    .header.scrolled {
      box-shadow: 0 1px 8px rgba(0,0,0,0.12);
    }
    .verify-status.info {
      color: var(--text-secondary);
    }
  `;
  document.head.appendChild(style);

})();
