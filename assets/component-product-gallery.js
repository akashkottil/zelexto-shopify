/**
 * ZELEXTO THEME — component-product-gallery.js
 * Gallery: slide navigation, thumbnail sync, touch swipe, zoom on click.
 * Hydration guard: only runs if product gallery exists on page.
 */

(function () {
    'use strict';

    if (!document.getElementById('product-gallery')) return;

    const gallery = document.getElementById('product-gallery');
    const slidesWrap = document.getElementById('gallery-slides');
    const thumbWrap = document.getElementById('gallery-thumbs');
    const counter = document.getElementById('gallery-current');

    if (!slidesWrap) return;

    const slides = Array.from(slidesWrap.querySelectorAll('[data-slide]'));
    const thumbs = thumbWrap ? Array.from(thumbWrap.querySelectorAll('[data-thumb]')) : [];
    let current = 0;

    // ----------------------------------------------------------------
    // Navigate
    // ----------------------------------------------------------------
    function goTo(index) {
        if (index < 0) index = slides.length - 1;
        if (index >= slides.length) index = 0;
        if (index === current) return;

        slides[current].classList.remove('is-active');
        slides[current].setAttribute('aria-hidden', 'true');
        thumbs[current]?.classList.remove('is-active');
        thumbs[current]?.setAttribute('aria-pressed', 'false');

        current = index;

        slides[current].classList.add('is-active');
        slides[current].setAttribute('aria-hidden', 'false');
        if (counter) counter.textContent = current + 1;

        if (thumbs[current]) {
            thumbs[current].classList.add('is-active');
            thumbs[current].setAttribute('aria-pressed', 'true');
            thumbs[current].scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }

    // ----------------------------------------------------------------
    // Arrow buttons
    // ----------------------------------------------------------------
    gallery.querySelector('[data-gallery-prev]')?.addEventListener('click', () => goTo(current - 1));
    gallery.querySelector('[data-gallery-next]')?.addEventListener('click', () => goTo(current + 1));

    // Keyboard on slides
    slidesWrap.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') goTo(current - 1);
        if (e.key === 'ArrowRight') goTo(current + 1);
    });

    // ----------------------------------------------------------------
    // Thumb clicks
    // ----------------------------------------------------------------
    thumbs.forEach(thumb => {
        thumb.addEventListener('click', () => {
            goTo(parseInt(thumb.dataset.thumb, 10));
        });
    });

    // ----------------------------------------------------------------
    // Touch swipe support
    // ----------------------------------------------------------------
    let touchStartX = 0;
    let touchEndX = 0;
    const SWIPE_THRESHOLD = 50;

    slidesWrap.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
    }, { passive: true });

    slidesWrap.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        const delta = touchStartX - touchEndX;
        if (Math.abs(delta) > SWIPE_THRESHOLD) {
            goTo(delta > 0 ? current + 1 : current - 1);
        }
    }, { passive: true });

    // ----------------------------------------------------------------
    // Image zoom on click (CSS transform)
    // ----------------------------------------------------------------
    slides.forEach(slide => {
        const zoomContainer = slide.querySelector('[data-zoom-container]');
        const img = slide.querySelector('.product-gallery__img');
        if (!zoomContainer || !img) return;

        zoomContainer.addEventListener('click', (e) => {
            const isZoomed = zoomContainer.classList.toggle('is-zoomed');
            if (isZoomed) {
                // Set transform-origin to click point
                const rect = zoomContainer.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width) * 100;
                const y = ((e.clientY - rect.top) / rect.height) * 100;
                img.style.setProperty('--zoom-x', `${x}%`);
                img.style.setProperty('--zoom-y', `${y}%`);
            }
        });

        // Keyboard-accessible zoom
        zoomContainer.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                zoomContainer.classList.toggle('is-zoomed');
            }
        });
    });

    // ----------------------------------------------------------------
    // External API — called by component-product.js on variant change
    // ----------------------------------------------------------------
    window.galleryGoTo = function (mediaId) {
        const idx = slides.findIndex(s => s.id === `slide-${mediaId}`);
        if (idx >= 0) goTo(idx);
    };

})();
