/**
 * Zelexto v2 — quick-add.js
 * <product-recommendations> uses Section Rendering on connect to populate
 * itself if the page server-rendered an empty shell.
 * <quick-add-button> opens an inline modal with a variant subset and
 * triggers ATC via window.theme.cart.add.
 */

class ProductRecommendations extends HTMLElement {
  async connectedCallback() {
    if (this.querySelector('.recommendations__grid')) return; // already populated
    if (!this.dataset.url) return;
    try {
      const res = await fetch(this.dataset.url, { headers: { Accept: 'text/html' } });
      if (!res.ok) return;
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');
      const fresh = doc.querySelector('product-recommendations');
      if (fresh && fresh.innerHTML.trim()) {
        this.innerHTML = fresh.innerHTML;
      } else {
        this.hidden = true;
      }
    } catch (err) {
      console.warn('[recommendations]', err);
      this.hidden = true;
    }
  }
}

class QuickAddButton extends HTMLElement {
  connectedCallback() {
    this.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-quick-view]');
      if (!btn) return;
      e.preventDefault();
      const handle = btn.dataset.productHandle;
      this.openQuickView(handle);
    });
    // Also intercept generic [data-quick-view] across page (delegated globally)
    document.addEventListener('click', this._onClick = (e) => {
      const btn = e.target.closest('[data-quick-view]');
      if (!btn) return;
      e.preventDefault();
      this.openQuickView(btn.dataset.productHandle);
    }, { capture: true });
  }
  disconnectedCallback() {
    document.removeEventListener('click', this._onClick, true);
  }
  async openQuickView(handle) {
    if (!handle) return;
    try {
      const res = await fetch(`/products/${handle}.js`, { headers: { Accept: 'application/json' } });
      const product = await res.json();
      this.renderModal(product);
    } catch (err) {
      console.warn('[quick-add]', err);
    }
  }
  renderModal(product) {
    let modal = document.querySelector('.quick-add-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.className = 'quick-add-modal';
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
      document.body.appendChild(modal);
    }
    const variant = product.variants[0];
    const fmt = window.theme.formatMoney || ((c) => `$${(c / 100).toFixed(2)}`);
    modal.innerHTML = `
      <div class="quick-add-modal__backdrop" data-qa-close></div>
      <div class="quick-add-modal__panel" tabindex="-1">
        <button type="button" class="quick-add-modal__close" data-qa-close aria-label="Close">×</button>
        <div class="quick-add-modal__media">
          ${product.featured_image ? `<img src="${product.featured_image}" alt="${product.title}" loading="lazy">` : ''}
        </div>
        <div class="quick-add-modal__body">
          <h2>${product.title}</h2>
          <p class="quick-add-modal__price" data-money-cents="${variant.price}">${fmt(variant.price)}</p>
          <form data-qa-form>
            <select name="id" class="field__select" data-qa-variant>
              ${product.variants.map((v) => `<option value="${v.id}" ${v.available ? '' : 'disabled'}>${v.title} — ${fmt(v.price)}</option>`).join('')}
            </select>
            <button type="submit" class="btn btn--primary btn--full">Add to bag</button>
            <a href="${product.url}" class="quick-add-modal__view">View full details →</a>
          </form>
        </div>
      </div>`;
    modal.classList.add('is-open');
    document.body.classList.add('is-quick-add-open');
    const panel = modal.querySelector('.quick-add-modal__panel');
    panel?.focus();

    const close = () => {
      modal.classList.remove('is-open');
      document.body.classList.remove('is-quick-add-open');
    };
    modal.querySelectorAll('[data-qa-close]').forEach((b) => b.addEventListener('click', close));
    modal.querySelector('[data-qa-form]')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const id = modal.querySelector('[data-qa-variant]').value;
      try {
        await window.theme.cart.add({ id, quantity: 1 });
        close();
        window.theme.emit('cart:drawer-open');
      } catch (err) { console.warn('[quick-add] add failed', err); }
    });
    const onEsc = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', onEsc); } };
    document.addEventListener('keydown', onEsc);
  }
}

if (!customElements.get('product-recommendations')) customElements.define('product-recommendations', ProductRecommendations);
if (!customElements.get('quick-add-button')) customElements.define('quick-add-button', QuickAddButton);

// Auto-instantiate a hidden quick-add-button to handle global [data-quick-view] clicks.
if (!document.querySelector('quick-add-button')) {
  const el = document.createElement('quick-add-button');
  el.style.display = 'none';
  document.body.appendChild(el);
}
