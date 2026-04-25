/**
 * Zelexto v2 — theme.js
 * Single bootstrap. Defines the event bus, common utilities, and lazy-loads
 * Custom Element modules on first interaction. No framework, ES modules.
 */

(() => {
  // ----- Event bus -----
  const handlers = new Map(); // event -> Set<fn>

  function on(event, fn) {
    if (!handlers.has(event)) handlers.set(event, new Set());
    handlers.get(event).add(fn);
    return () => off(event, fn);
  }
  function off(event, fn) {
    handlers.get(event)?.delete(fn);
  }
  function emit(event, payload) {
    handlers.get(event)?.forEach((fn) => {
      try { fn(payload); } catch (err) { console.error(`[theme] handler error for ${event}`, err); }
    });
  }

  // ----- Utilities -----
  const debounce = (fn, ms = 200) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), ms);
    };
  };

  const throttle = (fn, ms = 100) => {
    let last = 0; let t;
    return (...args) => {
      const now = Date.now();
      const remaining = ms - (now - last);
      if (remaining <= 0) {
        last = now;
        fn(...args);
      } else {
        clearTimeout(t);
        t = setTimeout(() => { last = Date.now(); fn(...args); }, remaining);
      }
    };
  };

  const formatMoney = (cents, currency = window.theme?.shop?.currency || 'INR', locale) => {
    const amount = cents / 100;
    const useLakh = currency === 'INR' && window.theme?.settings?.inr_lakh_format !== false;
    const fmtLocale = locale || (useLakh ? 'en-IN' : undefined);
    return new Intl.NumberFormat(fmtLocale, {
      style: 'currency',
      currency,
      maximumFractionDigits: cents % 100 === 0 ? 0 : 2,
    }).format(amount);
  };

  const fetchJSON = async (url, options = {}) => {
    const res = await fetch(url, {
      credentials: 'same-origin',
      ...options,
      headers: { Accept: 'application/json', ...(options.headers || {}) },
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    return res.json();
  };

  // ----- Module loading -----
  const moduleBase = document.documentElement.dataset.assetBase || '';
  const loaded = new Set();

  async function loadModule(name) {
    if (loaded.has(name)) return;
    loaded.add(name);
    try {
      await import(`${moduleBase}${name}`);
    } catch (err) {
      console.error(`[theme] failed to load module ${name}`, err);
      loaded.delete(name);
    }
  }

  // Element-driven lazy loading: any element with data-module="name" auto-loads
  // its module when it enters the viewport, on hover, or on first user interaction.
  function observeModules(root = document) {
    const els = root.querySelectorAll('[data-module]');
    if (!els.length) return;

    const io = 'IntersectionObserver' in window
      ? new IntersectionObserver((entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              e.target.dataset.module.split(/\s+/).forEach(loadModule);
              io.unobserve(e.target);
            }
          });
        }, { rootMargin: '200px' })
      : null;

    els.forEach((el) => {
      const eager = el.hasAttribute('data-module-eager');
      if (eager || !io) {
        el.dataset.module.split(/\s+/).forEach(loadModule);
      } else {
        io.observe(el);
        const onHover = () => {
          el.dataset.module.split(/\s+/).forEach(loadModule);
          el.removeEventListener('pointerover', onHover);
          io.unobserve(el);
        };
        el.addEventListener('pointerover', onHover, { once: true, passive: true });
      }
    });
  }

  // Re-observe when sections re-render via Shopify Section Rendering API
  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        observeModules(node);
      });
    }
  });

  // ----- Cart helpers (used by cart module + analytics) -----
  const cart = {
    state: window.theme?.cart || null,
    async fetch() {
      const data = await fetchJSON('/cart.js');
      this.state = data;
      emit('cart:updated', data);
      return data;
    },
    async add(items) {
      const body = Array.isArray(items) ? { items } : { items: [items] };
      const res = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        emit('cart:error', err);
        throw err;
      }
      const data = await res.json();
      const updated = await this.fetch();
      const lines = data.items || [data];
      lines.forEach((line) => emit('cart:item-added', { line, cart: updated }));
      return data;
    },
    async update(updates) {
      const data = await fetchJSON('/cart/update.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      this.state = data;
      emit('cart:updated', data);
      return data;
    },
    async change({ id, line, quantity, properties }) {
      const data = await fetchJSON('/cart/change.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, line, quantity, properties }),
      });
      this.state = data;
      emit('cart:updated', data);
      if (quantity === 0) emit('cart:item-removed', { id, line });
      return data;
    },
  };

  // ----- A11y helpers -----
  const a11y = {
    trapStack: [],
    trapFocus(container) {
      const selector = 'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
      const focusable = () => Array.from(container.querySelectorAll(selector));
      const handler = (e) => {
        if (e.key !== 'Tab') return;
        const els = focusable();
        if (!els.length) return;
        const first = els[0];
        const last = els[els.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      };
      container.addEventListener('keydown', handler);
      this.trapStack.push({ container, handler });
      const previouslyFocused = document.activeElement;
      requestAnimationFrame(() => focusable()[0]?.focus());
      return () => {
        container.removeEventListener('keydown', handler);
        this.trapStack.pop();
        previouslyFocused?.focus?.();
      };
    },
  };

  // ----- Boot -----
  const theme = {
    on, off, emit,
    debounce, throttle,
    formatMoney, fetchJSON,
    cart, a11y,
    loadModule,
    settings: window.theme?.settings || {},
    shop: window.theme?.shop || {},
  };
  // Preserve any properties already attached to window.theme (settings / shop / cart from Liquid)
  window.theme = Object.assign(theme, window.theme || {});

  // Keep the cart's state in sync with whatever Liquid gave us
  if (window.theme.cart && typeof window.theme.cart === 'object' && !window.theme.cart.fetch) {
    cart.state = window.theme.cart;
    window.theme.cart = cart;
  }

  // Escape closes drawers/modals globally
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') emit('escape');
  });

  // Boot module observation once DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      observeModules();
      mo.observe(document.body, { childList: true, subtree: true });
    });
  } else {
    observeModules();
    mo.observe(document.body, { childList: true, subtree: true });
  }
})();
