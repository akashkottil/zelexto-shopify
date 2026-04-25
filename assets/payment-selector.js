/**
 * payment-selector.js
 *
 * <payment-selector>
 *   - On radio change: writes cart.attributes.payment_intent via theme.cart.update.
 *   - Emits cart:payment-method-changed.
 *   - Toggles the [data-partial-summary] block based on the selected method.
 *   - Re-renders the partial-pay summary numbers on cart:updated.
 */

class PaymentSelector extends HTMLElement {
  connectedCallback() {
    this.advancePct = parseInt(this.dataset.advancePercent || '20', 10);
    this.minPartial = parseInt(this.dataset.minPartial || '0', 10);
    this.partialBlock = this.querySelector('[data-partial-summary]');
    this.statusEl = this.querySelector('[data-payment-status]');

    this._radios = Array.from(this.querySelectorAll('input[data-payment-intent]'));
    this._radios.forEach((r) => r.addEventListener('change', () => this._onChange(r)));

    this._unsub = window.theme?.on?.('cart:updated', (cart) => this._onCartUpdated(cart));
  }

  disconnectedCallback() {
    if (typeof this._unsub === 'function') this._unsub();
  }

  async _onChange(radio) {
    const intent = radio.value;
    this._togglePartial(intent === 'partial');

    if (window.theme?.cart?.update) {
      try {
        await window.theme.cart.update({ attributes: { payment_intent: intent } });
      } catch (err) {
        console.error('[payment-selector] update failed', err);
      }
    }

    if (window.theme?.emit) {
      window.theme.emit('cart:payment-method-changed', { intent });
    }

    if (this.statusEl) {
      this.statusEl.hidden = false;
      clearTimeout(this._statusTimer);
      this._statusTimer = setTimeout(() => { this.statusEl.hidden = true; }, 2200);
    }
  }

  _togglePartial(show) {
    if (!this.partialBlock) return;
    this.partialBlock.hidden = !show;
  }

  _onCartUpdated(cart) {
    if (!cart || typeof cart.total_price !== 'number') return;
    const total = cart.total_price;
    const advance = Math.round(total * this.advancePct / 100);
    const balance = total - advance;

    // Update card amounts
    this.querySelectorAll('.payment-selector__amount').forEach((el) => {
      el.dataset.moneyCents = String(total);
    });
    const partialAmount = this.querySelector('[data-partial-advance]');
    if (partialAmount) {
      partialAmount.dataset.moneyCents = String(advance);
      partialAmount.textContent = window.theme?.formatMoney
        ? window.theme.formatMoney(advance, cart.currency)
        : partialAmount.textContent;
    }

    // Partial summary inner
    const adv = this.querySelector('[data-partial-advance-amount]');
    const bal = this.querySelector('[data-partial-balance-amount]');
    if (adv) {
      adv.dataset.moneyCents = String(advance);
      if (window.theme?.formatMoney) adv.textContent = window.theme.formatMoney(advance, cart.currency);
    }
    if (bal) {
      bal.dataset.moneyCents = String(balance);
      if (window.theme?.formatMoney) bal.textContent = window.theme.formatMoney(balance, cart.currency);
    }

    // Re-trigger inr-format scan
    if (window.theme?.emit) window.theme.emit('inr-format:rescan');
  }
}

if (!customElements.get('payment-selector')) customElements.define('payment-selector', PaymentSelector);
