/**
 * localization.js
 *
 * <localization-form>
 *   - Wraps the Shopify-generated <form>; submitting any radio/select/button
 *     inside automatically posts the form (Shopify reloads with the new locale
 *     or country).
 *   - On first load, if the visitor's timezone is `Asia/Kolkata` and the
 *     current country is not IN, shows a dismissible suggestion banner with a
 *     30-day cooldown cookie.
 */

const SUGGEST_COOKIE = 'zlx_loc_suggestion_dismissed';
const COOKIE_DAYS = 30;

class LocalizationForm extends HTMLElement {
  connectedCallback() {
    this.form = this.querySelector('form');
    if (!this.form) return;
    this._attachAutoSubmit();
  }

  _attachAutoSubmit() {
    // Buttons in the panel already submit on click; we only need this hook
    // for cases where someone wires a select-driven variant later.
    this.querySelectorAll('select[name="country_code"], select[name="locale_code"]').forEach((sel) => {
      sel.addEventListener('change', () => {
        if (typeof this.form.requestSubmit === 'function') {
          this.form.requestSubmit();
        } else {
          this.form.submit();
        }
      });
    });
  }
}

if (!customElements.get('localization-form')) {
  customElements.define('localization-form', LocalizationForm);
}

// ---- Indian-visitor suggestion banner ----
function readCookie(name) {
  const m = document.cookie.match(new RegExp('(^|; )' + name.replace(/[$()*+./?[\\\]^{|}]/g, '\\$&') + '=([^;]*)'));
  return m ? decodeURIComponent(m[2]) : null;
}
function writeCookie(name, value, days) {
  const d = new Date();
  d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${d.toUTCString()}; path=/; SameSite=Lax`;
}

function maybeSuggestIndia() {
  if (readCookie(SUGGEST_COOKIE)) return;
  let tz = '';
  try { tz = Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch { return; }
  if (tz !== 'Asia/Kolkata') return;

  const currentCountry = window.Shopify?.country || document.documentElement.dataset.country || '';
  if (currentCountry === 'IN') return;

  const banner = document.createElement('div');
  banner.className = 'loc-suggest';
  banner.setAttribute('role', 'status');
  banner.innerHTML = `
    <div class="loc-suggest__inner">
      <p class="loc-suggest__msg">It looks like you’re in India. Switch to ₹ INR / English (IN)?</p>
      <div class="loc-suggest__actions">
        <button type="button" class="btn btn--primary loc-suggest__switch" data-loc-switch="IN">Switch</button>
        <button type="button" class="btn btn--ghost loc-suggest__dismiss" data-loc-dismiss>Stay here</button>
      </div>
    </div>
    <style>
      .loc-suggest {
        position: fixed;
        inset-inline: var(--s-4, 16px);
        bottom: var(--s-4, 16px);
        z-index: 400;
        background: var(--c-bg, #fff);
        border: 1px solid var(--c-line, #d2d2d7);
        border-radius: var(--radius-md, 12px);
        box-shadow: 0 8px 24px rgba(0,0,0,.06);
        padding: var(--s-4, 16px);
        max-width: 420px;
        margin-inline: auto;
      }
      .loc-suggest__inner { display: flex; flex-direction: column; gap: 12px; }
      .loc-suggest__msg { margin: 0; font-size: 0.9375rem; color: var(--c-ink, #1d1d1f); }
      .loc-suggest__actions { display: flex; gap: 8px; }
    </style>
  `;
  document.body.appendChild(banner);

  banner.addEventListener('click', (e) => {
    const dismiss = e.target.closest('[data-loc-dismiss]');
    const sw = e.target.closest('[data-loc-switch]');
    if (dismiss) {
      writeCookie(SUGGEST_COOKIE, '1', COOKIE_DAYS);
      banner.remove();
      return;
    }
    if (sw) {
      writeCookie(SUGGEST_COOKIE, '1', COOKIE_DAYS);
      const code = sw.dataset.locSwitch || 'IN';
      // Find a localization form with country_code submit
      const form = document.querySelector('localization-form form');
      if (form) {
        const hidden = document.createElement('input');
        hidden.type = 'hidden'; hidden.name = 'country_code'; hidden.value = code;
        form.appendChild(hidden);
        form.requestSubmit ? form.requestSubmit() : form.submit();
      } else {
        banner.remove();
      }
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', maybeSuggestIndia);
} else {
  maybeSuggestIndia();
}
