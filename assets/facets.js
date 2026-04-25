/**
 * Zelexto v2 — facets.js
 * <facets-form> Custom Element. Uses the Section Rendering API to update
 * the product grid + sidebar without a full page reload. Debounces price
 * inputs (500ms), syncs URL via history.replaceState, supports mobile
 * filter toggle + clear-all.
 */

const PRICE_DEBOUNCE = 500;
const CHANGE_DEBOUNCE = 100;

function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

class FacetsForm extends HTMLElement {
  connectedCallback() {
    this.form = this.querySelector('[data-facets-form]');
    this.baseUrl = this.dataset.facetsBaseUrl || window.location.pathname;
    this._fastApply = debounce(() => this.apply(), CHANGE_DEBOUNCE);
    this._slowApply = debounce(() => this.apply(), PRICE_DEBOUNCE);

    this.addEventListener('change', (e) => {
      if (e.target.matches('[data-facet-input]')) {
        if (e.target.type === 'number') return; // price uses input event
        this._fastApply();
      }
    });
    this.addEventListener('input', (e) => {
      if (e.target.matches('[data-facet-input]') && e.target.type === 'number') {
        this._slowApply();
      }
    });
    this.addEventListener('click', (e) => {
      const remove = e.target.closest('[data-facet-remove]');
      if (remove) {
        e.preventDefault();
        this.fetchAndSwap(remove.getAttribute('href'));
      }
      const clear = e.target.closest('[data-facet-clear]');
      if (clear) {
        e.preventDefault();
        this.fetchAndSwap(clear.getAttribute('href'));
      }
    });

    // Sort change (outside the form, on parent <select data-collection-sort>)
    this._onSort = (e) => {
      if (!e.target.matches('[data-collection-sort]')) return;
      this.apply();
    };
    document.addEventListener('change', this._onSort);

    // Mobile toggle
    this._toggle = (e) => {
      const t = e.target.closest('[data-filter-toggle]');
      if (!t) return;
      const expanded = t.getAttribute('aria-expanded') === 'true';
      t.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      this.classList.toggle('is-mobile-open', !expanded);
      document.body.classList.toggle('is-facets-open', !expanded);
    };
    document.addEventListener('click', this._toggle);
  }
  disconnectedCallback() {
    document.removeEventListener('change', this._onSort);
    document.removeEventListener('click', this._toggle);
  }
  buildUrl() {
    const fd = new FormData(this.form);
    const sort = document.querySelector('[data-collection-sort]')?.value;
    const params = new URLSearchParams();
    for (const [k, v] of fd.entries()) {
      if (v === '' || v == null) continue;
      params.append(k, v);
    }
    if (sort) params.set('sort_by', sort);
    return `${this.baseUrl}?${params.toString()}`;
  }
  apply() {
    const url = this.buildUrl();
    this.fetchAndSwap(url);
  }
  async fetchAndSwap(url) {
    if (!url) return;
    const target = new URL(url, window.location.origin);
    // Section Rendering API — fetch each section we need to swap.
    const sectionId = document.querySelector('[data-products-region]')?.id?.replace(/^collection-products-/, '') || '';
    const fetchUrl = sectionId
      ? `${target.pathname}${target.search}${target.search ? '&' : '?'}section_id=${encodeURIComponent(sectionId)}`
      : target.toString();

    document.querySelector('[data-products-region]')?.classList.add('is-loading');
    try {
      const res = await fetch(fetchUrl, { headers: { Accept: 'text/html' } });
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, 'text/html');

      const newProducts = doc.querySelector('[data-products-region]');
      const newFacets = doc.querySelector('[data-facets-region]');
      const cur = document.querySelector('[data-products-region]');
      const curFacets = document.querySelector('[data-facets-region]');
      if (newProducts && cur) cur.innerHTML = newProducts.innerHTML;
      if (newFacets && curFacets) curFacets.innerHTML = newFacets.innerHTML;

      window.history.replaceState({}, '', target);
      window.theme.emit('facets:applied', { url: target.toString() });
    } catch (err) {
      console.warn('[facets] swap failed', err);
    } finally {
      document.querySelector('[data-products-region]')?.classList.remove('is-loading');
    }
  }
}

if (!customElements.get('facets-form')) customElements.define('facets-form', FacetsForm);
