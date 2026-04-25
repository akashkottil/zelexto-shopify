/**
 * recently-viewed.js — <recently-viewed>
 *
 * Reads handle list from localStorage `zelexto:recently_viewed`. On PDP
 * (when data-current-handle is set), prepends the current handle (deduped),
 * caps at 30, persists. Fetches `${handle}.js` for each (up to data-limit)
 * and renders mini cards.
 */

(() => {
  if (customElements.get('recently-viewed')) return;

  const STORE_KEY = 'zelexto:recently_viewed';
  const HARD_CAP = 30;

  const fmt = (cents) => {
    try { return window.theme.formatMoney(cents); } catch (e) { return (cents / 100).toFixed(2); }
  };

  const escape = (str) => String(str || '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);

  function readList() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY) || '[]'); }
    catch (_) { return []; }
  }
  function writeList(list) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(list.slice(0, HARD_CAP))); }
    catch (_) {}
  }

  class RecentlyViewed extends HTMLElement {
    async connectedCallback() {
      this.limit = parseInt(this.getAttribute('data-limit'), 10) || 8;
      this.currentHandle = this.getAttribute('data-current-handle') || '';
      this.rail = this.querySelector('[data-rail]');

      let list = readList();
      if (this.currentHandle) {
        list = [this.currentHandle, ...list.filter((h) => h !== this.currentHandle)];
        writeList(list);
      }
      const toRender = list.filter((h) => h !== this.currentHandle).slice(0, this.limit);
      if (!toRender.length) {
        this.hidden = true;
        return;
      }
      const products = await this.fetchProducts(toRender);
      const valid = products.filter(Boolean);
      if (!valid.length) {
        this.hidden = true;
        return;
      }
      this.render(valid);
      this.hidden = false;
    }

    fetchProducts(handles) {
      return Promise.all(handles.map((h) =>
        fetch(`/products/${h}.js`, { headers: { Accept: 'application/json' } })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null)
      ));
    }

    render(products) {
      this.rail.innerHTML = products.map((p) => {
        const img = p.featured_image || (p.images && p.images[0]) || '';
        const url = p.url || `/products/${p.handle}`;
        return `
          <article class="recently-viewed__card" role="listitem">
            <a href="${url}" class="recently-viewed__media" aria-label="${escape(p.title)}">
              ${img ? `<img src="${img}" alt="${escape(p.title)}" loading="lazy" decoding="async">` : ''}
            </a>
            <a href="${url}"><h3 class="recently-viewed__title">${escape(p.title)}</h3></a>
            <span class="recently-viewed__price">${fmt(p.price)}</span>
          </article>
        `;
      }).join('');
    }
  }

  customElements.define('recently-viewed', RecentlyViewed);
})();
