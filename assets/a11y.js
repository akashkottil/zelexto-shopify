/**
 * Zelexto v2 — a11y.js
 * Thin re-export of the focus-trap utility from theme.js. Components
 * can either use `window.theme.a11y.trapFocus(el)` directly, or place
 * `<focus-trap>` around any container that should auto-trap on connect
 * (used by some app embeds and quick-add modals).
 */

class FocusTrap extends HTMLElement {
  connectedCallback() {
    if (!window.theme?.a11y?.trapFocus) return;
    this._release = window.theme.a11y.trapFocus(this);
  }
  disconnectedCallback() {
    this._release?.();
  }
}

if (!customElements.get('focus-trap')) customElements.define('focus-trap', FocusTrap);

// Convenience export so other modules can import './a11y.js' to ensure registration.
export const trapFocus = (el) => window.theme?.a11y?.trapFocus?.(el);
