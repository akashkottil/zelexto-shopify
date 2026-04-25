/**
 * cart-abandonment.js
 *
 * Listens to cart:item-added / cart:updated. After `timeout` seconds with no
 * further activity, emits `analytics:cart_abandoned` with the cart payload.
 *
 * Mount with a placeholder element:
 *   <span data-module="cart-abandonment.js" data-module-eager data-timeout="60"
 *         hidden></span>
 *
 * Klaviyo Web Tracking (when on) auto-picks the `Abandoned Cart` event up
 * via _learnq once analytics.js maps it.
 */

(() => {
  if (window.__zCartAbandonInited) return;

  function init() {
    if (!window.theme || !window.theme.on) return;
    const host = document.querySelector('[data-module*="cart-abandonment.js"]');
    const timeoutSec = parseInt(host?.dataset.timeout, 10) || 60;
    let timer = null;

    const arm = (cart) => {
      clearTimeout(timer);
      if (!cart || !cart.item_count || cart.item_count <= 0) return;
      timer = setTimeout(() => {
        window.theme.emit('analytics:cart_abandoned', {
          item_count: cart.item_count,
          value: cart.total_price ? cart.total_price / 100 : 0,
          currency: (window.themeAnalyticsConfig && window.themeAnalyticsConfig.currency) || 'INR',
          items: (cart.items || []).map((i) => ({
            item_id: i.product_id,
            item_variant: i.variant_id,
            item_name: i.product_title || i.title,
            quantity: i.quantity,
            price: (i.final_price || i.price || 0) / 100
          }))
        });
      }, timeoutSec * 1000);
    };

    window.theme.on('cart:item-added', ({ cart }) => arm(cart));
    window.theme.on('cart:updated', (cart) => arm(cart));
    // Cancel timer when user heads to checkout
    window.theme.on('cart:checkout-clicked', () => clearTimeout(timer));
    window.__zCartAbandonInited = true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
