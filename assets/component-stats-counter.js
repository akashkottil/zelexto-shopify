/**
 * ZELEXTO THEME — component-stats-counter.js
 * Animates statistic numbers from 0 → target using requestAnimationFrame.
 * Triggered when elements enter viewport via the shared IntersectionObserver
 * already running in theme-animations.js.
 */

(function () {
    'use strict';

    // Performance improvement 4: skip entirely if no stats on page
    if (!document.querySelector('[data-counter-target]')) return;

    const DURATION = 2000; // ms
    const EASING = (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // easeInOut

    function animateCounter(el) {
        const target = parseFloat(el.dataset.counterTarget) || 0;
        const prefix = el.dataset.counterPrefix || '';
        const suffix = el.dataset.counterSuffix || '';
        const isDecimal = target % 1 !== 0;
        const decimals = isDecimal ? (target.toString().split('.')[1] || '').length : 0;

        let startTime = null;

        function frame(timestamp) {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / DURATION, 1);
            const easedProgress = EASING(progress);
            const current = target * easedProgress;

            el.textContent = prefix + formatNumber(current, decimals) + suffix;

            if (progress < 1) {
                requestAnimationFrame(frame);
            } else {
                el.textContent = prefix + formatNumber(target, decimals) + suffix;
            }
        }

        requestAnimationFrame(frame);
    }

    function formatNumber(num, decimals) {
        if (decimals > 0) return num.toFixed(decimals);
        return Math.round(num).toLocaleString();
    }

    // Use a dedicated IntersectionObserver for counters (separate from animation engine)
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            animateCounter(entry.target);
            observer.unobserve(entry.target); // Only animate once
        });
    }, { threshold: 0.3 });

    // Observe all counter elements
    document.querySelectorAll('[data-counter-target]').forEach(el => {
        observer.observe(el);
    });

})();
