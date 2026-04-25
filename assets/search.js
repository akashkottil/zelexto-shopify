/**
 * Zelexto v2 — search.js
 * <predictive-search> Custom Element. Wraps the search modal: opens on
 * `search:open`, debounces input, queries /search/suggest.json, renders
 * grouped results with full keyboard nav and focus trap.
 */

const DEBOUNCE_MS = 250;

function escape(str = '') {
  return String(str).replace(/[&<>"']/g, (s) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[s]));
}

class PredictiveSearch extends HTMLElement {
  connectedCallback() {
    this.input = this.querySelector('[data-search-input]');
    this.results = this.querySelector('[data-search-results]');
    this.hint = this.querySelector('[data-search-hint]');
    this.clearBtn = this.querySelector('[data-search-clear]');
    this.form = this.querySelector('[data-search-form]');
    this.panel = this.querySelector('[data-search-panel]');

    this._debounced = this.debounce(this.search.bind(this), DEBOUNCE_MS);

    this.input?.addEventListener('input', () => {
      const v = this.input.value.trim();
      this.clearBtn?.toggleAttribute('hidden', !v);
      if (v.length < 2) {
        this.renderHint();
        return;
      }
      this._debounced(v);
    });

    this.input?.addEventListener('keydown', (e) => this.onKeydown(e));
    this.results?.addEventListener('keydown', (e) => this.onResultsKeydown(e));

    this.clearBtn?.addEventListener('click', () => {
      this.input.value = '';
      this.clearBtn.setAttribute('hidden', '');
      this.renderHint();
      this.input.focus();
    });

    this.addEventListener('click', (e) => {
      if (e.target.closest('[data-search-close]')) this.close();
      if (e.target.matches('[data-search-backdrop]')) this.close();
    });

    this._openUnsub = window.theme.on('search:open', () => this.open());
    this._escUnsub = window.theme.on('escape', () => this.close());
  }
  disconnectedCallback() {
    this._openUnsub?.();
    this._escUnsub?.();
  }
  debounce(fn, ms) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }
  open() {
    this.removeAttribute('hidden');
    document.body.classList.add('is-search-open');
    requestAnimationFrame(() => {
      this.classList.add('is-open');
      this.input?.focus();
    });
    if (window.theme?.a11y?.trapFocus && this.panel) {
      this._releaseTrap = window.theme.a11y.trapFocus(this.panel);
    }
    window.theme.emit('search:opened');
  }
  close() {
    this.classList.remove('is-open');
    document.body.classList.remove('is-search-open');
    this._releaseTrap?.();
    setTimeout(() => this.setAttribute('hidden', ''), 200);
    window.theme.emit('search:closed');
  }
  onKeydown(e) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const first = this.results?.querySelector('[role="option"]');
      first?.focus();
    } else if (e.key === 'Enter') {
      // Default form submit handles the URL nav.
      window.theme.emit('search:submit', { q: this.input.value });
    }
  }
  onResultsKeydown(e) {
    const items = Array.from(this.results.querySelectorAll('[role="option"]'));
    const idx = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      items[Math.min(items.length - 1, idx + 1)]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (idx <= 0) this.input.focus();
      else items[idx - 1].focus();
    }
  }
  renderHint() {
    if (this.hint) this.hint.hidden = false;
    if (this.results) {
      const hintHTML = this.hint?.outerHTML || '';
      this.results.innerHTML = hintHTML;
    }
    this.input?.setAttribute('aria-expanded', 'false');
  }
  async search(query) {
    try {
      this.input?.setAttribute('aria-busy', 'true');
      const url = new URL('/search/suggest.json', window.location.origin);
      url.searchParams.set('q', query);
      url.searchParams.set('resources[type]', 'product,collection,article,page');
      url.searchParams.set('resources[limit]', '6');
      url.searchParams.set('resources[options][unavailable_products]', 'last');
      const data = await fetch(url, { headers: { Accept: 'application/json' } }).then((r) => r.json());
      this.render(data?.resources?.results || {}, query);
      window.theme.emit('analytics:search', { search_term: query });
    } catch (err) {
      console.warn('[search]', err);
    } finally {
      this.input?.removeAttribute('aria-busy');
    }
  }
  render(groups, query) {
    if (!this.results) return;
    const sections = [];

    if (groups.products?.length) {
      sections.push(`<section class="search-modal__group" aria-label="Products">
        <h3 class="search-modal__group-title">Products</h3>
        <ul class="search-modal__list" role="list">
          ${groups.products.map((p) => this.productItem(p)).join('')}
        </ul>
      </section>`);
    }
    if (groups.collections?.length) {
      sections.push(`<section class="search-modal__group" aria-label="Collections">
        <h3 class="search-modal__group-title">Collections</h3>
        <ul class="search-modal__list" role="list">
          ${groups.collections.map((c) => `<li><a class="search-result" role="option" href="${escape(c.url)}"><span>${escape(c.title)}</span></a></li>`).join('')}
        </ul>
      </section>`);
    }
    if (groups.articles?.length) {
      sections.push(`<section class="search-modal__group" aria-label="Articles">
        <h3 class="search-modal__group-title">Articles</h3>
        <ul class="search-modal__list" role="list">
          ${groups.articles.map((a) => `<li><a class="search-result" role="option" href="${escape(a.url)}"><span>${escape(a.title)}</span></a></li>`).join('')}
        </ul>
      </section>`);
    }
    if (groups.pages?.length) {
      sections.push(`<section class="search-modal__group" aria-label="Pages">
        <h3 class="search-modal__group-title">Pages</h3>
        <ul class="search-modal__list" role="list">
          ${groups.pages.map((p) => `<li><a class="search-result" role="option" href="${escape(p.url)}"><span>${escape(p.title)}</span></a></li>`).join('')}
        </ul>
      </section>`);
    }

    if (!sections.length) {
      this.results.innerHTML = `<p class="search-modal__no-results">No results for “${escape(query)}”.</p>`;
    } else {
      this.results.innerHTML = sections.join('') + `<a class="search-modal__view-all" href="/search?q=${encodeURIComponent(query)}">View all results</a>`;
    }
    this.input?.setAttribute('aria-expanded', 'true');
  }
  productItem(p) {
    const img = p.image ? `<span class="search-result__media aspect" style="aspect-ratio:1/1;"><img src="${escape(p.image)}" alt="${escape(p.title)}" loading="lazy" decoding="async"></span>` : '';
    const price = (p.price !== undefined) ? `<span class="search-result__price" data-money-cents="${p.price}">${window.theme.formatMoney ? window.theme.formatMoney(p.price) : ''}</span>` : '';
    const vendor = p.vendor ? `<span class="search-result__vendor">${escape(p.vendor)}</span>` : '';
    return `<li>
      <a class="search-result" role="option" href="${escape(p.url)}">
        ${img}
        <span class="search-result__body">
          ${vendor}
          <span class="search-result__title">${escape(p.title)}</span>
          ${price}
        </span>
      </a>
    </li>`;
  }
}

if (!customElements.get('predictive-search')) customElements.define('predictive-search', PredictiveSearch);
