/**
 * Zelexto v2 — reveal.js
 *
 * IntersectionObserver-driven scroll reveals. Auto-binds anything with a
 * `data-reveal` attribute; toggles `.is-visible` once the element passes the
 * threshold so motion.css can run its transition.
 *
 * Eager bootstrap: runs at DOMContentLoaded and re-binds on any DOM mutation
 * (covers Section Rendering API swaps).
 *
 * Respects `prefers-reduced-motion` (motion.css already neutralises the
 * transition; we still set `.is-visible` so any `.is-visible`-scoped styles
 * apply immediately).
 */

(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!('IntersectionObserver' in window) || reduced) {
    document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-visible'));
    if (!('IntersectionObserver' in window)) return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    },
    {
      rootMargin: '0px 0px -10% 0px',
      threshold: 0.15,
    }
  );

  function bind(root = document) {
    const els = root.querySelectorAll
      ? root.querySelectorAll('[data-reveal]:not(.is-visible)')
      : [];
    els.forEach((el) => {
      const delay = el.getAttribute('data-reveal-delay');
      if (delay) el.style.setProperty('--reveal-delay', `${parseInt(delay, 10)}ms`);
      observer.observe(el);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => bind());
  } else {
    bind();
  }

  // Re-bind on DOM mutations (Section Rendering API replacing nodes)
  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((node) => {
        if (node.nodeType === 1) bind(node);
      });
    }
  });
  mo.observe(document.body || document.documentElement, { childList: true, subtree: true });
})();
