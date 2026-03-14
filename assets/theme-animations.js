/**
 * ZELEXTO THEME — theme-animations.js
 * Lightweight animation engine using IntersectionObserver.
 *
 * - Single shared observer (NOT one per element — that's an anti-pattern)
 * - Zero scroll event listeners
 * - Respects prefers-reduced-motion
 * - Respects merchant's enable_animations setting
 * - Exposes ThemeAnimations.refresh() for dynamic/AJAX content
 */

(function () {
    'use strict';

    // ----------------------------------------------------------------
    // Guard: check merchant setting and user preference
    // ----------------------------------------------------------------
    const settings = window.themeSettings || {};
    const animationsEnabled = settings.animationsEnabled !== false;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // If animations disabled, ensure all elements are immediately visible
    if (!animationsEnabled || reducedMotion) {
        // Apply visible state to any pre-set animated elements immediately
        document.querySelectorAll('[data-animate]').forEach(el => {
            const animClass = el.dataset.animate;
            if (animClass) {
                el.classList.add(animClass, 'animate-visible', 'animate-done');
            }
        });
        // Don't initialise the observer at all
        return;
    }

    // ----------------------------------------------------------------
    // Single IntersectionObserver instance (critical for performance)
    // ----------------------------------------------------------------
    const THRESHOLD = 0.12;
    const ROOT_MARGIN = '0px 0px -40px 0px'; // Trigger slightly before element is fully in view

    let observer;

    function createObserver() {
        observer = new IntersectionObserver(onIntersect, {
            threshold: THRESHOLD,
            rootMargin: ROOT_MARGIN
        });
    }

    function onIntersect(entries) {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;

            const el = entry.target;
            const animClass = el.dataset.animate;

            if (animClass) {
                // Add the CSS class that triggers the transition
                el.classList.add(animClass, 'animate-visible');

                // Remove will-change after transition to free GPU layer
                el.addEventListener('transitionend', () => {
                    el.classList.add('animate-done');
                    el.style.willChange = 'auto';
                }, { once: true });
            }

            // Unobserve immediately — no need to keep watching
            observer.unobserve(el);
        });
    }

    // ----------------------------------------------------------------
    // Observe all [data-animate] elements
    // ----------------------------------------------------------------
    function observeElements(root) {
        const scope = root || document;
        // Performance improvement 4: only initialise if elements exist
        const elements = scope.querySelectorAll('[data-animate]:not(.animate-visible)');
        if (elements.length === 0) return;

        elements.forEach(el => {
            // Apply stagger delay if set as data attribute
            const delay = el.dataset.animateDelay;
            if (delay) {
                el.style.setProperty('--animation-delay', delay + 'ms');
            }
            observer.observe(el);
        });
    }

    // ----------------------------------------------------------------
    // Parallax engine
    // Runs on requestAnimationFrame — NOT on scroll event directly
    // Only active if parallax elements exist
    // ----------------------------------------------------------------
    let rafId = null;
    let lastScrollY = 0;

    function updateParallax() {
        const scrollY = window.scrollY;
        if (scrollY === lastScrollY) {
            rafId = requestAnimationFrame(updateParallax);
            return;
        }
        lastScrollY = scrollY;

        document.querySelectorAll('[data-parallax]').forEach(el => {
            const rect = el.getBoundingClientRect();
            // Only update if element is near viewport
            if (rect.bottom < -200 || rect.top > window.innerHeight + 200) return;

            const speed = parseFloat(el.dataset.parallax) || 0.3;
            const isMobile = window.innerWidth < 768;
            const multiplier = isMobile ? speed * 0.5 : speed; // 50% reduction on mobile
            const offset = (rect.top + rect.height / 2 - window.innerHeight / 2) * multiplier;

            el.style.setProperty('--parallax-offset', `${offset}px`);
        });

        rafId = requestAnimationFrame(updateParallax);
    }

    function initParallax() {
        const hasParallax = document.querySelector('[data-parallax]');
        if (!hasParallax) return;
        // Only run rAF loop when parallax elements exist on page
        rafId = requestAnimationFrame(updateParallax);

        // Pause when page is not visible (saves battery/CPU)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                cancelAnimationFrame(rafId);
            } else {
                rafId = requestAnimationFrame(updateParallax);
            }
        });
    }

    // ----------------------------------------------------------------
    // Public API
    // ----------------------------------------------------------------
    window.ThemeAnimations = {
        /**
         * Re-scan for new [data-animate] elements.
         * Call after AJAX section loads, quick view opens, etc.
         * @param {Element} [scope] - Optional root element to scan within
         */
        refresh(scope) {
            observeElements(scope);
        },

        /**
         * Manually trigger animation on a specific element.
         * Useful for programmatic reveals.
         * @param {Element} el
         */
        trigger(el) {
            if (!el) return;
            const animClass = el.dataset.animate;
            if (animClass) {
                el.classList.add(animClass, 'animate-visible');
            }
            observer.unobserve(el);
        },

        /**
         * Destroy the observer and cancel parallax loop.
         */
        destroy() {
            if (observer) observer.disconnect();
            if (rafId) cancelAnimationFrame(rafId);
        }
    };

    // ----------------------------------------------------------------
    // Init on DOMContentLoaded
    // ----------------------------------------------------------------
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    function init() {
        createObserver();
        observeElements();
        initParallax();

        // Notify other modules that animations are ready
        if (window.ThemeEvents) {
            window.ThemeEvents.emit('animations:ready');
        }
    }

})();
