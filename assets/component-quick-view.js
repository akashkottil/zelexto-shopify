/**
 * ZELEXTO THEME — component-quick-view.js
 * Quick view modal using native <dialog>.
 * Loads product data via Shopify Storefront fetch.
 * Hydration guard: only runs when quick-view elements exist.
 */

(function () {
    'use strict';

    // Hydration guard
    if (!document.querySelector('[data-quick-view]')) return;

    let quickViewDialog = null;
    let previousFocus = null;

    // ----------------------------------------------------------------
    // Create dialog on demand (lazy DOM creation)
    // ----------------------------------------------------------------
    function getOrCreateDialog() {
        if (quickViewDialog) return quickViewDialog;

        quickViewDialog = document.createElement('dialog');
        quickViewDialog.id = 'quick-view-dialog';
        quickViewDialog.className = 'quick-view-dialog';
        quickViewDialog.setAttribute('aria-label', 'Quick view');
        quickViewDialog.innerHTML = `
      <div class="quick-view-dialog__inner">
        <button type="button" class="quick-view-dialog__close" id="qv-close" aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
        <div class="quick-view-dialog__content" id="qv-content">
          <div class="quick-view-dialog__loading">
            <div class="qv-spinner"></div>
          </div>
        </div>
      </div>
    `;
        document.body.appendChild(quickViewDialog);

        // Close on backdrop
        quickViewDialog.addEventListener('click', (e) => {
            if (e.target === quickViewDialog) closeQuickView();
        });

        // Close button
        quickViewDialog.querySelector('#qv-close').addEventListener('click', closeQuickView);

        return quickViewDialog;
    }

    // ----------------------------------------------------------------
    // Open quick view
    // ----------------------------------------------------------------
    async function openQuickView(productUrl, productTitle) {
        const dialog = getOrCreateDialog();
        previousFocus = document.activeElement;

        dialog.showModal();
        document.body.style.overflow = 'hidden';

        const content = dialog.querySelector('#qv-content');
        content.innerHTML = `<div class="quick-view-dialog__loading"><div class="qv-spinner"></div></div>`;

        try {
            // Fetch the product page using ?sections= to get only the product section
            const fetchUrl = productUrl.includes('?') ? productUrl : `${productUrl}?`;
            const html = await fetch(productUrl, {
                headers: { 'Accept': 'text/html, */*' }
            }).then(r => r.text());

            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');

            // Extract gallery + info columns from the product page
            const gallery = doc.querySelector('.product-page__gallery');
            const info = doc.querySelector('.product-page__info');

            if (gallery && info) {
                content.innerHTML = `
          <div class="quick-view-layout">
            ${gallery.outerHTML}
            <div class="quick-view-info">
              ${info.innerHTML}
            </div>
          </div>`;

                // Reinit gallery in mini context
                const thumbs = content.querySelectorAll('[data-thumb]');
                const slides = content.querySelectorAll('[data-slide]');
                if (thumbs.length > 1) initMiniGallery(slides, thumbs);

                // Reinit variant picker
                const varPicker = content.querySelector('[data-variant-picker]');
                if (varPicker) initMiniVariantPicker(varPicker, content);

                // Bind ATC button
                const atcBtn = content.querySelector('#atc-btn');
                const qvForm = content.querySelector('#product-form');
                if (qvForm && atcBtn) {
                    qvForm.addEventListener('submit', async (e) => {
                        e.preventDefault();
                        const variantId = parseInt(qvForm.querySelector('[data-variant-id]')?.value, 10);
                        if (!variantId || !window.addToCart) return;
                        atcBtn.disabled = true;
                        atcBtn.textContent = 'Adding...';
                        try {
                            await window.addToCart(variantId, 1);
                            atcBtn.textContent = 'Added!';
                            setTimeout(() => closeQuickView(), 800);
                        } catch (err) {
                            atcBtn.textContent = 'Error';
                            setTimeout(() => { atcBtn.disabled = false; atcBtn.textContent = 'Add to cart'; }, 2000);
                        }
                    });
                }
            } else {
                // Fallback: link to product page
                content.innerHTML = `
          <div class="quick-view-fallback">
            <p>${productTitle || 'Product'}</p>
            <a href="${productUrl}" class="btn btn--primary">View product</a>
          </div>`;
            }

        } catch (err) {
            console.error('[QuickView] Failed to load product:', err);
            content.innerHTML = `
        <div class="quick-view-fallback">
          <p>Unable to load product preview.</p>
          <a href="${productUrl}" class="btn btn--primary">View product</a>
        </div>`;
        }

        // Focus first focusable element
        setTimeout(() => {
            const firstFocusable = dialog.querySelector('a, button, [tabindex="0"]');
            firstFocusable?.focus();
        }, 50);
    }

    // ----------------------------------------------------------------
    // Close
    // ----------------------------------------------------------------
    function closeQuickView() {
        if (!quickViewDialog) return;
        quickViewDialog.close();
        document.body.style.overflow = '';
        previousFocus?.focus();
    }

    // ----------------------------------------------------------------
    // Mini gallery for quick view context
    // ----------------------------------------------------------------
    function initMiniGallery(slides, thumbs) {
        let current = 0;
        function goTo(idx) {
            slides[current]?.classList.remove('is-active');
            thumbs[current]?.classList.remove('is-active');
            current = idx;
            slides[current]?.classList.add('is-active');
            thumbs[current]?.classList.add('is-active');
        }
        thumbs.forEach((thumb, idx) => thumb.addEventListener('click', () => goTo(idx)));
    }

    // ----------------------------------------------------------------
    // Mini variant picker for quick view context
    // ----------------------------------------------------------------
    function initMiniVariantPicker(picker, container) {
        const variantsJson = container.querySelector('#product-variants-json');
        if (!variantsJson) return;
        let variants = [];
        try { variants = JSON.parse(variantsJson.textContent); } catch (e) { }

        let selectedOptions = [];
        const optionFields = picker.querySelectorAll('[data-option-index]');
        optionFields.forEach(field => {
            const idx = parseInt(field.dataset.optionIndex, 10);
            if (field.tagName === 'SELECT') selectedOptions[idx] = field.value;
            else if (field.type === 'radio' && field.checked) selectedOptions[idx] = field.value;
        });

        picker.addEventListener('change', (e) => {
            const field = e.target;
            const idx = parseInt(field.dataset.optionIndex, 10);
            if (!isNaN(idx)) selectedOptions[idx] = field.value;

            const matched = variants.find(v => v.options.every((opt, i) => opt === selectedOptions[i]));
            if (matched) {
                const variantId = container.querySelector('[data-variant-id]');
                if (variantId) variantId.value = matched.id;
                const atcBtn = container.querySelector('#atc-btn');
                if (atcBtn) {
                    atcBtn.disabled = !matched.available;
                    atcBtn.textContent = matched.available ? 'Add to cart' : 'Sold out';
                }
            }
        });
    }

    // ----------------------------------------------------------------
    // Bind all quick view triggers
    // ----------------------------------------------------------------
    document.addEventListener('click', (e) => {
        const trigger = e.target.closest('[data-quick-view]');
        if (!trigger) return;
        e.preventDefault();
        const productUrl = trigger.dataset.quickView;
        const productTitle = trigger.dataset.quickViewTitle;
        if (productUrl) openQuickView(productUrl, productTitle);
    });

    // ----------------------------------------------------------------
    // Inline dialog styles
    // ----------------------------------------------------------------
    const style = document.createElement('style');
    style.textContent = `
    .quick-view-dialog {
      border: none;
      border-radius: var(--radius-card);
      padding: 0;
      width: min(900px, 95vw);
      max-height: 90vh;
      overflow: auto;
      box-shadow: var(--shadow-xl);
    }
    .quick-view-dialog::backdrop { background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); }
    .quick-view-dialog[open] { animation: qv-in 0.2s ease; }
    @keyframes qv-in { from { opacity:0; transform: scale(0.96); } to { opacity:1; transform: scale(1); } }
    .quick-view-dialog__inner { position: relative; }
    .quick-view-dialog__close {
      position: absolute; top: var(--space-4); right: var(--space-4); z-index: 10;
      width: 36px; height: 36px;
      background: var(--color-bg);
      border: 1px solid var(--color-border);
      border-radius: var(--radius-full);
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
    }
    .quick-view-dialog__content { padding: var(--space-6); }
    .quick-view-dialog__loading { display: flex; align-items: center; justify-content: center; min-height: 300px; }
    .qv-spinner {
      width: 36px; height: 36px;
      border: 3px solid var(--color-border);
      border-top-color: var(--color-primary);
      border-radius: var(--radius-full);
      animation: spin 0.7s linear infinite;
    }
    .quick-view-layout { display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-8); }
    @media (max-width: 640px) { .quick-view-layout { grid-template-columns: 1fr; } }
    .quick-view-info { display: flex; flex-direction: column; gap: var(--space-4); }
    .quick-view-fallback { text-align: center; padding: var(--space-10); display: flex; flex-direction: column; align-items: center; gap: var(--space-4); }
  `;
    document.head.appendChild(style);

})();
