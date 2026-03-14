/**
 * ZELEXTO THEME — component-cart.js
 * Ajax cart with Shopify Cart API, drawer open/close, quantity changes.
 * Emits ThemeEvents so apps can react to cart updates.
 */

(function () {
    'use strict';

    // Hydration guard: only init if cart elements exist
    if (!document.querySelector('[data-cart-toggle], [data-cart-close]')) return;

    const drawer = document.getElementById('cart-drawer');
    const overlay = document.getElementById('cart-drawer-overlay');
    const itemsRoot = document.getElementById('cart-drawer-items');
    const countEl = document.getElementById('cart-count');
    const drawerCount = document.getElementById('cart-drawer-count');
    const totalEl = document.getElementById('cart-total');
    const checkoutBtn = document.getElementById('cart-checkout-btn');
    const shippingBar = document.getElementById('cart-shipping-bar');

    let previousFocus = null;

    // ----------------------------------------------------------------
    // State
    // ----------------------------------------------------------------
    const state = {
        loading: false
    };

    // ----------------------------------------------------------------
    // Open / Close
    // ----------------------------------------------------------------
    function openDrawer() {
        if (!drawer) return;
        previousFocus = document.activeElement;
        drawer.classList.add('is-open');
        if (overlay) overlay.classList.add('is-open');
        drawer.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        // Focus first focusable element in drawer
        const firstFocusable = drawer.querySelector('a[href], button:not([disabled])');
        if (firstFocusable) setTimeout(() => firstFocusable.focus(), 50);

        document.querySelectorAll('[data-cart-toggle]').forEach(b => b.setAttribute('aria-expanded', 'true'));

        if (window.ThemeEvents) window.ThemeEvents.emit('cart:drawer-opened');
    }

    function closeDrawer() {
        if (!drawer) return;
        drawer.classList.remove('is-open');
        if (overlay) overlay.classList.remove('is-open');
        drawer.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        if (previousFocus) previousFocus.focus();
        document.querySelectorAll('[data-cart-toggle]').forEach(b => b.setAttribute('aria-expanded', 'false'));

        if (window.ThemeEvents) window.ThemeEvents.emit('cart:drawer-closed');
    }

    // Toggle buttons (cart icon in header)
    document.querySelectorAll('[data-cart-toggle]').forEach(btn => {
        btn.addEventListener('click', () => {
            const isOpen = drawer && drawer.classList.contains('is-open');
            isOpen ? closeDrawer() : openDrawer();
        });
    });

    // Close buttons & overlay
    document.querySelectorAll('[data-cart-close]').forEach(btn => btn.addEventListener('click', closeDrawer));
    if (overlay) overlay.addEventListener('click', closeDrawer);

    // ESC key
    if (drawer) {
        drawer.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeDrawer();
        });
    }

    // ----------------------------------------------------------------
    // Quantity change
    // ----------------------------------------------------------------
    if (itemsRoot) {
        itemsRoot.addEventListener('click', async (e) => {
            // Quantity change
            const qtyBtn = e.target.closest('[data-cart-qty-change]');
            if (qtyBtn) {
                const key = qtyBtn.dataset.cartQtyChange;
                const delta = parseInt(qtyBtn.dataset.qtyDelta, 10);
                const display = document.getElementById(`qty-${key}`);
                const currentQty = parseInt(display?.textContent || '1', 10);
                const newQty = Math.max(0, currentQty + delta);
                await updateQuantity(key, newQty);
                return;
            }

            // Remove
            const removeBtn = e.target.closest('[data-cart-remove]');
            if (removeBtn) {
                const key = removeBtn.dataset.cartRemove;
                await updateQuantity(key, 0);
            }
        });
    }

    // ----------------------------------------------------------------
    // Add to Cart (external – called by product page JS)
    // ----------------------------------------------------------------
    window.addToCart = async function (variantId, quantity = 1, properties = {}) {
        try {
            const response = await fetch('/cart/add.js', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ id: variantId, quantity, properties })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.description || 'Failed to add to cart');
            }

            const item = await response.json();
            await refreshCart();
            openDrawer();

            if (window.ThemeEvents) window.ThemeEvents.emit('cart:item-added', { item });
            return item;

        } catch (err) {
            console.error('[CartComponent] Add to cart failed:', err);
            throw err;
        }
    };

    // ----------------------------------------------------------------
    // Update quantity (change or remove)
    // ----------------------------------------------------------------
    async function updateQuantity(key, quantity) {
        if (state.loading) return;
        state.loading = true;

        try {
            const response = await fetch('/cart/change.js', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
                body: JSON.stringify({ id: key, quantity })
            });

            if (!response.ok) throw new Error('Cart change failed');

            const cart = await response.json();
            await refreshCartUI(cart);

            if (window.ThemeEvents) window.ThemeEvents.emit('cart:updated', cart);

        } catch (err) {
            console.error('[CartComponent] Update quantity failed:', err);
        } finally {
            state.loading = false;
        }
    }

    // ----------------------------------------------------------------
    // Refresh cart (full re-render via Section Rendering API)
    // ----------------------------------------------------------------
    async function refreshCart() {
        try {
            const response = await fetch(`${window.location.pathname}?sections=cart-drawer`, {
                headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' }
            });

            if (!response.ok) throw new Error('Section render failed');

            const data = await response.json();
            if (data['cart-drawer']) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(data['cart-drawer'], 'text/html');
                const newItems = doc.getElementById('cart-drawer-items');
                const newFooter = doc.getElementById('cart-drawer-footer');

                if (newItems && itemsRoot) {
                    itemsRoot.innerHTML = newItems.innerHTML;
                }
                if (newFooter) {
                    const existingFooter = document.getElementById('cart-drawer-footer');
                    if (existingFooter) existingFooter.innerHTML = newFooter.innerHTML;
                }
            }

            // Also get updated cart JSON for count/total
            const cartResponse = await fetch('/cart.js', { headers: { 'Accept': 'application/json' } });
            const cart = await cartResponse.json();
            updateCountDisplay(cart.item_count, cart.total_price);

        } catch (err) {
            // Fallback: reload the page
            console.warn('[CartComponent] Section render failed, reloading:', err);
            window.location.reload();
        }
    }

    // Lighter update — only updates counts + totals from existing cart data
    async function refreshCartUI(cart) {
        updateCountDisplay(cart.item_count, cart.total_price);
        updateShippingBar(cart.total_price);
        await refreshCart(); // Full re-render for line items
    }

    function updateCountDisplay(count, totalPrice) {
        // Header cart count badge
        if (countEl) {
            countEl.textContent = count;
            countEl.classList.toggle('cart-count--empty', count === 0);
        }
        // Drawer count
        if (drawerCount) drawerCount.textContent = `(${count})`;
        // Drawer total
        if (totalEl) totalEl.textContent = formatMoney(totalPrice);
        // Checkout button
        if (checkoutBtn) checkoutBtn.textContent = `${getLang('checkout')} — ${formatMoney(totalPrice)}`;
        // Update head aria label
        document.querySelectorAll('[data-cart-toggle]').forEach(btn => {
            btn.setAttribute('aria-label', `${getLang('cart')}: ${count} ${getLang('items')}`);
        });
    }

    function updateShippingBar(totalPrice) {
        if (!shippingBar) return;
        const threshold = (window.themeSettings?.freeShippingThreshold || 0) * 100;
        if (!threshold) return;
        const pct = Math.min(Math.round((totalPrice / threshold) * 100), 100);
        const fill = shippingBar.querySelector('.shipping-bar__fill');
        if (fill) fill.style.width = pct + '%';
    }

    // ----------------------------------------------------------------
    // Helpers
    // ----------------------------------------------------------------
    function formatMoney(cents) {
        const moneyFormat = window.themeSettings?.moneyFormat || '${{amount}}';
        const amount = (cents / 100).toFixed(2);
        return moneyFormat.replace('{{amount}}', amount);
    }

    function getLang(key) {
        const map = { checkout: 'Checkout', cart: 'Cart', items: 'items' };
        return map[key] || '';
    }

    // ----------------------------------------------------------------
    // Listen for events from other modules
    // ----------------------------------------------------------------
    if (window.ThemeEvents) {
        window.ThemeEvents.on('theme:ready', () => {
            // Cart ready — nothing to do, drawer already initialised
        });
    }

})();
