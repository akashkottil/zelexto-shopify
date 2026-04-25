/**
 * countdown.js — <countdown-timer>
 *
 * Reads `data-end` ISO datetime, ticks every second (or 60s when far away),
 * fills `[data-cd-days|hours|minutes|seconds]`, hides on expiry.
 *
 * Markup expected:
 *   <countdown-timer data-end="2026-12-31T23:59:00+05:30" data-expired="Ended">
 *     <span data-cd-days>--</span> <span data-cd-hours>--</span> ...
 *   </countdown-timer>
 */

(() => {
  if (customElements.get('countdown-timer')) return;

  class CountdownTimer extends HTMLElement {
    connectedCallback() {
      this.endMs = Date.parse(this.getAttribute('data-end') || '');
      if (Number.isNaN(this.endMs)) {
        this.hidden = true;
        return;
      }
      this.dEl = this.querySelector('[data-cd-days]');
      this.hEl = this.querySelector('[data-cd-hours]');
      this.mEl = this.querySelector('[data-cd-minutes]');
      this.sEl = this.querySelector('[data-cd-seconds]');
      this.tick();
      this.schedule();
    }

    disconnectedCallback() {
      clearTimeout(this._timer);
    }

    schedule() {
      clearTimeout(this._timer);
      const remaining = this.endMs - Date.now();
      // tick every second when within 1 hour, otherwise every minute
      const interval = remaining < 3600 * 1000 ? 1000 : 60 * 1000;
      this._timer = setTimeout(() => {
        this.tick();
        if (this.endMs - Date.now() > 0) this.schedule();
      }, interval);
    }

    tick() {
      const ms = this.endMs - Date.now();
      if (ms <= 0) {
        this.expire();
        return;
      }
      const totalSec = Math.floor(ms / 1000);
      const days = Math.floor(totalSec / 86400);
      const hours = Math.floor((totalSec % 86400) / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      const secs = totalSec % 60;
      const pad = (n) => String(n).padStart(2, '0');
      if (this.dEl) this.dEl.textContent = pad(days);
      if (this.hEl) this.hEl.textContent = pad(hours);
      if (this.mEl) this.mEl.textContent = pad(mins);
      if (this.sEl) this.sEl.textContent = pad(secs);
    }

    expire() {
      const expiredText = this.getAttribute('data-expired');
      if (expiredText) {
        this.textContent = expiredText;
      } else {
        this.hidden = true;
      }
      this.dispatchEvent(new CustomEvent('countdown:expired', { bubbles: true }));
    }
  }

  customElements.define('countdown-timer', CountdownTimer);
})();
