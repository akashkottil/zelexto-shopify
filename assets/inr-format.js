/**
 * inr-format.js
 *
 * Scans `[data-money-cents]` elements; when the active currency is INR and
 * `data-inr-format="true"` is set, replaces the rendered text with
 * `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`.
 *
 * Re-runs:
 *   - On DOMContentLoaded
 *   - On cart:updated
 *   - On inr-format:rescan
 *   - When new nodes are added to the DOM (MutationObserver)
 *
 * Loaded eagerly — no Custom Element wrapper.
 */

(() => {
  const fmtINR = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  });

  function getActiveCurrency() {
    return (
      window.theme?.cart?.state?.currency ||
      window.theme?.shop?.currency ||
      window.Shopify?.currency?.active ||
      'INR'
    );
  }

  function shouldRun() {
    return getActiveCurrency() === 'INR';
  }

  function format(cents) {
    const n = Number(cents);
    if (!Number.isFinite(n)) return null;
    const amt = n / 100;
    return fmtINR.format(amt).replace(/\.00$/, '');
  }

  function applyTo(el) {
    if (!el || el.dataset.inrFormat !== 'true') return;
    const cents = el.dataset.moneyCents;
    const out = format(cents);
    if (out && el.textContent !== out) el.textContent = out;
  }

  function scan(root = document) {
    if (!shouldRun()) return;
    root.querySelectorAll('[data-money-cents][data-inr-format="true"]').forEach(applyTo);
  }

  function init() {
    scan();

    if (window.theme?.on) {
      window.theme.on('cart:updated', () => scan());
      window.theme.on('inr-format:rescan', () => scan());
    }

    const mo = new MutationObserver((mutations) => {
      if (!shouldRun()) return;
      for (const m of mutations) {
        if (m.type === 'attributes' && m.target.matches?.('[data-money-cents]')) {
          applyTo(m.target);
        } else if (m.type === 'childList') {
          m.addedNodes.forEach((node) => {
            if (node.nodeType !== 1) return;
            if (node.matches?.('[data-money-cents][data-inr-format="true"]')) applyTo(node);
            node.querySelectorAll?.('[data-money-cents][data-inr-format="true"]').forEach(applyTo);
          });
        }
      }
    });
    mo.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-money-cents'],
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
