/**
 * ZELEXTO THEME — component-product.js
 * Variant selection, price update, availability, ATC, sticky mobile ATC.
 * Syncs with gallery via window.galleryGoTo().
 * Emits ThemeEvents on variant change.
 */

(function () {
    'use strict';

    // Hydration guard — only run on product pages
    if (!document.getElementById('product-form')) return;

    // ----------------------------------------------------------------
    // State & DOM refs
    // ----------------------------------------------------------------
    const form = document.getElementById('product-form');
    const variantIdField = form?.querySelector('[data-variant-id]');
    const variantPicker = document.getElementById('variant-picker');
    const priceContainer = document.getElementById('product-price');
    const atcBtn = document.getElementById('atc-btn');
    const atcBtnMobile = document.getElementById('atc-btn-mobile');
    const lowStockEl = document.getElementById('product-low-stock');
    const unavailableEl = document.getElementById('product-unavailable');
    const stickyBar = document.getElementById('sticky-atc-bar');

    // Parse all variant data from the page (injected by variant-picker.liquid)
    const variantsJson = document.getElementById('product-variants-json');
    let variants = [];
    if (variantsJson) {
        try { variants = JSON.parse(variantsJson.textContent); } catch (e) { }
    }

    // Current selected option values
    let selectedOptions = [];

    if (variantPicker) {
        // Init from currently checked/selected values
        const optionFields = variantPicker.querySelectorAll('[data-option-index]');
        optionFields.forEach(field => {
            const idx = parseInt(field.dataset.optionIndex, 10);
            if (field.tagName === 'SELECT') {
                selectedOptions[idx] = field.value;
            } else if (field.type === 'radio' && field.checked) {
                selectedOptions[idx] = field.value;
            }
        });
    }

    // ----------------------------------------------------------------
    // Listen for variant picker changes
    // ----------------------------------------------------------------
    if (variantPicker) {
        variantPicker.addEventListener('change', (e) => {
            const field = e.target;
            const idx = parseInt(field.dataset.optionIndex, 10);
            if (isNaN(idx)) return;

            selectedOptions[idx] = field.value;
            updateSelectedLabel(field);
            findAndApplyVariant();
        });
    }

    // ----------------------------------------------------------------
    // Find matching variant
    // ----------------------------------------------------------------
    function findAndApplyVariant() {
        const matched = variants.find(v => {
            return v.options.every((opt, idx) => opt === selectedOptions[idx]);
        });

        applyVariant(matched || null);
    }

    function applyVariant(variant) {
        if (!variant) {
            setUnavailable();
            return;
        }

        // Update hidden variant ID field
        if (variantIdField) variantIdField.value = variant.id;

        // Update URL (without reload)
        const url = new URL(window.location.href);
        url.searchParams.set('variant', variant.id);
        window.history.replaceState({}, '', url.toString());

        // Sync gallery to variant's featured media
        if (variant.featured_media && window.galleryGoTo) {
            window.galleryGoTo(variant.featured_media.id);
        }

        // Update price
        updatePrice(variant);

        // Update availability
        updateAvailability(variant);

        // Update unavailable size buttons
        updateUnavailableOptions(variant);

        // Emit theme event
        if (window.ThemeEvents) {
            window.ThemeEvents.emit('product:variant-changed', {
                variant,
                product: variants // note: this is variants array, product obj not available here
            });
        }
    }

    // ----------------------------------------------------------------
    // Update price display
    // ----------------------------------------------------------------
    function updatePrice(variant) {
        if (!priceContainer) return;

        const price = variant.price;
        const compareAt = variant.compare_at_price;
        const onSale = compareAt && compareAt > price;

        let html = '';
        if (onSale) {
            const pct = Math.round(((compareAt - price) / compareAt) * 100);
            html += `<span class="badge badge--sale">-${pct}%</span>`;
        }
        html += `<div class="price__values">`;
        html += `<span class="price__current">${formatMoney(price)}</span>`;
        if (onSale) {
            html += `<s class="price__compare">${formatMoney(compareAt)}</s>`;
        }
        html += `</div>`;

        priceContainer.innerHTML = html;
        priceContainer.className = `price${onSale ? ' price--on-sale' : ''}${!variant.available ? ' price--sold-out' : ''}`;
    }

    // ----------------------------------------------------------------
    // Update ATC button / low-stock / unavailable
    // ----------------------------------------------------------------
    function updateAvailability(variant) {
        const available = variant.available;

        [atcBtn, atcBtnMobile].forEach(btn => {
            if (!btn) return;
            btn.disabled = !available;
            btn.textContent = available
                ? btn.dataset.labelAvailable || 'Add to cart'
                : btn.dataset.labelSoldOut || 'Sold out';
        });

        // Low-stock warning (< 5 units)
        if (lowStockEl) {
            const LOW_STOCK_THRESHOLD = 5;
            const qty = variant.inventory_quantity || 0;
            const trackInventory = variant.inventory_management === 'shopify';
            const showLow = trackInventory && available && qty > 0 && qty <= LOW_STOCK_THRESHOLD;
            lowStockEl.hidden = !showLow;
            if (showLow) {
                const countEl = lowStockEl.querySelector('[data-low-stock-count]');
                if (countEl) countEl.textContent = qty;
            }
        }

        if (unavailableEl) {
            unavailableEl.hidden = available;
        }
    }

    function setUnavailable() {
        [atcBtn, atcBtnMobile].forEach(btn => {
            if (!btn) return;
            btn.disabled = true;
            btn.textContent = btn.dataset.labelUnavailable || 'Unavailable';
        });
    }

    // ----------------------------------------------------------------
    // Mark unavailable variant options (crossed out size buttons)
    // ----------------------------------------------------------------
    function updateUnavailableOptions(currentVariant) {
        if (!variantPicker) return;

        // For each option position, determine which values are still purchasable
        currentVariant.options.forEach((_, optIdx) => {
            const otherOptions = selectedOptions.filter((_, i) => i !== optIdx);
            const sizeBtns = variantPicker.querySelectorAll(`[data-option-index="${optIdx}"]`);

            sizeBtns.forEach(btn => {
                const testOptions = [...selectedOptions];
                testOptions[optIdx] = btn.value || btn.dataset.optionValue;
                const matchVariant = variants.find(v =>
                    v.options.every((opt, i) => opt === testOptions[i])
                );
                const label = btn.closest('.size-btn');
                if (label) {
                    label.classList.toggle('is-unavailable', matchVariant ? !matchVariant.available : true);
                }
            });
        });
    }

    // ----------------------------------------------------------------
    // Update selected label in legend
    // ----------------------------------------------------------------
    function updateSelectedLabel(field) {
        const fieldset = field.closest('fieldset');
        if (!fieldset) return;
        const display = fieldset.querySelector('.variant-picker__selected-value');
        if (display) display.textContent = `: ${field.value || field.dataset.optionValue}`;
    }

    // ----------------------------------------------------------------
    // Add to cart form submit
    // ----------------------------------------------------------------
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const btn = atcBtn;
            if (!btn || btn.disabled) return;

            const variantId = parseInt(variantIdField?.value, 10);
            const quantity = parseInt(form.querySelector('[data-quantity]')?.value || '1', 10);
            const properties = {};

            // Collect line item properties
            form.querySelectorAll('[name^="properties"]').forEach(el => {
                const key = el.name.replace('properties[', '').replace(']', '');
                properties[key] = el.value;
            });

            // Show loading state
            btn.disabled = true;
            const originalText = btn.textContent;
            btn.textContent = btn.dataset.labelAdding || 'Adding...';

            try {
                await window.addToCart(variantId, quantity, properties);
                btn.textContent = btn.dataset.labelAdded || 'Added!';
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.disabled = false;
                }, 1500);
            } catch (err) {
                btn.textContent = err.message || 'Error';
                setTimeout(() => {
                    btn.textContent = originalText;
                    btn.disabled = false;
                }, 2000);
            }
        });
    }

    // ----------------------------------------------------------------
    // Sticky mobile ATC bar
    // ----------------------------------------------------------------
    if (stickyBar && atcBtn) {
        // Show sticky bar when main ATC scrolls out of view
        const atcObserver = new IntersectionObserver(
            ([entry]) => {
                stickyBar.classList.toggle('is-visible', !entry.isIntersecting);
            },
            { threshold: 0 }
        );
        atcObserver.observe(atcBtn);

        // Sync sticky ATC click to main form submit
        if (atcBtnMobile) {
            atcBtnMobile.addEventListener('click', () => {
                form?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
            });
        }
    }

    // ----------------------------------------------------------------
    // Quantity selectors
    // ----------------------------------------------------------------
    const qtyWrap = document.getElementById('product-qty');
    if (qtyWrap) {
        const qtyInput = qtyWrap.querySelector('[data-quantity]');
        const qtyMinus = qtyWrap.querySelector('[data-qty-minus]');
        const qtyPlus = qtyWrap.querySelector('[data-qty-plus]');

        qtyMinus?.addEventListener('click', () => {
            const val = parseInt(qtyInput.value, 10);
            if (val > 1) qtyInput.value = val - 1;
        });

        qtyPlus?.addEventListener('click', () => {
            const val = parseInt(qtyInput.value, 10);
            const max = parseInt(qtyInput.max, 10) || 999;
            if (val < max) qtyInput.value = val + 1;
        });
    }

    // ----------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------
    function formatMoney(cents) {
        const moneyFormat = window.themeSettings?.moneyFormat || '${{amount}}';
        const amount = (cents / 100).toFixed(2);
        return moneyFormat.replace('{{amount}}', amount);
    }

    // ----------------------------------------------------------------
    // Init — apply current variant on load
    // ----------------------------------------------------------------
    findAndApplyVariant();

})();
