/**
 * Zelexto v2 — money.js
 * Tiny helper that re-formats any element with [data-money-cents] using
 * window.theme.formatMoney. Useful when Liquid renders a server-side
 * amount that we want to localise client-side (e.g. INR lakh notation).
 *
 * Auto-applies on connect via MutationObserver so cart re-renders /
 * Section Rendering swaps stay formatted.
 */

(function () {
  function format(el) {
    const cents = parseInt(el.dataset.moneyCents, 10);
    if (Number.isNaN(cents)) return;
    const currency = el.dataset.currency || window.theme?.shop?.currency;
    if (!window.theme?.formatMoney) return;
    el.textContent = window.theme.formatMoney(cents, currency);
  }
  function applyAll(root = document) {
    root.querySelectorAll?.('[data-money-cents]').forEach(format);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => applyAll());
  } else {
    applyAll();
  }
  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((n) => {
        if (n.nodeType !== 1) return;
        if (n.matches?.('[data-money-cents]')) format(n);
        applyAll(n);
      });
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });
})();
