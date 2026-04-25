/**
 * pincode.js
 *
 * Defines two Custom Elements:
 *   <pincode-check>     — 6-digit input that resolves serviceability
 *   <cod-availability>  — listens for pincode:checked and switches its visible state
 *
 * Providers (set by data-provider attribute on <pincode-check>):
 *   metafield  → reads embedded JSON (`<script type="application/json" data-pincodes>`)
 *   gokwik     → /apps/proxy/pincode?zip=
 *   shipway    → /apps/proxy/pincode?zip=
 *   off        → element hides itself
 *
 * Emits `theme.emit('pincode:checked', { zip, serviceable, cod, eta })`.
 */

const STORAGE_KEY = 'zlx:lastPincode';
const ZIP_RE = /^[1-9][0-9]{5}$/;

class PincodeCheck extends HTMLElement {
  connectedCallback() {
    this.provider = this.dataset.provider || 'metafield';
    if (this.provider === 'off') { this.hidden = true; return; }

    this.form = this.querySelector('[data-pincode-form]');
    this.input = this.querySelector('[data-pincode-input]');
    this.submit = this.querySelector('[data-pincode-submit]');
    this.label = this.querySelector('[data-pincode-label]');
    this.loading = this.querySelector('[data-pincode-loading]');
    this.errorEl = this.querySelector('[data-pincode-error]');
    this.resultEl = this.querySelector('[data-pincode-result]');
    this.pincodes = this._readPincodeJSON();

    if (this.form) {
      this.form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.check();
      });
    }
    if (this.input) {
      this.input.addEventListener('input', () => this._setError(false));
    }

    // Restore last-checked pincode and re-emit so cod-availability can show
    const last = this._readStored();
    if (last && last.zip) {
      if (this.input) this.input.value = last.zip;
      this._emit({ zip: last.zip, serviceable: last.serviceable, cod: last.cod, eta: last.eta });
    }
  }

  async check() {
    const zip = (this.input?.value || '').trim();
    if (!ZIP_RE.test(zip)) {
      this._setError(true);
      return;
    }
    this._setError(false);
    this._setLoading(true);

    try {
      let result;
      if (this.provider === 'metafield') {
        result = this._checkMetafield(zip);
      } else {
        result = await this._checkProxy(zip);
      }
      this._persist({ zip, ...result });
      this._emit({ zip, ...result });
    } catch (err) {
      console.error('[pincode] check failed', err);
      this._emit({ zip, serviceable: false, cod: false, eta: null, error: true });
    } finally {
      this._setLoading(false);
    }
  }

  _checkMetafield(zip) {
    const data = this.pincodes || {};
    const entry = data[zip];
    if (!entry) return { serviceable: false, cod: false, eta: null };
    return {
      serviceable: true,
      cod: !!entry.cod,
      eta: entry.eta || null,
    };
  }

  async _checkProxy(zip) {
    if (!window.theme?.fetchJSON) {
      throw new Error('theme.fetchJSON unavailable');
    }
    const data = await window.theme.fetchJSON(`/apps/proxy/pincode?zip=${encodeURIComponent(zip)}`);
    return {
      serviceable: !!data.serviceable,
      cod: !!data.cod,
      eta: data.eta || null,
    };
  }

  _readPincodeJSON() {
    const node = this.querySelector('script[type="application/json"][data-pincodes]');
    if (!node) return null;
    try { return JSON.parse(node.textContent); } catch { return null; }
  }

  _setError(on) {
    if (!this.errorEl) return;
    this.errorEl.hidden = !on;
    if (this.input) this.input.setAttribute('aria-invalid', on ? 'true' : 'false');
  }

  _setLoading(on) {
    this.dataset.state = on ? 'loading' : '';
    if (this.label) this.label.hidden = on;
    if (this.loading) this.loading.hidden = !on;
  }

  _persist(state) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
  }

  _readStored() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; }
  }

  _emit(payload) {
    if (window.theme?.emit) window.theme.emit('pincode:checked', payload);
    this.dispatchEvent(new CustomEvent('pincode:checked', { detail: payload, bubbles: true }));
  }
}

class CodAvailability extends HTMLElement {
  connectedCallback() {
    this._unsub = window.theme?.on?.('pincode:checked', (p) => this._render(p));
  }
  disconnectedCallback() {
    if (typeof this._unsub === 'function') this._unsub();
  }

  _render({ serviceable, cod, eta, error }) {
    if (!serviceable) {
      this._show('unserviceable');
      return;
    }
    const state = cod ? 'serviceable' : 'prepaid_only';
    this._show(state, { eta: eta || (cod ? '1-2 days' : '3-5 days') });
  }

  _show(state, vars = {}) {
    this.dataset.state = state;
    this.hidden = false;
    this.querySelectorAll('[data-cod-state]').forEach((el) => {
      el.hidden = el.dataset.codState !== state;
      const text = el.querySelector('[data-cod-text]');
      if (text && vars.eta) {
        text.textContent = text.textContent.replace(/\{\{\s*eta\s*\}\}|1-2 days|3-5 days/, vars.eta);
      }
    });
  }
}

if (!customElements.get('pincode-check')) customElements.define('pincode-check', PincodeCheck);
if (!customElements.get('cod-availability')) customElements.define('cod-availability', CodAvailability);
