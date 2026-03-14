/**
 * ZELEXTO THEME — component-filters.js
 * Collection filtering via Shopify Section Rendering API.
 * - Checkbox filters auto-submit on change
 * - Price range debounced 500ms
 * - Sort select auto-submits
 * - URL is updated (back/forward nav works)
 * - Emits ThemeEvents
 */

(function () {
    'use strict';

    // Hydration guard
    if (!document.getElementById('filter-form') && !document.getElementById('sort-select')) return;

    const filterForm = document.getElementById('filter-form');
    const sortSelect = document.getElementById('sort-select');
    const productsGrid = document.getElementById('collection-products');
    const filterCount = document.getElementById('filter-count');
    const loadingEl = document.getElementById('collection-loading');

    const SECTION_ID = document.getElementById('collection-section')?.dataset.sectionId;
    const DEBOUNCE_DELAY = 500;

    let priceDebounceTimer = null;
    let isLoading = false;

    // ----------------------------------------------------------------
    // Filter form — checkbox changes auto-submit
    // ----------------------------------------------------------------
    if (filterForm) {

        // Checkbox / select changes auto-submit
        filterForm.addEventListener('change', (e) => {
            const target = e.target;

            if (target.dataset.filter !== undefined) {
                // Price range has its own debounce; all others submit immediately
                if (target.dataset.priceMin !== undefined || target.dataset.priceMax !== undefined) return;
                submitFilters();
            }
        });

        // Price range — debounce submit on slider or number input change
        filterForm.addEventListener('input', (e) => {
            const target = e.target;
            if (target.dataset.priceMin !== undefined || target.dataset.priceMax !== undefined ||
                target.dataset.priceInputMin !== undefined || target.dataset.priceInputMax !== undefined) {
                syncPriceSlider();
                clearTimeout(priceDebounceTimer);
                priceDebounceTimer = setTimeout(submitFilters, DEBOUNCE_DELAY);
            }
        });

        // Mobile apply button
        filterForm.addEventListener('submit', (e) => {
            e.preventDefault();
            submitFilters();
        });
    }

    // ----------------------------------------------------------------
    // Sort select
    // ----------------------------------------------------------------
    if (sortSelect) {
        sortSelect.addEventListener('change', () => submitFilters());
    }

    // ----------------------------------------------------------------
    // Submit — build URL & fetch via Section Rendering API
    // ----------------------------------------------------------------
    async function submitFilters() {
        if (isLoading) return;
        isLoading = true;

        showLoading(true);

        try {
            const url = buildFilterUrl();

            // Update browser URL (enables back/forward nav)
            window.history.pushState({}, '', url);

            // Fetch only the collection section via Section Rendering API
            const fetchUrl = SECTION_ID
                ? `${url}${url.includes('?') ? '&' : '?'}sections=${SECTION_ID}`
                : url;

            const response = await fetch(fetchUrl, {
                headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
            });

            if (!response.ok) throw new Error('Filter request failed');

            const data = await response.json();
            const html = SECTION_ID ? data[SECTION_ID] : null;

            if (html) {
                // Parse and update just the products grid
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                const newGrid = doc.getElementById('collection-products');
                const newPagination = doc.getElementById('collection-pagination');
                const newFilterCount = doc.getElementById('filter-count');

                if (newGrid && productsGrid) {
                    productsGrid.innerHTML = newGrid.innerHTML;
                    // Re-trigger animations on new cards
                    if (window.ThemeAnimations) window.ThemeAnimations.refresh();
                }
                if (newPagination) {
                    document.getElementById('collection-pagination')?.replaceWith(newPagination);
                }
                if (newFilterCount && filterCount) {
                    filterCount.textContent = newFilterCount.textContent;
                }
            } else {
                // Fallback page reload if section rendering not available
                window.location.href = buildFilterUrl();
            }

            if (window.ThemeEvents) {
                window.ThemeEvents.emit('collection:filtered', { url: url.toString() });
            }

            // Scroll to top of grid
            productsGrid?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

        } catch (err) {
            console.error('[FilterComponent]', err);
            window.location.href = buildFilterUrl();
        } finally {
            isLoading = false;
            showLoading(false);
        }
    }

    // ----------------------------------------------------------------
    // Build filter URL from form + sort
    // ----------------------------------------------------------------
    function buildFilterUrl() {
        const formData = new FormData(filterForm || document.createElement('form'));
        const sortValue = sortSelect?.value;

        const params = new URLSearchParams();
        for (const [key, value] of formData.entries()) {
            if (value !== '') params.append(key, value);
        }

        if (sortValue) params.set('sort_by', sortValue);

        const baseUrl = window.location.pathname;
        const queryStr = params.toString();
        return queryStr ? `${baseUrl}?${queryStr}` : baseUrl;
    }

    // ----------------------------------------------------------------
    // Price slider sync — keep fill track aligned with thumb positions
    // ----------------------------------------------------------------
    function syncPriceSlider() {
        const minInput = document.querySelector('[data-price-min]');
        const maxInput = document.querySelector('[data-price-max]');
        const fillEl = document.querySelector('.filter-price__fill');

        if (!minInput || !maxInput || !fillEl) return;

        const min = parseInt(minInput.min, 10);
        const max = parseInt(minInput.max, 10);
        const minVal = parseInt(minInput.value, 10);
        const maxVal = parseInt(maxInput.value, 10);

        // Ensure min <= max
        if (minVal > maxVal) {
            minInput.value = maxVal;
            maxInput.value = minVal;
        }

        const leftPct = ((minVal - min) / (max - min)) * 100;
        const rightPct = ((maxVal - min) / (max - min)) * 100;

        fillEl.style.left = `${leftPct}%`;
        fillEl.style.right = `${100 - rightPct}%`;
    }

    // ----------------------------------------------------------------
    // Loading state
    // ----------------------------------------------------------------
    function showLoading(show) {
        if (loadingEl) loadingEl.hidden = !show;
        if (productsGrid) productsGrid.style.opacity = show ? '0.4' : '1';
    }

    // ----------------------------------------------------------------
    // Handle browser back/forward
    // ----------------------------------------------------------------
    window.addEventListener('popstate', () => {
        // On back/forward, simply re-render from current URL
        fetch(`${window.location.href}${window.location.href.includes('?') ? '&' : '?'}sections=${SECTION_ID}`, {
            headers: { 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' }
        })
            .then(r => r.json())
            .then(data => {
                if (data[SECTION_ID] && productsGrid) {
                    const doc = new DOMParser().parseFromString(data[SECTION_ID], 'text/html');
                    const newGrid = doc.getElementById('collection-products');
                    if (newGrid) productsGrid.innerHTML = newGrid.innerHTML;
                    if (window.ThemeAnimations) window.ThemeAnimations.refresh();
                }
            })
            .catch(() => window.location.reload());
    });

    // ----------------------------------------------------------------
    // Init price slider fill on load
    // ----------------------------------------------------------------
    syncPriceSlider();

    // Sort click handlers for grid/list that may be outside the form
    document.querySelectorAll('[data-view="grid"], [data-view="list"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const view = btn.dataset.view;
            if (productsGrid) {
                productsGrid.classList.toggle('collection-grid--list', view === 'list');
            }
            document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('is-active', b === btn));
            localStorage.setItem('collection-view', view);
        });
    });

    // Restore preferred view on load
    const savedView = localStorage.getItem('collection-view');
    if (savedView === 'list' && productsGrid) {
        productsGrid.classList.add('collection-grid--list');
        document.querySelector('[data-view="list"]')?.classList.add('is-active');
    }

})();
