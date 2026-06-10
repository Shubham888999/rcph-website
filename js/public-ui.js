/*
  Phase 1/3 public UI foundation.
  This file is intentionally defensive and contains no Firebase/auth/admin logic.
*/
(function () {
  'use strict';

  function getRevealItems() {
    return Array.prototype.slice.call(document.querySelectorAll('.tw-reveal'));
  }

  function applyStaggerDelays() {
    var groups = document.querySelectorAll('[data-rcph-stagger]');
    Array.prototype.forEach.call(groups, function (group) {
      var step = Number(group.getAttribute('data-rcph-stagger')) || 90;
      var children = Array.prototype.slice.call(group.children);

      children.forEach(function (child, index) {
        if (!child.classList.contains('tw-reveal')) {
          return;
        }

        child.style.setProperty('--tw-reveal-delay', String(index * step) + 'ms');
      });
    });
  }

  function showAllRevealItems(items) {
    items.forEach(function (item) {
      item.classList.add('tw-is-visible');
    });
  }

  function initScrollReveal() {
    var items = getRevealItems();
    if (!items.length) {
      return;
    }

    applyStaggerDelays();
    document.documentElement.classList.add('tw-reveal-ready');

    var reduceMotion = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion || typeof window.IntersectionObserver !== 'function') {
      showAllRevealItems(items);
      return;
    }

    var observer = new IntersectionObserver(function (entries, activeObserver) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add('tw-is-visible');
        activeObserver.unobserve(entry.target);
      });
    }, {
      root: null,
      rootMargin: '0px 0px -8% 0px',
      threshold: 0.16
    });

    items.forEach(function (item) {
      observer.observe(item);
    });
  }

  function initStickyNavbar() {
    var nav = document.querySelector('.navbar');
    if (!nav || !window.requestAnimationFrame) {
      return;
    }

    var ticking = false;
    var update = function () {
      nav.classList.toggle('tw-is-scrolled', window.scrollY > 12);
      ticking = false;
    };

    update();
    window.addEventListener('scroll', function () {
      if (ticking) {
        return;
      }

      ticking = true;
      window.requestAnimationFrame(update);
    }, { passive: true });
  }

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
    initScrollReveal();
    initStickyNavbar();
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
