/**
 * Zelexto v2 — cart.js
 * Defines <cart-drawer> + <cart-page> Custom Elements. Wires AJAX add/
 * change/remove via window.theme.cart, opens drawer on cart:item-added,
 * traps focus, manages free-shipping bar, and supports Section Rendering
 * for hot-reload of cart contents.
 */

const FREE_SHIP = () => Number(window.theme?.settings?.free_shipping_threshold || 0);

function fmt(cents) {
  if (window.theme?.formatMoney) return window.theme.formatMoney(cents);
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: window.theme?.shop?.currency || 'INR',
  }).format(cents / 100);
}

function debounce(fn, ms = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

/* ----------------- Shared cart logic ----------------- */
class CartHost extends HTMLElement {
  connectedCallback() {
    this.bindQty();
    this.bindRemove();
    this.bindCheckoutButton();
    this._unsubs = [];
    this._unsubs.push(window.theme.on('cart:updated', (data) => this.onCartUpdated(data)));
    this._unsubs.push(window.theme.on('cart:item-added', () => this.requestRender()));
    this._unsubs.push(window.theme.on('cart:item-removed', () => this.requestRender()));
  }
  disconnectedCallback() {
    this._unsubs?.forEach((u) => u?.());
  }
  bindQty() {
    const onStep = (e) => {
      const btn = e.target.closest('[data-cart-qty-step]');
      if (!btn) return;
      const key = btn.dataset.cartLineKey;
      const input = this.querySelector(`[data-cart-qty-input][data-cart-line-key="${key}"]`);
      if (!input) return;
      const next = Math.max(0, (parseInt(input.value, 10) || 0) + parseInt(btn.dataset.cartQtyStep, 10));
      input.value = next;
      this.changeQty(key, next);
    };
    const onInput = debounce((e) => {
      const inp = e.target.closest('[data-cart-qty-input]');
      if (!inp) return;
      const next = Math.max(0, parseInt(inp.value, 10) || 0);
      this.changeQty(inp.dataset.cartLineKey, next);
    }, 400);
    this.addEventListener('click', onStep);
    this.addEventListener('input', onInput);
  }
  bindRemove() {
    this.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cart-remove]');
      if (!btn) return;
      e.preventDefault();
      this.changeQty(btn.dataset.cartLineKey, 0);
    });
  }
  bindCheckoutButton() {
    this.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-cart-checkout]');
      if (!btn) return;
      window.theme.emit('analytics:begin_checkout', { cart: window.theme.cart.state });
    });
  }
  async changeQty(key, quantity) {
    if (!key) return;
    this.setLoading(key, true);
    try {
      await window.theme.cart.change({ id: key, quantity });
      this.requestRender();
    } catch (err) {
      console.error('[cart]', err);
      window.theme.emit('cart:error', err);
    } finally {
      this.setLoading(key, false);
    }
  }
  setLoading(key, loading) {
    const line = this.querySelector(`[data-cart-line-key="${key}"]`);
    line?.classList.toggle('is-loading', loading);
  }
  onCartUpdated(data) {
    if (!data) return;
    this.querySelectorAll('[data-cart-subtotal]').forEach((el) => {
      el.textContent = fmt(data.total_price);
      el.dataset.moneyCents = data.total_price;
    });
    this.querySelectorAll('[data-cart-count]').forEach((el) => {
      const tpl = el.dataset.template || '%count items';
      el.textContent = tpl.replace('%count', data.item_count);
    });
    this.updateShippingBar(data);
  }
  updateShippingBar(data) {
    const threshold = FREE_SHIP() * 100;
    if (!threshold) return;
    const remain = Math.max(0, threshold - data.total_price);
    const pct = Math.min(100, Math.round((data.total_price / threshold) * 100));
    this.querySelectorAll('[data-shipping-fill]').forEach((el) => { el.style.width = `${pct}%`; });
    this.querySelectorAll('[data-shipping-remaining]').forEach((el) => { el.textContent = fmt(remain); });
    this.querySelectorAll('[data-shipping-bar]').forEach((el) => {
      el.classList.toggle('is-reached', pct >= 100);
    });
  }
  /** Re-fetch the section HTML and replace the dynamic regions. */
  async requestRender() {
    const tag = this.tagName.toLowerCase();
    const sectionId = tag === 'cart-drawer' ? 'cart-drawer' : 'main-cart';
    try {
      const res = await fetch(`${window.location.pathname}?section_id=${sectionId}`, { headers: { Accept: 'text/html' } });
      if (!res.ok) return;
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const fresh = doc.querySelector(tag);
      if (!fresh) return;
      // Swap children only — keep host element to retain event listeners.
      this.innerHTML = fresh.innerHTML;
      // Rebind dynamic data attrs
      this.bindQty();
      this.bindRemove();
      this.bindCheckoutButton();
    } catch (e) {
      console.warn('[cart] section refresh failed', e);
    }
  }
}

/* ----------------- <cart-drawer> ----------------- */
class CartDrawerEl extends CartHost {
  connectedCallback() {
    super.connectedCallback();
    this._releaseTrap = null;
    this._lastFocus = null;
    this._unsubs.push(window.theme.on('cart:drawer-open', () => this.open()));
    this._unsubs.push(window.theme.on('cart:item-added', () => this.open()));
    this._unsubs.push(window.theme.on('escape', () => this.close()));
    this.addEventListener('click', (e) => {
      if (e.target.closest('[data-cart-close]')) this.close();
      if (e.target.matches('[data-cart-overlay]')) this.close();
    });
  }
  open() {
    if (this._open) return;
    this._open = true;
    this._lastFocus = document.activeElement;
    this.removeAttribute('hidden');
    this.setAttribute('aria-hidden', 'false');
    document.body.classList.add('is-cart-open');
    requestAnimationFrame(() => {
      this.classList.add('is-open');
      const panel = this.querySelector('[data-cart-panel]');
      if (panel && window.theme?.a11y?.trapFocus) {
        this._releaseTrap = window.theme.a11y.trapFocus(panel);
      }
    });
    window.theme.emit('cart:drawer-opened');
  }
  close() {
    if (!this._open) return;
    this._open = false;
    this.classList.remove('is-open');
    this.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('is-cart-open');
    if (this._releaseTrap) { this._releaseTrap(); this._releaseTrap = null; }
    setTimeout(() => { this.setAttribute('hidden', ''); }, 280);
    window.theme.emit('cart:drawer-closed');
  }
}

/* ----------------- <cart-page> ----------------- */
class CartPageEl extends CartHost {
  connectedCallback() {
    super.connectedCallback();
    // Cart page uses native form submission, but we still hot-update quantities + subtotal.
  }
}

if (!customElements.get('cart-drawer')) customElements.define('cart-drawer', CartDrawerEl);
if (!customElements.get('cart-page')) customElements.define('cart-page', CartPageEl);
