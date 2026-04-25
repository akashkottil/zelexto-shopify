/**
 * Zelexto v2 — product-media.js
 * <media-gallery> Custom Element. Slide nav, thumbnail click, click-zoom
 * (CSS transform), keyboard arrows, swipe via native scroll-snap on
 * mobile. Listens for variant:changed to switch to the variant's media.
 */

class MediaGallery extends HTMLElement {
  connectedCallback() {
    this.rail = this.querySelector('[data-gallery-rail]');
    this.slides = Array.from(this.querySelectorAll('[data-slide-id]'));
    this.thumbs = Array.from(this.querySelectorAll('[data-thumb-id]'));
    this.prev = this.querySelector('[data-gallery-prev]');
    this.next = this.querySelector('[data-gallery-next]');
    this.counter = this.querySelector('[data-gallery-current]');
    this.activeIndex = this.slides.findIndex((s) => s.classList.contains('is-active'));
    if (this.activeIndex < 0) this.activeIndex = 0;

    this.thumbs.forEach((t) => {
      t.addEventListener('click', () => this.go(parseInt(t.dataset.thumbIndex, 10)));
    });
    this.prev?.addEventListener('click', () => this.go(this.activeIndex - 1));
    this.next?.addEventListener('click', () => this.go(this.activeIndex + 1));

    this.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') this.go(this.activeIndex + 1);
      if (e.key === 'ArrowLeft') this.go(this.activeIndex - 1);
    });

    this.querySelectorAll('[data-zoom-trigger]').forEach((btn) => {
      btn.addEventListener('click', () => btn.classList.toggle('is-zoomed'));
    });

    this._unsub = window.theme.on('variant:changed', ({ variant }) => {
      if (variant?.featured_media?.id) this.goByMediaId(variant.featured_media.id);
    });
  }
  disconnectedCallback() {
    this._unsub?.();
  }
  go(idx) {
    if (!this.slides.length) return;
    idx = (idx + this.slides.length) % this.slides.length;
    this.slides.forEach((s, i) => {
      s.classList.toggle('is-active', i === idx);
      s.setAttribute('aria-hidden', i === idx ? 'false' : 'true');
    });
    this.thumbs.forEach((t, i) => {
      t.classList.toggle('is-active', i === idx);
      t.setAttribute('aria-pressed', i === idx ? 'true' : 'false');
    });
    if (this.counter) this.counter.textContent = String(idx + 1);
    this.activeIndex = idx;
    // For scroll-snap rail (mobile)
    const slide = this.slides[idx];
    if (slide && this.rail) {
      slide.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
    }
  }
  goByMediaId(id) {
    const idx = this.slides.findIndex((s) => Number(s.dataset.slideId) === Number(id));
    if (idx >= 0) this.go(idx);
  }
}

if (!customElements.get('media-gallery')) customElements.define('media-gallery', MediaGallery);
