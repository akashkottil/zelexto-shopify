/**
 * social-proof.js — <social-proof-toast>
 *
 * Reads its feed from a `data-feed` attribute (escaped JSON) on the element.
 * Cycles entries with fade transitions; pauses on hover; cookie cooldown
 * after dismiss. Interval is in seconds (multiplied by 1000 internally).
 *
 * Locale strings expected on window.themeStrings (best effort) — falls back
 * to the message string already on the entry.
 */

(() => {
  if (customElements.get('social-proof-toast')) return;

  const COOKIE = 'zelexto_proof_dismissed';
  const has = (n) => document.cookie.split('; ').some((c) => c.startsWith(n + '='));
  const setCookie = (n, v, days) => {
    const d = new Date(); d.setTime(d.getTime() + days * 86400000);
    document.cookie = `${n}=${v}; path=/; expires=${d.toUTCString()}; SameSite=Lax`;
  };

  class SocialProofToast extends HTMLElement {
    connectedCallback() {
      if (has(COOKIE)) return;
      let feed = [];
      try { feed = JSON.parse(this.getAttribute('data-feed') || '[]'); } catch (e) {}
      this.feed = (feed || []).filter((e) => e && (e.name || e.product));
      if (!this.feed.length) return;

      // interval is in seconds; convert to ms (legacy ms values still work)
      const raw = parseInt(this.getAttribute('data-interval'), 10) || 6;
      this.interval = raw < 100 ? raw * 1000 : raw;
      this.maxItems = parseInt(this.getAttribute('data-max'), 10) || this.feed.length;
      this.shown = 0;
      this.idx = 0;
      this.paused = false;
      this.msgEl = this.querySelector('[data-msg]');
      this.timeEl = this.querySelector('[data-time]');

      this.addEventListener('mouseenter', () => { this.paused = true; });
      this.addEventListener('mouseleave', () => { this.paused = false; });
      this.querySelector('[data-close]')?.addEventListener('click', () => this.dismiss());

      // initial delay before first toast
      this._timer = setTimeout(() => this.cycle(), Math.min(4000, this.interval));
    }

    disconnectedCallback() {
      clearTimeout(this._timer);
    }

    cycle() {
      if (this.paused) {
        this._timer = setTimeout(() => this.cycle(), 1000);
        return;
      }
      if (this.shown >= this.maxItems) {
        this.hide();
        return;
      }
      this.show(this.feed[this.idx % this.feed.length]);
      this.idx++;
      this.shown++;
      this._timer = setTimeout(() => {
        this.hide();
        this._timer = setTimeout(() => this.cycle(), 800);
      }, this.interval);
    }

    show(entry) {
      this.hidden = false;
      const tpl = (window.themeStrings && window.themeStrings['urgency.recently_sold'])
        || '{{ name }} from {{ city }} bought {{ product }}';
      const msg = tpl
        .replace('{{ name }}', entry.name || '')
        .replace('{{ city }}', entry.city || '')
        .replace('{{ product }}', entry.product || '');
      if (this.msgEl) this.msgEl.textContent = msg;
      if (this.timeEl) this.timeEl.textContent = entry.ago || '';
      requestAnimationFrame(() => this.classList.add('is-visible'));
    }

    hide() {
      this.classList.remove('is-visible');
      setTimeout(() => { this.hidden = true; }, 300);
    }

    dismiss() {
      clearTimeout(this._timer);
      setCookie(COOKIE, '1', 1);
      this.hide();
    }
  }

  customElements.define('social-proof-toast', SocialProofToast);
})();
