/**
 * ZELEXTO THEME — component-search.js
 * Predictive search using Shopify Predictive Search API.
 * - 300ms debounce to minimize API calls
 * - Keyboard navigation in results (arrow keys, Enter, ESC)
 * - Hydration guard: only initialises if search input exists
 */

(function () {
    'use strict';

    // Performance improvement 4: only init if element exists
    if (!document.querySelector('[data-search-input]')) return;

    const DEBOUNCE_DELAY = 300;
    const MIN_QUERY_LENGTH = 2;
    const MAX_RESULTS = 4;

    // DOM refs
    const modal = document.getElementById('search-modal');
    const input = document.querySelector('[data-search-input]');
    const results = document.getElementById('search-results');
    const loading = document.getElementById('search-loading');
    const empty = document.getElementById('search-empty');
    const trending = document.getElementById('search-trending');
    const clearBtn = document.querySelector('[data-search-clear]');
    const closeBtn = document.querySelector('[data-search-close]');
    const toggleBtns = document.querySelectorAll('[data-search-toggle]');

    let debounceTimer = null;
    let activeIndex = -1;
    let currentResults = [];

    // -----------------------------------------------------------------
    // Open / close modal
    // -----------------------------------------------------------------
    function openModal() {
        if (!modal) return;
        modal.showModal();
        document.body.style.overflow = 'hidden';
        input.focus();
        input.select();
        toggleBtns.forEach(b => b.setAttribute('aria-expanded', 'true'));
        if (window.ThemeEvents) window.ThemeEvents.emit('search:opened');
    }

    function closeModal() {
        if (!modal) return;
        modal.close();
        document.body.style.overflow = '';
        toggleBtns.forEach(b => b.setAttribute('aria-expanded', 'false'));
        if (window.ThemeEvents) window.ThemeEvents.emit('search:closed');
    }

    // Open on all search toggle buttons (icons in header)
    toggleBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            openModal();
        });
    });

    // Close button inside modal
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    // Close on backdrop click
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
        // ESC handled natively by <dialog> element
        modal.addEventListener('close', () => {
            document.body.style.overflow = '';
        });
    }

    // -----------------------------------------------------------------
    // Input handling
    // -----------------------------------------------------------------
    if (input) {
        input.addEventListener('input', () => {
            const query = input.value.trim();

            // Show/hide clear button
            if (clearBtn) clearBtn.hidden = query.length === 0;

            if (query.length < MIN_QUERY_LENGTH) {
                clearResults();
                if (trending) trending.hidden = false;
                return;
            }

            if (trending) trending.hidden = true;
            debounce(() => fetchPredictive(query));
        });

        input.addEventListener('keydown', handleKeyboard);
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', () => {
            input.value = '';
            clearBtn.hidden = true;
            clearResults();
            if (trending) trending.hidden = false;
            input.focus();
        });
    }

    // -----------------------------------------------------------------
    // Keyboard navigation
    // -----------------------------------------------------------------
    function handleKeyboard(e) {
        if (!currentResults.length) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                activeIndex = Math.min(activeIndex + 1, currentResults.length - 1);
                updateActiveItem();
                break;
            case 'ArrowUp':
                e.preventDefault();
                activeIndex = Math.max(activeIndex - 1, -1);
                updateActiveItem();
                break;
            case 'Enter':
                if (activeIndex >= 0 && currentResults[activeIndex]) {
                    e.preventDefault();
                    window.location.href = currentResults[activeIndex].url;
                }
                break;
            case 'Escape':
                closeModal();
                break;
        }
    }

    function updateActiveItem() {
        const items = results.querySelectorAll('.search-result');
        items.forEach((item, idx) => {
            const isActive = idx === activeIndex;
            item.classList.toggle('is-active', isActive);
            item.setAttribute('aria-selected', isActive.toString());
            if (isActive) item.scrollIntoView({ block: 'nearest' });
        });
        input.setAttribute('aria-activedescendant', activeIndex >= 0 ? `result-${activeIndex}` : '');
    }

    // -----------------------------------------------------------------
    // API fetch
    // -----------------------------------------------------------------
    async function fetchPredictive(query) {
        showLoading(true);

        try {
            const url = new URL(window.themeSettings.routes.predictiveSearch, window.location.origin);
            url.searchParams.set('q', query);
            url.searchParams.set('resources[type]', 'product,article,page,collection');
            url.searchParams.set('resources[limit]', MAX_RESULTS);
            url.searchParams.set('resources[options][unavailable_products]', 'hide');

            const response = await fetch(url.toString(), {
                headers: { 'Accept': 'application/json' }
            });

            if (!response.ok) throw new Error('Search API error');

            const data = await response.json();
            renderResults(data.resources, query);

        } catch (err) {
            console.error('[ThemeSearch]', err);
            showLoading(false);
        }
    }

    // -----------------------------------------------------------------
    // Render results
    // -----------------------------------------------------------------
    function renderResults(resources, query) {
        showLoading(false);
        clearResults(false);
        activeIndex = -1;
        currentResults = [];

        const products = resources.results?.products || [];
        const articles = resources.results?.articles || [];
        const pages = resources.results?.pages || [];
        const collections = resources.results?.collections || [];

        const hasResults = products.length + articles.length + pages.length + collections.length > 0;

        if (!hasResults) {
            if (empty) {
                empty.hidden = false;
                empty.querySelector('p').textContent = `No results for "${query}"`;
            }
            input.setAttribute('aria-expanded', 'false');
            return;
        }

        const fragment = document.createDocumentFragment();

        // Products section
        if (products.length) {
            const section = createSection('Products');
            products.forEach((p, i) => {
                const item = createProductResult(p, currentResults.length);
                currentResults.push(p);
                section.appendChild(item);
            });
            fragment.appendChild(section);
        }

        // Collections
        if (collections.length) {
            const section = createSection('Collections');
            collections.forEach(c => {
                section.appendChild(createTextResult(c, currentResults.length, 'collection'));
                currentResults.push(c);
            });
            fragment.appendChild(section);
        }

        // Articles
        if (articles.length) {
            const section = createSection('Articles');
            articles.forEach(a => {
                section.appendChild(createTextResult(a, currentResults.length, 'article'));
                currentResults.push(a);
            });
            fragment.appendChild(section);
        }

        // Pages
        if (pages.length) {
            const section = createSection('Pages');
            pages.forEach(p => {
                section.appendChild(createTextResult(p, currentResults.length, 'page'));
                currentResults.push(p);
            });
            fragment.appendChild(section);
        }

        results.appendChild(fragment);
        input.setAttribute('aria-expanded', 'true');
    }

    function createSection(title) {
        const wrap = document.createElement('div');
        wrap.className = 'search-results-group';
        const heading = document.createElement('p');
        heading.className = 'search-modal__section-title';
        heading.textContent = title;
        wrap.appendChild(heading);
        return wrap;
    }

    function createProductResult(product, idx) {
        const link = document.createElement('a');
        link.href = product.url;
        link.className = 'search-result search-result--product';
        link.id = `result-${idx}`;
        link.setAttribute('role', 'option');
        link.setAttribute('aria-selected', 'false');

        const img = product.featured_image?.url
            ? `<img src="${product.featured_image.url}&width=80" alt="${escapeHtml(product.featured_image.alt || product.title)}" width="80" height="80" loading="lazy" decoding="async">`
            : '';

        link.innerHTML = `
      <div class="search-result__image">${img}</div>
      <div class="search-result__info">
        <p class="search-result__vendor">${escapeHtml(product.vendor || '')}</p>
        <p class="search-result__title">${escapeHtml(product.title)}</p>
        <p class="search-result__price">${formatMoney(product.price)}</p>
      </div>`;

        return link;
    }

    function createTextResult(item, idx, type) {
        const link = document.createElement('a');
        link.href = item.url;
        link.className = `search-result search-result--${type}`;
        link.id = `result-${idx}`;
        link.setAttribute('role', 'option');
        link.setAttribute('aria-selected', 'false');
        link.innerHTML = `<div class="search-result__info"><p class="search-result__title">${escapeHtml(item.title)}</p></div>`;
        return link;
    }

    // -----------------------------------------------------------------
    // Helpers
    // -----------------------------------------------------------------
    function showLoading(show) {
        if (loading) loading.hidden = !show;
    }

    function clearResults(clearCurrentResults = true) {
        if (clearCurrentResults) currentResults = [];
        if (empty) empty.hidden = true;
        // Remove all result groups but keep sentinel elements
        Array.from(results.querySelectorAll('.search-results-group')).forEach(el => el.remove());
        input.setAttribute('aria-expanded', 'false');
    }

    function debounce(fn) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(fn, DEBOUNCE_DELAY);
    }

    function escapeHtml(str) {
        if (!str) return '';
        return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function formatMoney(cents) {
        if (!cents) return '';
        const moneyFormat = window.themeSettings?.moneyFormat || '${{amount}}';
        const amount = (cents / 100).toFixed(2);
        return moneyFormat.replace('{{amount}}', amount).replace('{{amount_no_decimals}}', Math.floor(cents / 100));
    }

    // CSS for search results
    const style = document.createElement('style');
    style.textContent = `
    .search-results-group { grid-column: 1 / -1; }
    .search-result {
      display: flex;
      align-items: center;
      gap: var(--space-3);
      padding: var(--space-3);
      border-radius: var(--radius);
      text-decoration: none;
      color: var(--color-text);
      transition: background-color var(--transition-fast);
    }
    .search-result:hover,
    .search-result.is-active { background-color: var(--color-surface); }
    .search-result__image {
      width: 56px; height: 56px;
      border-radius: var(--radius);
      overflow: hidden; flex-shrink: 0;
      background: var(--color-surface);
    }
    .search-result__image img { width: 100%; height: 100%; object-fit: cover; }
    .search-result__vendor { font-size: var(--font-size-xs); color: var(--color-text-secondary); }
    .search-result__title { font-size: var(--font-size-sm); font-weight: var(--font-weight-medium); }
    .search-result__price { font-size: var(--font-size-sm); color: var(--color-accent); font-weight: var(--font-weight-semibold); margin-top: 2px; }
  `;
    document.head.appendChild(style);

})();
