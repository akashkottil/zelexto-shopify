/**
 * exit-intent.js — <exit-intent>
 *
 * Triggers on first of:
 *   - mouseleave from top of viewport (desktop only)
 *   - scroll past data-scroll-pct
 *   - data-time-seconds elapsed
 *
 * Cookie cooldown via data-cooldown-days. Submits to Klaviyo profile-
 * subscription-bulk-create-jobs (when klaviyoKey is set), with Shopify
 * customer create as fallback. Emits analytics:sign_up on success.
 */

(() => {
  if (customElements.get('exit-intent')) return;

  const COOKIE = 'zelexto_exit_intent';
  const has = (n) => document.cookie.split('; ').some((c) => c.startsWith(n + '='));
  const setCookie = (n, v, days) => {
    const d = new Date(); d.setTime(d.getTime() + days * 86400000);
    document.cookie = `${n}=${v}; path=/; expires=${d.toUTCString()}; SameSite=Lax`;
  };

  class ExitIntent extends HTMLElement {
    connectedCallback() {
      if (has(COOKIE)) {
        this.remove();
        return;
      }
      this.scrollPct = parseInt(this.getAttribute('data-scroll-pct'), 10) || 50;
      this.timeSeconds = parseInt(this.getAttribute('data-time-seconds'), 10) || 30;
      this.cooldownDays = parseInt(this.getAttribute('data-cooldown-days'), 10) || 7;

      this.dialog = this.querySelector('.exit-modal__dialog');
      this.form = this.querySelector('[data-form]');
      this.emailEl = this.querySelector('[data-email]');
      this.msgEl = this.querySelector('[data-msg]');
      this.submitBtn = this.querySelector('[data-submit]');

      this.querySelectorAll('[data-close]').forEach((el) =>
        el.addEventListener('click', () => this.dismiss(false)));
      this.form?.addEventListener('submit', (e) => this.submit(e));

      // Triggers
      this._fired = false;
      this._scrollHandler = () => this.checkScroll();
      this._mouseHandler = (e) => this.checkMouse(e);
      window.addEventListener('scroll', this._scrollHandler, { passive: true });
      if (window.matchMedia('(min-width: 768px)').matches) {
        document.addEventListener('mouseout', this._mouseHandler);
      }
      this._timeoutId = setTimeout(() => this.open(), this.timeSeconds * 1000);

      // Esc closes via theme bus
      if (window.theme?.on) {
        this._unsubEsc = window.theme.on('escape', () => {
          if (!this.hidden) this.dismiss(false);
        });
      }
    }

    disconnectedCallback() {
      clearTimeout(this._timeoutId);
      window.removeEventListener('scroll', this._scrollHandler);
      document.removeEventListener('mouseout', this._mouseHandler);
      this._unsubEsc?.();
      this._releaseTrap?.();
    }

    checkScroll() {
      if (this._fired) return;
      const scrolled = window.scrollY + window.innerHeight;
      const total = document.documentElement.scrollHeight;
      const pct = (scrolled / total) * 100;
      if (pct >= this.scrollPct) this.open();
    }

    checkMouse(e) {
      if (this._fired) return;
      if (!e.relatedTarget && e.clientY <= 5) this.open();
    }

    open() {
      if (this._fired || has(COOKIE)) return;
      this._fired = true;
      this.hidden = false;
      requestAnimationFrame(() => this.classList.add('is-open'));
      // a11y focus trap
      if (window.theme?.a11y?.trapFocus && this.dialog) {
        this._releaseTrap = window.theme.a11y.trapFocus(this.dialog);
      }
      // Don't fire again while open
      window.removeEventListener('scroll', this._scrollHandler);
      document.removeEventListener('mouseout', this._mouseHandler);
      clearTimeout(this._timeoutId);
    }

    dismiss(success) {
      this.classList.remove('is-open');
      this._releaseTrap?.();
      this._releaseTrap = null;
      // Cooldown shorter on dismiss-without-submit, full on success.
      const days = success ? this.cooldownDays * 4 : this.cooldownDays;
      setCookie(COOKIE, success ? 'sub' : 'dismissed', days);
      setTimeout(() => { this.hidden = true; }, 320);
    }

    async submit(e) {
      e.preventDefault();
      const email = (this.emailEl?.value || '').trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        this.message((window.themeStrings?.['exit_intent.error'] || 'Please enter a valid email address.'), 'error');
        return;
      }
      this.submitBtn.disabled = true;
      this.message('', '');
      try {
        await this.sendEmail(email);
        if (window.theme?.emit) {
          window.theme.emit('analytics:sign_up', { method: 'exit_intent', email });
        }
        this.message((window.themeStrings?.['exit_intent.success'] || 'Code sent — check your inbox.'), 'success');
        setTimeout(() => this.dismiss(true), 1200);
      } catch (err) {
        console.warn('[exit-intent] submit failed', err);
        this.message((window.themeStrings?.['exit_intent.error'] || 'Please try again.'), 'error');
      } finally {
        this.submitBtn.disabled = false;
      }
    }

    async sendEmail(email) {
      const cfg = window.themeAnalyticsConfig || {};
      // Klaviyo identify (front-end safe with public key)
      if (cfg.klaviyoKey && window._learnq) {
        window._learnq.push(['identify', { $email: email }]);
        window._learnq.push(['track', 'Subscribed to List', { $source: 'exit_intent' }]);
        return true;
      }
      // Shopify customer create fallback
      const fd = new FormData();
      fd.append('form_type', 'customer');
      fd.append('utf8', '✓');
      fd.append('contact[email]', email);
      fd.append('contact[tags]', 'newsletter,exit_intent');
      const res = await fetch('/contact#contact_form', { method: 'POST', body: fd });
      if (!res.ok) throw new Error('signup failed');
      return true;
    }

    message(text, kind) {
      if (!this.msgEl) return;
      this.msgEl.textContent = text;
      this.msgEl.classList.toggle('is-error', kind === 'error');
      this.msgEl.classList.toggle('is-success', kind === 'success');
    }
  }

  customElements.define('exit-intent', ExitIntent);
})();
