/**
 * Zelexto v2 — analytics.js
 * Single dispatcher for GA4, GTM, Meta Pixel, Klaviyo.
 *
 * Reads `window.themeAnalyticsConfig` (rendered by snippets/analytics-config.liquid).
 * Subscribes to ThemeEvents (window.theme bus) and translates to channel-specific calls.
 * Honors consent — when `analytics_require_consent` is on and no `zelexto_consent`
 * cookie is set, events are queued and flushed on accept.
 *
 * Public API:
 *   window.ZAnalytics.track(eventName, payload)
 *   window.ZAnalytics.viewItem(productJson)        // PDP first paint
 *   window.ZAnalytics.setConsent('accept'|'reject')
 *   window.ZAnalytics.flushQueue()
 */

(() => {
  const CONSENT_COOKIE = 'zelexto_consent';
  const CONSENT_DAYS = 180;
  const cfg = (window.themeAnalyticsConfig || {});

  // ---- Cookie helpers ----
  const getCookie = (name) => {
    const m = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return m ? decodeURIComponent(m[2]) : null;
  };
  const setCookie = (name, value, days) => {
    const d = new Date();
    d.setTime(d.getTime() + days * 24 * 60 * 60 * 1000);
    document.cookie = `${name}=${encodeURIComponent(value)}; path=/; expires=${d.toUTCString()}; SameSite=Lax`;
  };

  // ---- Consent ----
  let consent = getCookie(CONSENT_COOKIE);
  const requireConsent = !!cfg.requireConsent;
  const queue = [];

  const isAllowed = () => !requireConsent || consent === 'accept';

  // ---- Channel mapping ----
  const META_MAP = {
    view_item: 'ViewContent',
    view_item_list: 'ViewContent',
    add_to_cart: 'AddToCart',
    remove_from_cart: 'RemoveFromCart',
    view_cart: 'ViewCart',
    begin_checkout: 'InitiateCheckout',
    add_payment_info: 'AddPaymentInfo',
    purchase: 'Purchase',
    search: 'Search',
    sign_up: 'Lead',
    view_promotion: 'ViewContent',
    cart_abandoned: 'AddToCart'
  };

  const KLAVIYO_MAP = {
    view_item: 'Viewed Product',
    view_item_list: 'Viewed Product List',
    add_to_cart: 'Added to Cart',
    remove_from_cart: 'Removed from Cart',
    view_cart: 'Viewed Cart',
    begin_checkout: 'Started Checkout',
    purchase: 'Placed Order',
    search: 'Searched Site',
    sign_up: 'Subscribed to List',
    cart_abandoned: 'Abandoned Cart'
  };

  // ---- Dispatchers ----
  function dispatch(event, payload) {
    if (!isAllowed()) {
      queue.push([event, payload]);
      return;
    }
    try { sendGTM(event, payload); } catch (e) { console.warn('[analytics] GTM', e); }
    try { sendGA4(event, payload); } catch (e) { console.warn('[analytics] GA4', e); }
    try { sendMeta(event, payload); } catch (e) { console.warn('[analytics] Meta', e); }
    try { sendKlaviyo(event, payload); } catch (e) { console.warn('[analytics] Klaviyo', e); }
  }

  function sendGTM(event, payload) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push(Object.assign({ event }, payload || {}));
  }

  function sendGA4(event, payload) {
    if (!cfg.ga4Id || typeof window.gtag !== 'function') return;
    window.gtag('event', event, payload || {});
  }

  function sendMeta(event, payload) {
    if (!cfg.metaPixelId || typeof window.fbq !== 'function') return;
    const metaName = META_MAP[event];
    if (!metaName) return;
    const params = {};
    if (payload) {
      if (payload.value != null) params.value = payload.value;
      if (payload.currency) params.currency = payload.currency;
      if (payload.items) {
        params.contents = payload.items.map((it) => ({
          id: String(it.id || it.item_id || ''),
          quantity: it.quantity || 1,
          item_price: it.price
        }));
        params.content_type = 'product';
      }
      if (payload.search_term) params.search_string = payload.search_term;
    }
    window.fbq('track', metaName, params);
  }

  function sendKlaviyo(event, payload) {
    if (!cfg.klaviyoKey) return;
    window._learnq = window._learnq || [];
    const klName = KLAVIYO_MAP[event] || event;
    window._learnq.push(['track', klName, payload || {}]);
  }

  // ---- Public API ----
  function track(eventName, payload) {
    dispatch(eventName, payload || {});
  }

  function viewItem(productJson) {
    if (!productJson) return;
    track('view_item', {
      currency: productJson.currency || cfg.currency,
      value: parseFloat(productJson.price) || undefined,
      items: [{
        item_id: productJson.id,
        item_name: productJson.name,
        item_brand: productJson.brand,
        item_category: productJson.category,
        price: parseFloat(productJson.price) || undefined,
        quantity: 1
      }]
    });
    if (cfg.klaviyoKey) {
      window._learnq = window._learnq || [];
      window._learnq.push(['track', 'Viewed Product', {
        ProductName: productJson.name,
        ProductID: productJson.id,
        Handle: productJson.handle,
        Price: parseFloat(productJson.price),
        Brand: productJson.brand
      }]);
    }
  }

  function flushQueue() {
    while (queue.length) {
      const [event, payload] = queue.shift();
      dispatch(event, payload);
    }
  }

  function setConsent(value) {
    consent = value;
    setCookie(CONSENT_COOKIE, value, CONSENT_DAYS);
    hideConsentBanner();
    if (value === 'accept') flushQueue();
    else queue.length = 0;
    document.dispatchEvent(new CustomEvent('zanalytics:consent', { detail: value }));
  }

  // ---- Cart bus subscriptions ----
  function lineToItem(line) {
    if (!line) return null;
    return {
      item_id: line.product_id || line.id,
      item_variant: line.variant_id || line.id,
      item_name: line.product_title || line.title,
      price: (line.final_price || line.price || 0) / 100,
      quantity: line.quantity || 1,
      currency: cfg.currency
    };
  }

  function bindBus() {
    if (!window.theme || typeof window.theme.on !== 'function') return;
    const on = window.theme.on;

    on('cart:item-added', ({ line, cart }) => {
      const item = lineToItem(line);
      if (!item) return;
      track('add_to_cart', {
        currency: cfg.currency,
        value: item.price * item.quantity,
        items: [item]
      });
    });

    on('cart:item-removed', ({ line, id }) => {
      track('remove_from_cart', {
        currency: cfg.currency,
        items: [{ item_id: id || (line && line.id), quantity: 0 }]
      });
    });

    on('cart:drawer-opened', (cart) => {
      track('view_cart', {
        currency: cfg.currency,
        value: cart && cart.total_price ? cart.total_price / 100 : undefined,
        items: (cart && cart.items || []).map(lineToItem).filter(Boolean)
      });
    });

    on('cart:checkout-clicked', (cart) => {
      track('begin_checkout', {
        currency: cfg.currency,
        value: cart && cart.total_price ? cart.total_price / 100 : undefined,
        items: (cart && cart.items || []).map(lineToItem).filter(Boolean)
      });
    });

    on('search:submitted', ({ query, results } = {}) => {
      track('search', { search_term: query || '', result_count: (results || []).length });
    });

    on('analytics:sign_up', (payload) => {
      track('sign_up', payload || {});
    });

    on('analytics:cart_abandoned', (payload) => {
      track('cart_abandoned', payload || {});
    });
  }

  // ---- view_item_list via IntersectionObserver ----
  function observeProductCards() {
    if (!('IntersectionObserver' in window)) return;
    const seen = new WeakSet();
    let pending = [];
    let timer = null;

    const flush = () => {
      if (!pending.length) return;
      const items = pending.map((el) => ({
        item_id: el.dataset.productId,
        item_name: el.dataset.productTitle,
        item_list_name: el.dataset.listName,
        price: parseFloat(el.dataset.productPrice) || undefined,
        currency: cfg.currency
      }));
      track('view_item_list', { currency: cfg.currency, items });
      pending = [];
    };

    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && !seen.has(e.target)) {
          seen.add(e.target);
          pending.push(e.target);
          io.unobserve(e.target);
        }
      });
      clearTimeout(timer);
      timer = setTimeout(flush, 500);
    }, { rootMargin: '0px 0px 0px 0px', threshold: 0.5 });

    const scan = (root = document) => {
      root.querySelectorAll('[data-product-card]').forEach((el) => io.observe(el));
    };
    scan();
    const mo = new MutationObserver((mutations) => {
      mutations.forEach((m) => m.addedNodes.forEach((n) => {
        if (n.nodeType === 1) {
          if (n.matches && n.matches('[data-product-card]')) io.observe(n);
          if (n.querySelectorAll) n.querySelectorAll('[data-product-card]').forEach((el) => io.observe(el));
        }
      }));
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }

  // ---- Consent banner ----
  let bannerEl = null;
  function showConsentBanner() {
    if (bannerEl || !requireConsent || consent) return;
    bannerEl = document.createElement('div');
    bannerEl.className = 'consent-banner';
    bannerEl.setAttribute('role', 'dialog');
    bannerEl.setAttribute('aria-live', 'polite');
    bannerEl.setAttribute('aria-label', getString('analytics.consent_title', 'We use cookies'));
    bannerEl.innerHTML = `
      <div class="consent-banner__inner">
        <div class="consent-banner__copy">
          <strong>${getString('analytics.consent_title', 'We use cookies')}</strong>
          <p>${getString('analytics.consent_body', 'We use cookies to personalise content and analyse traffic.')}</p>
        </div>
        <div class="consent-banner__actions">
          <button type="button" class="btn btn--ghost" data-consent="reject">${getString('analytics.consent_reject', 'Reject')}</button>
          <button type="button" class="btn btn--primary" data-consent="accept">${getString('analytics.consent_accept', 'Accept')}</button>
        </div>
      </div>
    `;
    bannerEl.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-consent]');
      if (btn) setConsent(btn.dataset.consent);
    });
    document.body.appendChild(bannerEl);
  }
  function hideConsentBanner() {
    if (bannerEl) {
      bannerEl.classList.add('is-leaving');
      setTimeout(() => { bannerEl?.remove(); bannerEl = null; }, 300);
    }
  }

  function getString(key, fallback) {
    // Locales aren't auto-injected; fallback used unless a host page overrides.
    if (window.themeStrings && window.themeStrings[key]) return window.themeStrings[key];
    return fallback;
  }

  // ---- Boot ----
  const ZAnalytics = { track, viewItem, setConsent, flushQueue };
  window.ZAnalytics = ZAnalytics;
  document.dispatchEvent(new CustomEvent('zanalytics:ready'));

  bindBus();
  observeProductCards();
  if (requireConsent && !consent) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', showConsentBanner);
    } else {
      showConsentBanner();
    }
  }
})();
