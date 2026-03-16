/**
 * ZELEXTO THEME — assets/parallax-engine.js
 * ============================================
 * 5-Layer scroll-driven parallax system.
 *
 * Layer mapping (data-parallax-speed):
 *   Background   → 0.5x
 *   Decorative   → 0.7x
 *   Images       → 0.8x
 *   Products     → 1.1x
 *   Text         → 1.0x  (standard, no offset)
 *
 * Architecture:
 *   - ONE shared scroll listener using passive+rAF scheduling
 *   - IntersectionObserver to only update visible sections
 *   - GPU-only transforms (translateY / translateX / scale)
 *   - Respects prefers-reduced-motion
 *   - Reduced intensity on mobile (< 768px)
 */

(function () {
    'use strict';

    // --- Reduced motion guard ---
    const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (REDUCED) return;

    // --- Mobile detection (refresh on resize via ResizeObserver) ---
    let IS_MOBILE = window.innerWidth < 768;
    const MOBILE_DAMPEN = 0.35; // multiply speed by this on mobile

    const roOpts = { passive: true };
    const resizeObs = new ResizeObserver(() => { IS_MOBILE = window.innerWidth < 768; });
    resizeObs.observe(document.documentElement);

    // --- Collect all parallax elements ---
    // Elements declare their speed via data-parallax-speed="0.5"
    // They can also declare data-parallax-axis="y|x" (default y)
    let elements = [];

    function collect() {
        elements = Array.from(document.querySelectorAll('[data-parallax-speed]')).map(el => {
            const speed = parseFloat(el.dataset.parallaxSpeed) || 0.5;
            const axis = el.dataset.parallaxAxis || 'y';
            const max = parseFloat(el.dataset.parallaxMax) || 120; // max px shift
            return { el, speed, axis, max, active: false, rect: null };
        });
    }

    // --- IntersectionObserver — only process visible elements ---
    const io = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            const item = elements.find(e => e.el === entry.target);
            if (item) {
                item.active = entry.isIntersecting;
                if (item.active) item.rect = item.el.getBoundingClientRect();
            }
        });
    }, { rootMargin: '20% 0px 20% 0px' });

    function observe() {
        elements.forEach(item => io.observe(item.el));
    }

    // --- rAF scroll loop ---
    let scrollY = window.scrollY;
    let rafId = null;
    let dirty = true;

    function onScroll() {
        scrollY = window.scrollY;
        if (!rafId) rafId = requestAnimationFrame(tick);
    }

    function tick() {
        rafId = null;
        const viewH = window.innerHeight;

        elements.forEach(item => {
            if (!item.active) return;

            const rect = item.el.getBoundingClientRect();
            // Distance of element center from viewport center (–ve = above, +ve = below)
            const center = rect.top + rect.height / 2 - viewH / 2;
            let speed = item.speed;

            if (IS_MOBILE) speed = speed * MOBILE_DAMPEN;

            // Offset: how far to shift relative to "neutral" (centered) position
            // Neutral = speed === 1.0 → offset 0
            const offset = Math.max(-item.max, Math.min(item.max, center * (speed - 1.0)));

            if (item.axis === 'x') {
                item.el.style.transform = `translateX(${offset.toFixed(2)}px)`;
            } else {
                item.el.style.transform = `translateY(${offset.toFixed(2)}px)`;
            }
        });
    }

    // --- Initialise ---
    function init() {
        collect();
        observe();
        window.addEventListener('scroll', onScroll, { passive: true });
        tick();
    }

    // --- Public API ---
    window.ParallaxEngine = {
        refresh() {
            elements.forEach(item => io.unobserve(item.el));
            collect();
            observe();
            tick();
        }
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
