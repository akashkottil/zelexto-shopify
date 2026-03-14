/**
 * ZELEXTO THEME — component-countdown.js
 * Countdown timer to a target date/time.
 * Updates DOM every second via setInterval.
 * Stops and emits ThemeEvents when expired.
 * Hydration guard: only runs when [data-countdown] elements exist.
 */

(function () {
    'use strict';

    const timers = document.querySelectorAll('[data-countdown]');
    if (!timers.length) return;

    const PAD = (n) => String(n).padStart(2, '0');

    timers.forEach(timer => {
        const targetISO = timer.dataset.countdown;
        if (!targetISO) return;

        const targetTime = new Date(targetISO).getTime();

        const daysEl = timer.querySelector('[data-countdown-days]');
        const hoursEl = timer.querySelector('[data-countdown-hours]');
        const minutesEl = timer.querySelector('[data-countdown-minutes]');
        const secondsEl = timer.querySelector('[data-countdown-seconds]');

        if (!secondsEl) return;

        function update() {
            const now = Date.now();
            const remaining = targetTime - now;

            if (remaining <= 0) {
                // Expired
                [daysEl, hoursEl, minutesEl, secondsEl].forEach(el => { if (el) el.textContent = '00'; });
                clearInterval(intervalId);
                timer.classList.add('is-expired');
                timer.setAttribute('aria-label', 'Sale ended');

                if (window.ThemeEvents) {
                    window.ThemeEvents.emit('countdown:expired', { element: timer });
                }
                return;
            }

            const days = Math.floor(remaining / (1000 * 60 * 60 * 24));
            const hours = Math.floor((remaining % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((remaining % (1000 * 60)) / 1000);

            if (daysEl) daysEl.textContent = PAD(days);
            if (hoursEl) hoursEl.textContent = PAD(hours);
            if (minutesEl) minutesEl.textContent = PAD(minutes);
            if (secondsEl) secondsEl.textContent = PAD(seconds);

            // ARIA live region update every 60 seconds for accessibility
            if (seconds === 0) {
                timer.setAttribute('aria-label', `${days}d ${PAD(hours)}h ${PAD(minutes)}m remaining`);
            }
        }

        update();
        const intervalId = setInterval(update, 1000);

        // Pause when tab hidden, resume when visible (battery/performance)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                clearInterval(intervalId);
            } else {
                update(); // Immediate catch-up
                setInterval(update, 1000);
            }
        });

    });

})();
