/*
  Phase 1 public UI foundation.
  This file is intentionally defensive and contains no Firebase/auth/admin logic.
*/
(function () {
  'use strict';

  function initPublicSwiper() {
    var swiperEl = document.querySelector('.rcph-swiper');
    if (!swiperEl || typeof window.Swiper !== 'function') {
      return;
    }

    if (swiperEl.dataset.swiperReady === 'true') {
      return;
    }

    swiperEl.dataset.swiperReady = 'true';
    window.rcphPublicSwiper = new window.Swiper(swiperEl, {
      loop: false,
      slidesPerView: 1,
      spaceBetween: 16,
      pagination: {
        el: swiperEl.querySelector('.swiper-pagination'),
        clickable: true
      },
      navigation: {
        nextEl: swiperEl.querySelector('.swiper-button-next'),
        prevEl: swiperEl.querySelector('.swiper-button-prev')
      }
    });
  }

  function initUIEnhancements() {
    initPublicSwiper();
  }

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
      return;
    }

    callback();
  }

  window.initUIEnhancements = initUIEnhancements;
  onReady(initUIEnhancements);
}());
