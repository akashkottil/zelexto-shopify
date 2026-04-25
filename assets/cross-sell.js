/**
 * cross-sell.js — <cart-cross-sell>
 *
 * On cart:drawer-opened / cart:updated, fetch
 * /recommendations/products.json?intent=complementary&product_id=<first>
 * and render mini cards into [data-rail]. Quick-add uses theme.cart.add.
 */

(() => {
  if (customElements.get('cart-cross-sell')) return;

  const fmt = (cents) => {
    try { return window.theme.formatMoney(cents); } catch (e) { return (cents / 100).toFixed(2); }
  };

  class CartCrossSell extends HTMLElement {
    connectedCallback() {
      this.limit = parseInt(this.getAttribute('data-limit'), 10) || 4;
      this.rail = this.querySelector('[data-rail]');
      this._loaded = new Set();
      this._loadingFor = null;
      this.refresh();
      if (window.theme && window.theme.on) {
        this._unsub = [
          window.theme.on('cart:drawer-opened', () => this.refresh()),
          window.theme.on('cart:updated', () => this.refresh()),
          window.theme.on('cart:item-added', () => this.refresh()),
        ];
      }
    }

    disconnectedCallback() {
      this._unsub?.forEach((fn) => fn && fn());
    }

    async refresh() {
      try {
        const cart = (window.theme && window.theme.cart && window.theme.cart.state)
          ? window.theme.cart.state
          : await fetch('/cart.js').then((r) => r.json());
        if (!cart || !cart.items || !cart.items.length) {
          this.hidden = true;
          return;
        }
        const seedId = cart.items[0].product_id;
        if (this._loadingFor === seedId) return;
        this._loadingFor = seedId;
        const products = await this.fetchRecs(seedId);
        if (!products || !products.length) {
          this.hidden = true;
          return;
        }
        const cartIds = new Set(cart.items.map((i) => i.product_id));
        const filtered = products.filter((p) => !cartIds.has(p.id)).slice(0, this.limit);
        if (!filtered.length) {
          this.hidden = true;
          return;
        }
        this.render(filtered);
        this.hidden = false;
      } catch (err) {
        this.hidden = true;
        console.warn('[cross-sell]', err);
      }
    }

    async fetchRecs(productId) {
      const url = `/recommendations/products.json?intent=complementary&limit=${this.limit + 2}&product_id=${productId}`;
      const res = await fetch(url, { headers: { Accept: 'application/json' } });
      if (!res.ok) return [];
      const data = await res.json();
      return data.products || [];
    }

    render(products) {
      const html = products.map((p) => {
        const img = (p.featured_image || (p.images && p.images[0])) || '';
        const imgUrl = typeof img === 'string' ? img : (img.src || '');
        const variantId = (p.variants && p.variants[0] && p.variants[0].id) || p.variant_id;
        const available = p.available !== false;
        const priceCents = p.price != null ? p.price : (p.variants && p.variants[0] && p.variants[0].price);
        return `
          <article class="cross-sell__card" role="listitem">
            <a href="${p.url || '/products/' + p.handle}" class="cross-sell__media" aria-label="${escape(p.title)}">
              ${imgUrl ? `<img src="${imgUrl}" alt="${escape(p.title)}" loading="lazy" decoding="async">` : ''}
            </a>
            <p class="cross-sell__title">${escape(p.title)}</p>
            <span class="cross-sell__price">${fmt(priceCents)}</span>
            <button type="button"
                    class="cross-sell__add"
                    data-add="${variantId}"
                    ${available ? '' : 'disabled'}>
              ${available ? (window.themeStrings?.['product.add_to_cart'] || 'Add') : (window.themeStrings?.['product.sold_out'] || 'Sold out')}
            </button>
          </article>
        `;
      }).join('');
      this.rail.innerHTML = html;
      this.rail.querySelectorAll('[data-add]').forEach((btn) => {
        btn.addEventListener('click', () => this.add(btn));
      });
    }

    async add(btn) {
      const id = btn.dataset.add;
      if (!id) return;
      btn.disabled = true;
      try {
        await window.theme.cart.add({ id, quantity: 1 });
      } catch (err) {
        console.warn('[cross-sell] add failed', err);
      } finally {
        btn.disabled = false;
      }
    }
  }

  function escape(str) {
    return String(str || '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  }

  customElements.define('cart-cross-sell', CartCrossSell);
})();
