/**
 * bundle.js — <bundle-builder>
 *
 * Tracks the selected tier (qty + percent), updates the summary, and on
 * "Add to bag" calls theme.cart.add with line item property
 * `properties[_bundle_tier]` so a Shopify Function / Discount app can apply
 * the discount.
 */

(() => {
  if (customElements.get('bundle-builder')) return;

  const fmt = (cents) => {
    try { return window.theme.formatMoney(cents); } catch (e) { return (cents / 100).toFixed(2); }
  };

  class BundleBuilder extends HTMLElement {
    connectedCallback() {
      this.variantId = this.getAttribute('data-variant-id');
      this.baseCents = parseInt(this.getAttribute('data-base-cents'), 10) || 0;
      this.qtyEl = this.querySelector('[data-summary-qty]');
      this.totalEl = this.querySelector('[data-summary-total]');
      this.msgEl = this.querySelector('[data-bundle-msg]');
      this.btn = this.querySelector('[data-bundle-add]');
      this.tiers = Array.from(this.querySelectorAll('[data-bundle-tier]'));

      this.tiers.forEach((tier) => {
        const radio = tier.querySelector('input[type=radio]');
        radio?.addEventListener('change', () => this.recalc());
      });
      this.btn?.addEventListener('click', () => this.add());

      // listen to variant changes to update base price
      if (window.theme?.on) {
        this._unsub = window.theme.on('variant:changed', (detail) => {
          if (detail?.variant?.id) {
            this.variantId = detail.variant.id;
            this.baseCents = detail.variant.price || this.baseCents;
            this.recalc();
          }
        });
      }
      this.recalc();
    }

    disconnectedCallback() {
      this._unsub?.();
    }

    selectedTier() {
      const checked = this.querySelector('input[name=bundle-tier]:checked');
      if (!checked) return null;
      const card = checked.closest('[data-bundle-tier]');
      return {
        qty: parseInt(card.dataset.qty, 10) || 1,
        percent: parseInt(card.dataset.percent, 10) || 0,
      };
    }

    recalc() {
      const tier = this.selectedTier() || { qty: 1, percent: 0 };
      const total = this.baseCents * tier.qty;
      const discount = Math.round(total * (tier.percent / 100));
      const final = total - discount;
      if (this.qtyEl) this.qtyEl.textContent = tier.qty;
      if (this.totalEl) this.totalEl.textContent = fmt(final);
      // update each card's final price label
      this.tiers.forEach((card) => {
        const q = parseInt(card.dataset.qty, 10) || 1;
        const p = parseInt(card.dataset.percent, 10) || 0;
        const t = this.baseCents * q;
        const f = t - Math.round(t * (p / 100));
        const finalEl = card.querySelector('[data-final-price]');
        if (finalEl) finalEl.textContent = fmt(f);
      });
    }

    async add() {
      const tier = this.selectedTier() || { qty: 1, percent: 0 };
      if (!this.variantId) return;
      this.btn.disabled = true;
      if (this.msgEl) this.msgEl.textContent = '';
      try {
        await window.theme.cart.add({
          id: this.variantId,
          quantity: tier.qty,
          properties: {
            _bundle_tier: `qty=${tier.qty};percent=${tier.percent}`
          }
        });
        if (this.msgEl) this.msgEl.textContent = window.themeStrings?.['bundle.added'] || 'Bundle added to bag';
      } catch (err) {
        if (this.msgEl) this.msgEl.textContent = (err && err.description) || (window.themeStrings?.['general.error'] || 'Something went wrong');
      } finally {
        this.btn.disabled = false;
      }
    }
  }

  customElements.define('bundle-builder', BundleBuilder);
})();
