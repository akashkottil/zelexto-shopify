/**
 * ZELEXTO THEME — theme-events.js
 * Global lightweight event bus for theme <-> app communication.
 *
 * Usage:
 *   // Theme emits
 *   window.ThemeEvents.emit('cart:updated', cartData);
 *   window.ThemeEvents.emit('product:variant-changed', { variant, product });
 *   window.ThemeEvents.emit('cart:item-added', { item });
 *   window.ThemeEvents.emit('cart:drawer-opened');
 *
 *   // Apps subscribe
 *   window.ThemeEvents.on('cart:updated', (data) => { ... });
 *   window.ThemeEvents.off('cart:updated', handler);
 *
 * This MUST be loaded before all other JS components.
 * Loaded first in theme.liquid with `defer`.
 */

(function () {
  'use strict';

  const ThemeEvents = {
    _events: Object.create(null),

    /**
     * Subscribe to an event.
     * @param {string} event - Event name
     * @param {Function} callback - Handler function
     * @returns {Function} Unsubscribe function (convenience)
     */
    on(event, callback) {
      if (typeof callback !== 'function') {
        console.warn('[ThemeEvents] Handler must be a function:', event);
        return () => {};
      }
      if (!this._events[event]) {
        this._events[event] = [];
      }
      this._events[event].push(callback);

      // Return unsubscribe function for cleaner teardown
      return () => this.off(event, callback);
    },

    /**
     * Unsubscribe from an event.
     * @param {string} event - Event name
     * @param {Function} callback - Handler to remove
     */
    off(event, callback) {
      if (!this._events[event]) return;
      this._events[event] = this._events[event].filter(cb => cb !== callback);
    },

    /**
     * Subscribe once — auto-removes after first call.
     * @param {string} event
     * @param {Function} callback
     */
    once(event, callback) {
      const wrapper = (data) => {
        callback(data);
        this.off(event, wrapper);
      };
      this.on(event, wrapper);
    },

    /**
     * Emit an event with optional data.
     * @param {string} event - Event name
     * @param {*} data - Payload
     */
    emit(event, data) {
      const handlers = this._events[event];
      if (!handlers || handlers.length === 0) return;
      // Shallow copy to prevent mutation during iteration
      [...handlers].forEach(cb => {
        try {
          cb(data);
        } catch (err) {
          console.error(`[ThemeEvents] Error in handler for "${event}":`, err);
        }
      });
    },

    /**
     * List all active event names (for debugging).
     */
    listEvents() {
      return Object.keys(this._events).filter(e => this._events[e].length > 0);
    }
  };

  // Expose globally
  window.ThemeEvents = ThemeEvents;

  // Emit ready signal so apps know the bus is available
  document.addEventListener('DOMContentLoaded', () => {
    ThemeEvents.emit('theme:ready', {
      version: '1.0.0',
      settings: window.themeSettings
    });
  });

})();
