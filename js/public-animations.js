/*
  Premium public scroll animation layer for public pages.
  Enhancement only: no Firebase, auth, dashboard, routing, or admin logic.
*/
(function () {
  'use strict';

  var ANIMATE_SELECTOR = '[data-animate]';
  var GROUP_SELECTOR = '[data-animate-group]';
  var DYNAMIC_GROUP_SELECTOR = '[data-animate-dynamic="true"]';
  var PARALLAX_SELECTOR = '[data-parallax="soft"]';
  var HERO_SELECTOR = '#home [data-animate], [data-animate-scope="hero"] [data-animate]';

  var state = {
    initialized: false,
    motionFallbackReady: false,
    reduceMotion: false,
    scrollTriggerReady: false,
    animations: [],
    prepared: new WeakSet(),
    parallaxPrepared: new WeakSet(),
    dynamicObserved: new WeakSet(),
    dynamicObservers: [],
    homepageGalleryObserved: false,
    homepageProjectTiltReady: false
  };

  function onReady(callback) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', callback, { once: true });
      return;
    }

    callback();
  }

  function toArray(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function getGsap() {
    return window.gsap;
  }

  function hasGsap() {
    var gsap = getGsap();
    return !!(gsap && typeof gsap.to === 'function' && typeof gsap.set === 'function');
  }

  function registerScrollTrigger() {
    if (!hasGsap() || !window.ScrollTrigger) {
      return false;
    }

    getGsap().registerPlugin(window.ScrollTrigger);
    return true;
  }

  function getMotionQuery() {
    if (typeof window.matchMedia !== 'function') {
      return null;
    }

    return window.matchMedia('(prefers-reduced-motion: reduce)');
  }

  function isSmallScreen() {
    return typeof window.matchMedia === 'function' &&
      window.matchMedia('(max-width: 768px)').matches;
  }

  function isHomepage() {
    var body = document.body;
    var pageName = body ? body.getAttribute('data-rcph-page') : '';
    var path = window.location.pathname.split('/').pop().toLowerCase();
    return pageName === 'home' || path === '' || path === 'index.html';
  }

  function track(animation) {
    if (animation) {
      state.animations.push(animation);
    }

    return animation;
  }

  function killTrackedAnimations() {
    state.animations.forEach(function (animation) {
      if (animation && typeof animation.kill === 'function') {
        animation.kill();
      }
    });
    state.animations = [];
  }

  function markVisible(element) {
    if (!element) {
      return;
    }

    element.classList.remove('rcph-animating');

    if (element.classList.contains('tw-reveal')) {
      element.classList.add('tw-is-visible');
    }
  }

  function finishElement(element) {
    if (!hasGsap()) {
      markVisible(element);
      return;
    }

    markVisible(element);
    if (element.matches && element.matches(PARALLAX_SELECTOR)) {
      getGsap().set(element, { autoAlpha: 1 });
      return;
    }

    getGsap().set(element, {
      autoAlpha: 1,
      clearProps: 'transform,willChange'
    });
  }

  function finishElements(elements) {
    elements.forEach(finishElement);
  }

  function revealAll(root) {
    var elements = collectAnimatableElements(root);

    if (root && root.nodeType === 1) {
      if (root.matches && (root.matches(ANIMATE_SELECTOR) || root.matches(PARALLAX_SELECTOR))) {
        elements.unshift(root);
      }
    }

    elements.forEach(function (element) {
      markVisible(element);
      element.style.opacity = '';
      element.style.visibility = '';
      element.style.transform = '';
      element.style.willChange = 'auto';
    });

    if (hasGsap() && elements.length) {
      getGsap().set(elements, {
        autoAlpha: 1,
        clearProps: 'transform,willChange'
      });
    }
  }

  function initReducedMotionFallback() {
    if (state.motionFallbackReady) {
      return;
    }

    state.motionFallbackReady = true;

    var query = getMotionQuery();
    state.reduceMotion = !!(query && query.matches);
    document.documentElement.classList.toggle('rcph-reduced-motion', state.reduceMotion);

    if (state.reduceMotion) {
      revealAll();
    }

    if (!query) {
      return;
    }

    var handleMotionChange = function (event) {
      state.reduceMotion = event.matches;
      document.documentElement.classList.toggle('rcph-reduced-motion', state.reduceMotion);

      if (state.reduceMotion) {
        killTrackedAnimations();
        revealAll();
      }
    };

    if (typeof query.addEventListener === 'function') {
      query.addEventListener('change', handleMotionChange);
      return;
    }

    if (typeof query.addListener === 'function') {
      query.addListener(handleMotionChange);
    }
  }

  function initNavbarScrollState() {
    var nav = document.querySelector('.navbar');
    if (!nav || !window.requestAnimationFrame) {
      return;
    }

    var ticking = false;
    var update = function () {
      nav.classList.toggle('rcph-nav-scrolled', window.scrollY > 16);
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

  function getFromVars(type) {
    var distance = isSmallScreen() ? 18 : 30;
    var xDistance = isSmallScreen() ? 20 : 34;

    if (type === 'fade-left') {
      return { autoAlpha: 0, x: -xDistance, y: 0, scale: 1 };
    }

    if (type === 'fade-right') {
      return { autoAlpha: 0, x: xDistance, y: 0, scale: 1 };
    }

    if (type === 'scale-in') {
      return { autoAlpha: 0, x: 0, y: 18, scale: 0.975 };
    }

    return { autoAlpha: 0, x: 0, y: distance, scale: 1 };
  }

  function isHeroElement(element) {
    return !!(element && element.closest('#home, [data-animate-scope="hero"]'));
  }

  function isInAnimationGroup(element) {
    return !!(element && element.closest(GROUP_SELECTOR));
  }

  function canUseScrollAnimations() {
    return !state.reduceMotion && hasGsap() && state.scrollTriggerReady;
  }

  function prepareElement(element, type) {
    if (state.prepared.has(element)) {
      return false;
    }

    state.prepared.add(element);
    getGsap().set(element, Object.assign(getFromVars(type), {
      willChange: 'opacity, transform'
    }));
    return true;
  }

  function animateSingleOnScroll(element, type) {
    if (!prepareElement(element, type)) {
      return;
    }

    track(getGsap().to(element, {
      autoAlpha: 1,
      x: 0,
      y: 0,
      scale: 1,
      duration: type === 'scale-in' ? 0.95 : 0.82,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: element,
        start: 'top 86%',
        once: true
      },
      onStart: function () {
        element.classList.add('rcph-animating');
      },
      onComplete: function () {
        finishElement(element);
      }
    }));
  }

  function initHeroIntroAnimation() {
    if (state.reduceMotion || !hasGsap()) {
      revealAll(document.querySelector('#home') || document);
      return;
    }

    var heroItems = toArray(HERO_SELECTOR);
    if (!heroItems.length) {
      return;
    }

    heroItems.forEach(function (element) {
      state.prepared.add(element);
      element.classList.add('rcph-animating');
    });

    getGsap().set(heroItems, {
      autoAlpha: 0,
      y: isSmallScreen() ? 22 : 34,
      willChange: 'opacity, transform'
    });

    track(getGsap().timeline({
      defaults: {
        duration: 0.95,
        ease: 'power3.out'
      },
      onComplete: function () {
        finishElements(heroItems);
      }
    }).to(heroItems, {
      autoAlpha: 1,
      y: 0,
      stagger: 0.13,
      delay: 0.08
    }));
  }

  function initScrollRevealAnimations(root) {
    if (!canUseScrollAnimations()) {
      return;
    }

    toArray('[data-animate="fade-up"]', root).forEach(function (element) {
      if (isHeroElement(element) || isInAnimationGroup(element)) {
        return;
      }

      animateSingleOnScroll(element, 'fade-up');
    });
  }

  function initDirectionalSectionAnimations(root) {
    if (!canUseScrollAnimations()) {
      return;
    }

    ['fade-left', 'fade-right', 'scale-in'].forEach(function (type) {
      toArray('[data-animate="' + type + '"]', root).forEach(function (element) {
        if (isHeroElement(element) || isInAnimationGroup(element)) {
          return;
        }

        animateSingleOnScroll(element, type);
      });
    });
  }

  function getGroups(root) {
    var groups = toArray(GROUP_SELECTOR, root);

    if (root && root.nodeType === 1 && root.matches && root.matches(GROUP_SELECTOR)) {
      groups.unshift(root);
    }

    return groups;
  }

  function getGroupStagger(group) {
    var legacyMs = Number(group.getAttribute('data-rcph-stagger'));
    if (legacyMs > 0) {
      return Math.min(Math.max(legacyMs / 1000, 0.045), 0.14);
    }

    return isSmallScreen() ? 0.065 : 0.085;
  }

  function getGroupChildren(group) {
    return Array.prototype.slice.call(group.children).filter(function (child) {
      return child.matches &&
        shouldAnimateGroupChild(group, child) &&
        !state.prepared.has(child);
    });
  }

  function shouldAnimateGroupChild(group, child) {
    if (!child || child.nodeType !== 1) {
      return false;
    }

    if (child.matches(ANIMATE_SELECTOR)) {
      return true;
    }

    if (!group.hasAttribute('data-animate-children')) {
      return false;
    }

    return !child.matches('script, style, template, link');
  }

  function getGroupChildType(group, child, index) {
    var explicitType = child.getAttribute('data-animate');
    if (explicitType) {
      return explicitType;
    }

    if (group.getAttribute('data-animate-group') === 'alternate') {
      return index % 2 === 0 ? 'fade-left' : 'fade-right';
    }

    return group.getAttribute('data-animate-children') || 'fade-up';
  }

  function collectAnimatableElements(root) {
    var scope = root || document;
    var elements = toArray(ANIMATE_SELECTOR, scope).concat(toArray(PARALLAX_SELECTOR, scope));

    getGroups(scope).forEach(function (group) {
      Array.prototype.forEach.call(group.children, function (child) {
        if (shouldAnimateGroupChild(group, child)) {
          elements.push(child);
        }
      });
    });

    return elements;
  }

  function initCardStaggerAnimations(root) {
    enhanceDynamicAnimationItems(root);

    if (!canUseScrollAnimations()) {
      return;
    }

    getGroups(root || document).forEach(function (group) {
      var items = getGroupChildren(group);
      if (!items.length) {
        return;
      }

      items.forEach(function (item, index) {
        var type = getGroupChildType(group, item, index);
        prepareElement(item, type);
      });

      track(getGsap().to(items, {
        autoAlpha: 1,
        x: 0,
        y: 0,
        scale: 1,
        duration: 0.86,
        ease: 'power3.out',
        stagger: {
          each: getGroupStagger(group),
          from: 'start'
        },
        scrollTrigger: {
          trigger: group,
          start: 'top 86%',
          once: true
        },
        onStart: function () {
          items.forEach(function (item) {
            item.classList.add('rcph-animating');
          });
        },
        onComplete: function () {
          finishElements(items);
        }
      }));
    });
  }

  function initParallaxAccents(root) {
    if (!canUseScrollAnimations() || isSmallScreen()) {
      return;
    }

    toArray(PARALLAX_SELECTOR, root).forEach(function (element) {
      if (state.parallaxPrepared.has(element)) {
        return;
      }

      state.parallaxPrepared.add(element);
      getGsap().set(element, { willChange: 'transform' });

      track(getGsap().to(element, {
        yPercent: -5,
        ease: 'none',
        scrollTrigger: {
          trigger: element.closest('.section-box, .m4-section, .event-hero, .event-card, .event-gallery-section') || element,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 0.55
        }
      }));
    });
  }

  function refreshScrollTriggers() {
    if (state.scrollTriggerReady && window.ScrollTrigger &&
        typeof window.ScrollTrigger.refresh === 'function') {
      window.ScrollTrigger.refresh();
    }
  }

  function scheduleRefreshes() {
    [200, 900, 2800, 3800].forEach(function (delay) {
      window.setTimeout(refreshScrollTriggers, delay);
    });

    window.addEventListener('load', function () {
      window.setTimeout(refreshScrollTriggers, 120);
    }, { once: true });
  }

  function enhanceDynamicAnimationItems(root) {
    var grid = document.getElementById('awGrid');
    if (grid && !grid.hasAttribute('data-animate-group')) {
      grid.setAttribute('data-animate-group', 'stagger');
    }

    if (grid && !grid.hasAttribute('data-animate-dynamic')) {
      grid.setAttribute('data-animate-dynamic', 'true');
    }

    if (grid) {
      toArray('.aw-card', grid).forEach(function (card) {
        if (!card.hasAttribute('data-animate')) {
          card.setAttribute('data-animate', 'scale-in');
        }
      });
    }

    ['#upcomingEvents', '#recentEvents'].forEach(function (selector) {
      var list = document.querySelector(selector);
      if (!list) {
        return;
      }

      if (!list.hasAttribute('data-animate-group')) {
        list.setAttribute('data-animate-group', 'timeline');
      }

      if (!list.hasAttribute('data-animate-children')) {
        list.setAttribute('data-animate-children', 'fade-up');
      }

      if (!list.hasAttribute('data-animate-dynamic')) {
        list.setAttribute('data-animate-dynamic', 'true');
      }
    });

    if (!root) {
      return;
    }

    toArray('.aw-card', root).forEach(function (card) {
      if (!card.hasAttribute('data-animate')) {
        card.setAttribute('data-animate', 'scale-in');
      }
    });
  }

  function initDynamicAnimationHooks() {
    if (typeof window.MutationObserver !== 'function') {
      return;
    }

    toArray(DYNAMIC_GROUP_SELECTOR).forEach(function (group) {
      if (state.dynamicObserved.has(group)) {
        return;
      }

      state.dynamicObserved.add(group);

      var observer = new MutationObserver(function () {
        enhanceDynamicAnimationItems(group);
        if (isHomepage() && group.id === 'awGrid') {
          initHomepageGalleryMotion(group);
        } else {
          initCardStaggerAnimations(group);
        }
        refreshScrollTriggers();
      });

      observer.observe(group, { childList: true });
      state.dynamicObservers.push(observer);
    });
  }

  function getHomepagePanelItems(section) {
    return toArray('h2, h3, p, .page-actions, .highlight-viewport, .legend-box, .contact-card', section)
      .filter(function (item) {
        return !item.closest('.project-card, #awGrid, #rcph-calendar, .fc, .membership-popup');
      });
  }

  function initHomepageCinematicHero() {
    var hero = document.getElementById('home');
    if (!hero) {
      return;
    }

    if (state.reduceMotion || !hasGsap()) {
      revealAll(hero);
      return;
    }

    var gsap = getGsap();
    var headline = hero.querySelector('.hero-content h1');
    var heroLines = toArray('.hero-content h1, .hero-content h2, .hero-content .theme-text', hero);
    var heroButtons = toArray('.hero-content .btn-like, .hero-content .join-us-button, .hero-content a', hero);
    var allHeroItems = heroLines.concat(heroButtons);

    if (!allHeroItems.length) {
      return;
    }

    allHeroItems.forEach(function (item) {
      state.prepared.add(item);
      item.classList.add('rcph-animating');
    });

    gsap.set(hero, {
      '--rcph-hero-bg-scale': 1.015,
      '--rcph-hero-bg-y': '0px'
    });
    gsap.set(allHeroItems, {
      autoAlpha: 0,
      y: isSmallScreen() ? 22 : 42,
      willChange: 'opacity, transform'
    });

    if (headline) {
      gsap.set(headline, {
        '--rcph-hero-sweep': '-125%',
        '--rcph-hero-glow-opacity': 0
      });
    }

    var timeline = gsap.timeline({
      defaults: {
        ease: 'power3.out'
      },
      onComplete: function () {
        finishElements(allHeroItems);
      }
    });

    timeline
      .to(hero, {
        '--rcph-hero-bg-scale': isSmallScreen() ? 1.045 : 1.085,
        duration: 5.2,
        ease: 'power1.out'
      }, 0)
      .to(heroLines, {
        autoAlpha: 1,
        y: 0,
        duration: 1.05,
        stagger: 0.16
      }, 0.12);

    if (heroButtons.length) {
      timeline.to(heroButtons, {
        autoAlpha: 1,
        y: 0,
        duration: 0.72,
        stagger: 0.1
      }, 0.55);
    }

    if (headline) {
      timeline
        .to(headline, {
          '--rcph-hero-glow-opacity': 1,
          duration: 0.34
        }, 0.36)
        .to(headline, {
          '--rcph-hero-sweep': '125%',
          duration: 1.35,
          ease: 'power2.inOut'
        }, 0.38)
        .to(headline, {
          '--rcph-hero-glow-opacity': 0.35,
          duration: 0.7
        }, 1.32);
    }

    track(timeline);
  }

  function initHomepageScrollProgress() {
    var bar = document.querySelector('.rcph-scroll-progress span');
    if (!bar) {
      return;
    }

    if (state.reduceMotion || !hasGsap()) {
      bar.style.transform = 'scaleX(0)';
      return;
    }

    var gsap = getGsap();
    gsap.set(bar, {
      scaleX: 0,
      transformOrigin: 'left center'
    });

    if (!state.scrollTriggerReady || !window.ScrollTrigger) {
      var updateFallback = function () {
        var max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        gsap.set(bar, { scaleX: Math.min(1, Math.max(0, window.scrollY / max)) });
      };

      updateFallback();
      window.addEventListener('scroll', updateFallback, { passive: true });
      return;
    }

    var setScale = typeof gsap.quickTo === 'function'
      ? gsap.quickTo(bar, 'scaleX', { duration: 0.18, ease: 'power2.out' })
      : function (value) { gsap.set(bar, { scaleX: value }); };

    track(window.ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate: function (self) {
        setScale(self.progress);
      }
    }));
  }

  function initHomepagePanelTransitions() {
    if (!canUseScrollAnimations()) {
      return;
    }

    var gsap = getGsap();
    var sections = toArray('section.section-box').filter(function (section) {
      return !section.closest('.membership-popup');
    });

    sections.forEach(function (section, index) {
      var isClosing = section.id === 'join' || section.id === 'contact';
      section.classList.add('rcph-home-panel');
      if (isClosing) {
        section.classList.add('rcph-home-closing-panel');
      }

      if (!state.prepared.has(section)) {
        state.prepared.add(section);
        gsap.set(section, {
          autoAlpha: 0,
          y: isSmallScreen() ? 24 : 48,
          x: !isSmallScreen() && index % 2 === 1 ? 16 : 0,
          scale: isClosing ? 0.972 : 0.985,
          willChange: 'opacity, transform'
        });
      }

      var items = getHomepagePanelItems(section).filter(function (item) {
        return !state.prepared.has(item);
      });

      items.forEach(function (item) {
        state.prepared.add(item);
        gsap.set(item, {
          autoAlpha: 0,
          y: isSmallScreen() ? 14 : 24,
          willChange: 'opacity, transform'
        });
      });

      track(gsap.timeline({
        scrollTrigger: {
          trigger: section,
          start: 'top 84%',
          once: true
        },
        onStart: function () {
          section.classList.add('rcph-animating');
          items.forEach(function (item) {
            item.classList.add('rcph-animating');
          });
        },
        onComplete: function () {
          finishElement(section);
          finishElements(items);
        }
      })
        .to(section, {
          autoAlpha: 1,
          x: 0,
          y: 0,
          scale: 1,
          duration: isClosing ? 1.02 : 0.86,
          ease: 'power3.out'
        }, 0)
        .to(items, {
          autoAlpha: 1,
          y: 0,
          duration: 0.7,
          stagger: 0.07,
          ease: 'power3.out'
        }, 0.15));
    });
  }

  function initHomepageHighlightMotion() {
    if (!canUseScrollAnimations()) {
      return;
    }

    var gsap = getGsap();
    var section = document.getElementById('highlight-month');
    if (!section) {
      return;
    }

    var title = section.querySelector('h2');
    var image = section.querySelector('.highlight-hero-img');

    if (title) {
      gsap.set(title, { '--rcph-title-underline': 0 });
      track(gsap.to(title, {
        '--rcph-title-underline': 1,
        duration: 0.82,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: section,
          start: 'top 76%',
          once: true
        }
      }));
    }

    if (image && !isSmallScreen()) {
      state.parallaxPrepared.add(image);
      gsap.set(image, {
        scale: 1.035,
        willChange: 'transform'
      });

      track(gsap.to(image, {
        scale: 1.09,
        yPercent: -4,
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top bottom',
          end: 'bottom top',
          scrub: 0.6
        }
      }));
    }
  }

  function initHomepageProjectTilt(cards) {
    if (state.homepageProjectTiltReady || state.reduceMotion || isSmallScreen() || !hasGsap()) {
      return;
    }

    state.homepageProjectTiltReady = true;
    var gsap = getGsap();

    cards.forEach(function (card) {
      card.classList.add('rcph-home-project-card');
      card.addEventListener('pointermove', function (event) {
        var rect = card.getBoundingClientRect();
        var relX = (event.clientX - rect.left) / Math.max(1, rect.width) - 0.5;
        var relY = (event.clientY - rect.top) / Math.max(1, rect.height) - 0.5;
        card.style.setProperty('--rcph-card-x', String((relX + 0.5) * 100) + '%');
        card.style.setProperty('--rcph-card-y', String((relY + 0.5) * 100) + '%');

        gsap.to(card, {
          rotateX: relY * -5,
          rotateY: relX * 6,
          y: -7,
          scale: 1.015,
          duration: 0.28,
          ease: 'power2.out',
          overwrite: true
        });
      });

      card.addEventListener('pointerleave', function () {
        card.style.removeProperty('--rcph-card-x');
        card.style.removeProperty('--rcph-card-y');
        gsap.to(card, {
          rotateX: 0,
          rotateY: 0,
          y: 0,
          scale: 1,
          duration: 0.42,
          ease: 'power3.out',
          overwrite: true
        });
      });
    });
  }

  function initHomepageProjectDeck() {
    if (!canUseScrollAnimations()) {
      return;
    }

    var gsap = getGsap();
    var section = document.getElementById('featured-projects');
    var cards = toArray('#featured-projects .project-card');
    if (!section || !cards.length) {
      return;
    }

    var freshCards = cards.filter(function (card) {
      return !state.prepared.has(card);
    });

    freshCards.forEach(function (card, index) {
      state.prepared.add(card);
      card.classList.add('rcph-home-project-card');
      gsap.set(card, {
        autoAlpha: 0,
        x: index === 0 ? -74 : (index === 2 ? 74 : 0),
        y: index === 1 ? 58 : 26,
        scale: index === 1 ? 0.965 : 0.985,
        rotationY: index === 0 ? -5 : (index === 2 ? 5 : 0),
        transformPerspective: 900,
        willChange: 'opacity, transform'
      });
    });

    if (freshCards.length) {
      track(gsap.to(freshCards, {
        autoAlpha: 1,
        x: 0,
        y: 0,
        scale: 1,
        rotationY: 0,
        duration: 0.92,
        ease: 'power3.out',
        stagger: {
          each: 0.11,
          from: 'center'
        },
        scrollTrigger: {
          trigger: section,
          start: 'top 78%',
          once: true
        },
        onStart: function () {
          freshCards.forEach(function (card) {
            card.classList.add('rcph-animating');
          });
        },
        onComplete: function () {
          finishElements(freshCards);
        }
      }));
    }

    initHomepageProjectTilt(cards);
  }

  function initHomepageGalleryMotion(root) {
    var grid = root && root.id === 'awGrid' ? root : document.getElementById('awGrid');
    if (!grid) {
      return;
    }

    if (!state.homepageGalleryObserved && typeof window.MutationObserver === 'function') {
      state.homepageGalleryObserved = true;
      var observer = new MutationObserver(function () {
        initHomepageGalleryMotion(grid);
        refreshScrollTriggers();
      });
      observer.observe(grid, { childList: true });
      state.dynamicObservers.push(observer);
    }

    if (!canUseScrollAnimations()) {
      return;
    }

    var gsap = getGsap();
    var cards = toArray('.aw-card', grid).filter(function (card) {
      return !state.prepared.has(card);
    });

    if (!cards.length) {
      return;
    }

    cards.forEach(function (card, index) {
      state.prepared.add(card);
      if (!card.hasAttribute('data-animate')) {
        card.setAttribute('data-animate', 'scale-in');
      }

      gsap.set(card, {
        autoAlpha: 0,
        x: !isSmallScreen() ? ((index % 3) - 1) * 18 : 0,
        y: 34 + ((index % 4) * 8),
        scale: 0.965,
        willChange: 'opacity, transform'
      });
    });

    track(gsap.to(cards, {
      autoAlpha: 1,
      x: 0,
      y: 0,
      scale: 1,
      duration: 0.78,
      ease: 'power3.out',
      stagger: {
        each: isSmallScreen() ? 0.045 : 0.065,
        grid: 'auto',
        from: 'start'
      },
      scrollTrigger: {
        trigger: grid,
        start: 'top 86%',
        once: true
      },
      onStart: function () {
        cards.forEach(function (card) {
          card.classList.add('rcph-animating');
        });
      },
      onComplete: function () {
        finishElements(cards);
      }
    }));
  }

  function initHomepageCinematicAnimations() {
    initHomepageCinematicHero();
    initHomepageScrollProgress();
    initHomepagePanelTransitions();
    initHomepageHighlightMotion();
    initHomepageProjectDeck();
    initHomepageGalleryMotion();
    scheduleRefreshes();
  }

  function initPremiumAnimations() {
    if (state.reduceMotion) {
      revealAll();
      return;
    }

    if (!hasGsap()) {
      return;
    }

    if (state.initialized) {
      return;
    }

    state.initialized = true;
    state.scrollTriggerReady = registerScrollTrigger();
    document.documentElement.classList.add('rcph-animations-ready');

    if (isHomepage()) {
      initHomepageCinematicAnimations();
      return;
    }

    initHeroIntroAnimation();
    initCardStaggerAnimations();
    initScrollRevealAnimations();
    initDirectionalSectionAnimations();
    initParallaxAccents();
    scheduleRefreshes();
  }

  window.RCPHAnimations = {
    initHeroIntroAnimation: initHeroIntroAnimation,
    initScrollRevealAnimations: initScrollRevealAnimations,
    initDirectionalSectionAnimations: initDirectionalSectionAnimations,
    initCardStaggerAnimations: initCardStaggerAnimations,
    initParallaxAccents: initParallaxAccents,
    initReducedMotionFallback: initReducedMotionFallback,
    initDynamicAnimationHooks: initDynamicAnimationHooks,
    initHomepageCinematicHero: initHomepageCinematicHero,
    initHomepageScrollProgress: initHomepageScrollProgress,
    initHomepagePanelTransitions: initHomepagePanelTransitions,
    initHomepageProjectDeck: initHomepageProjectDeck,
    initHomepageGalleryMotion: initHomepageGalleryMotion,
    refresh: refreshScrollTriggers
  };

  onReady(function () {
    initReducedMotionFallback();
    initNavbarScrollState();
    enhanceDynamicAnimationItems();
    initDynamicAnimationHooks();
    initPremiumAnimations();
  });
}());
