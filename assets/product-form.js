/**
 * Zelexto v2 — product-form.js
 * <product-form> Custom Element. Listens to variant input changes,
 * resolves the matching variant from product.variants JSON rendered by
 * the section, updates: URL (replaceState), price, gallery (emits
 * variant:changed), ATC label/disabled state, low-stock indicator.
 * Submits the form via window.theme.cart.add to keep flow ajax-y.
 */

function fmt(cents) {
  return window.theme?.formatMoney ? window.theme.formatMoney(cents) : (cents / 100).toFixed(2);
}

class ProductFormEl extends HTMLElement {
  connectedCallback() {
    this.product = this.parseProduct();
    this.form = this.querySelector('[data-product-form]');
    this.atcButton = this.querySelector('[data-atc-button]');
    this.variantIdInput = this.querySelector('[data-variant-id]');
    this.priceContainer = this.querySelector('[data-product-price]');
    this.qtyInput = this.querySelector('[data-quantity-input]');
    this.qtyMirror = this.querySelector('[data-quantity-mirror]');
    this.stickyAtc = document.querySelector('[data-sticky-atc]');
    this.stickyPrice = document.querySelector('[data-sticky-price]');
    this.stickyButton = document.querySelector('[data-sticky-atc-button]');

    this.bindVariants();
    this.bindQty();
    this.bindFormSubmit();
    this.bindStickyAtc();
    this.bindShare();
    this.observeStickyVisibility();
  }
  parseProduct() {
    try {
      const json = this.querySelector('[data-product-json]')?.textContent;
      return json ? JSON.parse(json) : null;
    } catch (e) {
      return null;
    }
  }
  bindVariants() {
    this.querySelectorAll('[data-variant-input]').forEach((input) => {
      input.addEventListener('change', () => this.onVariantChange());
    });
  }
  bindQty() {
    this.querySelectorAll('[data-qty-step]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!this.qtyInput) return;
        const step = parseInt(btn.dataset.qtyStep, 10);
        const next = Math.max(1, (parseInt(this.qtyInput.value, 10) || 1) + step);
        this.qtyInput.value = next;
        if (this.qtyMirror) this.qtyMirror.value = next;
      });
    });
    this.qtyInput?.addEventListener('input', () => {
      if (this.qtyMirror) this.qtyMirror.value = Math.max(1, parseInt(this.qtyInput.value, 10) || 1);
    });
  }
  getSelectedOptions() {
    const opts = [];
    this.querySelectorAll('[data-variant-input]').forEach((input) => {
      if (input.type === 'radio' && !input.checked) return;
      const idx = parseInt(input.dataset.optionIndex, 10);
      opts[idx] = input.value;
    });
    return opts;
  }
  findVariant(opts) {
    if (!this.product?.variants) return null;
    return this.product.variants.find((v) => v.options.every((o, i) => o === opts[i])) || null;
  }
  onVariantChange() {
    const opts = this.getSelectedOptions();
    const variant = this.findVariant(opts);
    this.updateSelectedLabels(opts);

    if (!variant) {
      this.setUnavailable();
      window.theme.emit('variant:changed', { variant: null, product: this.product });
      return;
    }

    // Update hidden id input
    if (this.variantIdInput) this.variantIdInput.value = variant.id;

    // URL
    if (this.dataset.updateUrl) {
      const url = new URL(this.dataset.updateUrl, window.location.origin);
      url.searchParams.set('variant', variant.id);
      window.history.replaceState({}, '', url);
    }

    // Price
    this.renderPrice(variant);

    // ATC state
    this.setAvailability(variant);

    // Low stock
    this.renderLowStock(variant);

    // Sticky bar
    if (this.stickyPrice) {
      this.stickyPrice.textContent = fmt(variant.price);
      this.stickyPrice.dataset.moneyCents = variant.price;
    }
    if (this.stickyButton) this.stickyButton.disabled = !variant.available;

    window.theme.emit('variant:changed', { variant, product: this.product });
  }
  updateSelectedLabels(opts) {
    this.querySelectorAll('.variant-picker__group').forEach((grp, i) => {
      const sel = grp.querySelector('[data-selected-value]');
      if (sel && opts[i] !== undefined) sel.textContent = opts[i];
    });
    // Selected swatch / pill state
    this.querySelectorAll('[data-variant-input]').forEach((input) => {
      const parent = input.closest('.swatch, .size-pill');
      if (!parent) return;
      parent.classList.toggle('is-selected', input.checked);
    });
  }
  renderPrice(variant) {
    if (!this.priceContainer) return;
    const compare = variant.compare_at_price && variant.compare_at_price > variant.price ? variant.compare_at_price : null;
    const onSale = !!compare;
    const pct = compare ? Math.round(((compare - variant.price) / compare) * 100) : 0;
    this.priceContainer.innerHTML = `
      <div class="price${onSale ? ' price--on-sale' : ''}">
        <div class="price__values">
          <span class="price__current" data-money-cents="${variant.price}">${fmt(variant.price)}</span>
          ${compare ? `<s class="price__compare" data-money-cents="${compare}">${fmt(compare)}</s>` : ''}
        </div>
        ${onSale ? `<span class="price__badge">−${pct}%</span>` : ''}
      </div>`;
  }
  setAvailability(variant) {
    if (!this.atcButton) return;
    const txt = this.atcButton.querySelector('[data-atc-text]');
    if (variant.available) {
      this.atcButton.disabled = false;
      if (txt) txt.textContent = this.atcButton.dataset.textDefault || 'Add to bag';
    } else {
      this.atcButton.disabled = true;
      if (txt) txt.textContent = this.atcButton.dataset.textSoldout || 'Sold out';
    }
  }
  setUnavailable() {
    if (!this.atcButton) return;
    const txt = this.atcButton.querySelector('[data-atc-text]');
    this.atcButton.disabled = true;
    if (txt) txt.textContent = this.atcButton.dataset.textUnavailable || 'Unavailable';
  }
  renderLowStock(variant) {
    const el = this.querySelector('[data-low-stock]');
    if (!el) return;
    const threshold = window.theme?.settings?.low_stock_threshold || 5;
    const enabled = window.theme?.settings?.enable_low_stock !== false;
    const qty = variant.inventory_quantity;
    const tracking = variant.inventory_management === 'shopify';
    if (enabled && tracking && variant.available && qty > 0 && qty <= threshold) {
      el.hidden = false;
      const count = el.querySelector('[data-low-stock-count]');
      if (count) count.textContent = qty;
    } else {
      el.hidden = true;
    }
  }
  bindFormSubmit() {
    if (!this.form) return;
    this.form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(this.form);
      const id = fd.get('id');
      const quantity = parseInt(fd.get('quantity') || '1', 10);
      if (!id) return;

      const properties = {};
      for (const [k, v] of fd.entries()) {
        const m = k.match(/^properties\[(.+)\]$/);
        if (m) properties[m[1]] = v;
      }

      const txt = this.atcButton?.querySelector('[data-atc-text]');
      const orig = txt?.textContent;
      if (txt) txt.textContent = this.atcButton.dataset.textAdding || 'Adding…';
      this.atcButton?.setAttribute('aria-busy', 'true');

      try {
        const item = { id, quantity };
        if (Object.keys(properties).length) item.properties = properties;
        await window.theme.cart.add(item);
        window.theme.emit('cart:drawer-open');
      } catch (err) {
        console.warn('[product-form] add failed', err);
      } finally {
        this.atcButton?.removeAttribute('aria-busy');
        if (txt && orig) txt.textContent = orig;
      }
    });
  }
  bindStickyAtc() {
    this.stickyButton?.addEventListener('click', () => {
      this.form?.requestSubmit();
    });
  }
  bindShare() {
    this.querySelectorAll('[data-share-button]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const url = btn.dataset.shareUrl || window.location.href;
        const title = btn.dataset.shareTitle || document.title;
        if (navigator.share) {
          try { await navigator.share({ url, title }); } catch (_) {}
        } else if (navigator.clipboard) {
          try {
            await navigator.clipboard.writeText(url);
            btn.classList.add('is-copied');
            setTimeout(() => btn.classList.remove('is-copied'), 1500);
          } catch (_) {}
        }
      });
    });
  }
  observeStickyVisibility() {
    if (!this.stickyAtc) return;
    const trigger = this.querySelector('[data-atc-button]');
    if (!trigger) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const visible = !e.isIntersecting;
        this.stickyAtc.classList.toggle('is-visible', visible);
        this.stickyAtc.setAttribute('aria-hidden', visible ? 'false' : 'true');
      });
    }, { rootMargin: '-100px 0px 0px 0px' });
    io.observe(trigger);
    this._stickyIO = io;
  }
  disconnectedCallback() {
    this._stickyIO?.disconnect();
  }
}

if (!customElements.get('product-form')) customElements.define('product-form', ProductFormEl);
