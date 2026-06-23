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
  var PUBLIC_AMBIENT_PAGES = [
    'home',
    'about',
    'events',
    'projects',
    'join',
    'contact',
    'faq',
    'madhushala',
    'pages-of-hope'
  ];

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
    homepageProjectTiltReady: false,
    homepageAmbientReady: false,
    homepageAmbientResizeReady: false,
    homepageAmbientBreakpoint: '',
    homepageAmbientAnimations: [],
    bodShowcaseReady: false,
    bodTiltReady: false
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

  function getAmbientPageType() {
    var body = document.body;
    var pageName = body ? String(body.getAttribute('data-rcph-page') || '').toLowerCase() : '';
    var path = window.location.pathname.split('/').pop().toLowerCase();

    if (pageName) {
      return pageName;
    }

    if (path === '' || path === 'index.html') {
      return 'home';
    }

    return path.replace(/\.html$/, '');
  }

  function isPublicAmbientPage() {
    var body = document.body;
    if (!body || body.classList.contains('login-page')) {
      return false;
    }

    return PUBLIC_AMBIENT_PAGES.indexOf(getAmbientPageType()) !== -1;
  }

  function isHomepage() {
    return getAmbientPageType() === 'home';
  }

  function isBodPage() {
    return getAmbientPageType() === 'bod';
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

  function getAmbientBreakpoint() {
    if (typeof window.matchMedia !== 'function') {
      return 'desktop';
    }

    if (window.matchMedia('(max-width: 640px)').matches) {
      return 'mobile';
    }

    if (window.matchMedia('(max-width: 1024px)').matches) {
      return 'tablet';
    }

    return 'desktop';
  }

  function clearHomepageAmbientAnimations() {
    state.homepageAmbientAnimations.forEach(function (animation) {
      if (animation && typeof animation.kill === 'function') {
        animation.kill();
      }
    });
    state.homepageAmbientAnimations = [];
  }

  function trackHomepageAmbient(animation) {
    if (animation) {
      state.homepageAmbientAnimations.push(animation);
      track(animation);
    }

    return animation;
  }

  function createAmbientSvg(className, viewBox, artwork) {
    var wrapper = document.createElement('span');
    wrapper.className = className;
    wrapper.innerHTML = '<svg viewBox="' + viewBox + '" aria-hidden="true" focusable="false" fill="none" xmlns="http://www.w3.org/2000/svg">' + artwork + '</svg>';
    return wrapper;
  }

  function createRotaractJourneyAmbient(layer, breakpoint) {
    var journey = document.createElement('div');
    journey.className = 'rcph-journey-ambient';
    journey.setAttribute('aria-hidden', 'true');
journey.appendChild(createAmbientSvg(
  'rcph-journey-route',
  '0 0 180 720',
  '<defs><mask id="rcph-journey-route-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="180" height="720"><path class="rcph-journey-reveal" d="M180 10V710" stroke="#fff" stroke-width="12"/></mask></defs><g mask="url(#rcph-journey-route-mask)"><path class="rcph-journey-line" d="M180 10V710"/><path class="rcph-journey-line-glow" d="M180 10V710"/></g>'
));

    var stages = [
      { name: 'Service', top: '2%', icon: '<path d="M5 18c5-1 8 1 11 4 4-5 8-6 13-3M8 18l4-10 8 3 7-7M23 4h6v6"/>' },
      { name: 'Leadership', top: '25%', icon: '<path d="M8 29V5M9 6h18l-5 7 5 7H9M4 29h10"/>' },
      { name: 'Fellowship', top: '49%', icon: '<path d="M5 26c1-7 5-10 10-10s9 3 10 10M10 10c0-4 2-6 5-6s5 2 5 6-2 6-5 6-5-2-5-6M21 15c2-3 4-4 7-3 3 1 4 4 3 7M25 26c1-4 4-6 8-5"/>' },
      { name: 'Community', top: '73%', icon: '<path d="M4 17L18 5l14 12M8 15v15h20V15M14 30V20h8v10M4 30h28"/>' },
      { name: 'Impact', top: '94%', icon: '<path d="M18 3l12 7-2 15-10 7-10-7-2-15 12-7zM18 9l5 7-5 10-5-10 5-7z"/>' }
    ];

    var list = document.createElement('ol');
    list.className = 'rcph-journey-stages';
    stages.forEach(function (stage) {
      var item = document.createElement('li');
      item.className = 'rcph-journey-stage';
      item.style.setProperty('--rcph-journey-top', stage.top);
      item.appendChild(createAmbientSvg('rcph-journey-icon', '0 0 36 36', stage.icon));

      var label = document.createElement('span');
      label.className = 'rcph-journey-label';
      label.textContent = stage.name;
      item.appendChild(label);
      list.appendChild(item);
    });

    journey.appendChild(list);
    layer.appendChild(journey);
    return journey;
  }

  function createLeftAvenueAmbient(layer, breakpoint) {
    if (breakpoint === 'mobile') {
      return null;
    }

    var avenue = document.createElement('div');
    avenue.className = 'rcph-avenue-ambient';
    avenue.setAttribute('aria-hidden', 'true');
avenue.appendChild(createAmbientSvg(
  'rcph-avenue-route',
  '0 0 190 720',
  '<defs><mask id="rcph-avenue-route-mask" maskUnits="userSpaceOnUse" x="0" y="0" width="190" height="720"><path class="rcph-avenue-reveal" d="M2 10V710" stroke="#fff" stroke-width="12"/></mask></defs><g mask="url(#rcph-avenue-route-mask)"><path class="rcph-avenue-line" d="M2 10V710"/><path class="rcph-avenue-line-glow" d="M2 10V710"/></g>'
));
    var stages = [
      { name: 'International\nService', top: '5%', icon: '<path d="M18 3c8 0 14 7 14 15s-6 15-14 15S4 26 4 18 10 3 18 3zM4 18h28M18 3c4 4 6 9 6 15s-2 11-6 15M18 3c-4 4-6 9-6 15s2 11 6 15M25 9l5-3-1 6"/>' },
      { name: 'Club\nService', top: '34%', icon: '<path d="M5 29c1-7 5-10 10-10s9 3 10 10M10 12c0-4 2-6 5-6s5 2 5 6-2 6-5 6-5-2-5-6M22 18c2-3 5-4 8-2 3 2 4 5 2 8M25 29c1-4 4-6 8-5"/>' },
      { name: 'Professional\nDevelopment', top: '63%', icon: '<path d="M4 12h28v18H4zM12 12V7h12v5M4 19c8 4 20 4 28 0M15 19h6v5h-6M24 8l5-4M29 4v6"/>' },
      { name: 'Community\nService', top: '91%', icon: '<path d="M4 21c5-2 9 0 14 7 5-7 9-9 14-7M7 21l3-11 8 4 8-4 3 11M18 14c-2-5-8-5-8 1 0 5 8 10 8 10s8-5 8-10c0-6-6-6-8-1z"/>' }
    ];

    var list = document.createElement('ol');
    list.className = 'rcph-avenue-stages';
    stages.forEach(function (stage) {
      var item = document.createElement('li');
      item.className = 'rcph-avenue-stage';
      item.style.setProperty('--rcph-avenue-top', stage.top);
      item.appendChild(createAmbientSvg('rcph-avenue-icon', '0 0 36 36', stage.icon));

      var label = document.createElement('span');
      label.className = 'rcph-avenue-label';
      label.textContent = stage.name;
      item.appendChild(label);
      list.appendChild(item);
    });

    avenue.appendChild(list);
    layer.appendChild(avenue);
    return avenue;
  }

  function prepareDrawPath(path) {
    if (!path || typeof path.getTotalLength !== 'function') {
      return 0;
    }

    var length;
    try {
      length = path.getTotalLength();
    } catch (error) {
      return 0;
    }

    if (!Number.isFinite(length) || length <= 0) {
      return 0;
    }

    path.classList.add('rcph-draw-path');
    path.style.strokeDasharray = length.toFixed(2) + 'px';
    path.style.strokeDashoffset = length.toFixed(2) + 'px';
    return length;
  }

  function showDrawPathStatic(path) {
    if (!path) {
      return;
    }

    path.classList.remove('rcph-draw-path');
    path.style.removeProperty('stroke-dasharray');
    path.style.removeProperty('stroke-dashoffset');
  }

  function drawPathOnScroll(path, trigger, start, end) {
    if (!path || state.reduceMotion || !hasGsap() || !state.scrollTriggerReady || !window.ScrollTrigger) {
      showDrawPathStatic(path);
      return null;
    }

    if (!prepareDrawPath(path)) {
      showDrawPathStatic(path);
      return null;
    }

    return trackHomepageAmbient(getGsap().to(path, {
      strokeDashoffset: 0,
      ease: 'none',
      scrollTrigger: {
        trigger: trigger || document.body,
        start: start,
        end: end,
        scrub: 1.15,
        invalidateOnRefresh: true
      }
    }));
  }

  function getHomepageElementScrollTop(element) {
    if (!element || typeof element.getBoundingClientRect !== 'function') {
      return 0;
    }

    return element.getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop || 0);
  }

  function getJourneyDrawStart() {
    var membership = document.querySelector('#riy-recruitment') || document.querySelector('main');
    return Math.max(0, getHomepageElementScrollTop(membership) - (window.innerHeight * 0.78));
  }

  function getJourneyDrawEnd() {
    var contact = document.querySelector('#contact') || document.querySelector('#gallery') || document.body;
    return Math.max(getJourneyDrawStart() + window.innerHeight, getHomepageElementScrollTop(contact) - (window.innerHeight * 0.62));
  }

  function getAvenueDrawStart() {
    var intro = document.querySelector('.section-box') || document.querySelector('#home') || document.body;
    return Math.max(0, getHomepageElementScrollTop(intro) - (window.innerHeight * 0.82));
  }

  function getAvenueDrawEnd() {
    var gallery = document.querySelector('#gallery') || document.querySelector('#contact') || document.body;
    return Math.max(getAvenueDrawStart() + window.innerHeight, getHomepageElementScrollTop(gallery) - (window.innerHeight * 0.58));
  }

  function getAmbientDrawStart() {
    return 0;
  }

  function getAmbientDrawEnd() {
    return Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  }

  function hasAmbientScrollRange() {
    return getAmbientDrawEnd() > Math.max(120, window.innerHeight * 0.18);
  }

  function updateAmbientActiveStage(items, progress, revealPoints, options) {
    if (!items || !items.length || !hasGsap()) {
      return;
    }

    var settings = options || {};
    var inactiveOpacity = settings.inactiveOpacity || 0.05;
    var activeOpacity = settings.activeOpacity || 0.15;
    var influenceRange = settings.influenceRange || 0.16;
    var revealLead = settings.revealLead || 0.12;
    var drift = settings.drift || 16;
    var gsap = getGsap();

    items.forEach(function (item, index) {
      var point = revealPoints[index] || 0;
      var distance = Math.abs(progress - point);
      var influence = Math.max(0, 1 - (distance / influenceRange));
      var revealProgress = Math.max(0, Math.min(1, (progress - point + revealLead) / revealLead));
      var opacity = revealProgress * (inactiveOpacity + ((activeOpacity - inactiveOpacity) * influence));

      item.toggleAttribute('data-ambient-active', influence >= 0.65 && revealProgress > 0.5);
      gsap.set(item, {
        y: -(drift * progress),
        opacity: opacity,
        overwrite: 'auto'
      });
    });
  }

  function revealJourneyItems(container, options) {
    var settings = options || {};
    var itemSelector = settings.itemSelector || '.rcph-journey-stage';
    if (!container || state.reduceMotion || !hasGsap() || !state.scrollTriggerReady || !window.ScrollTrigger) {
      if (container) {
        Array.prototype.forEach.call(container.querySelectorAll(itemSelector), function (item) {
          item.style.removeProperty('opacity');
          item.style.removeProperty('transform');
          item.removeAttribute('data-ambient-active');
        });
      }
      return null;
    }

    var gsap = getGsap();
    var items = Array.prototype.slice.call(container.querySelectorAll(itemSelector));
    var revealPoints = settings.revealPoints || [0.02, 0.25, 0.49, 0.73, 0.94];
    var progressState = { value: 0 };

    updateAmbientActiveStage(items, 0, revealPoints, settings);
    return trackHomepageAmbient(gsap.to(progressState, {
      value: 1,
      ease: 'none',
      onUpdate: function () {
        updateAmbientActiveStage(items, progressState.value, revealPoints, settings);
      },
      scrollTrigger: {
        trigger: document.body,
        start: settings.start || getJourneyDrawStart,
        end: settings.end || getJourneyDrawEnd,
        scrub: settings.scrub || 1.2,
        invalidateOnRefresh: true
      }
    }));
  }

  function initRightJourneyPath(journey, pageType) {
    if (!journey) {
      return;
    }

    var isHome = pageType === 'home';
    var start = isHome ? getJourneyDrawStart : getAmbientDrawStart;
    var end = isHome ? getJourneyDrawEnd : getAmbientDrawEnd;

    drawPathOnScroll(
      journey.querySelector('.rcph-journey-reveal'),
      document.body,
      start,
      end
    );
    revealJourneyItems(journey, {
      itemSelector: '.rcph-journey-stage',
      revealPoints: [0.02, 0.25, 0.49, 0.73, 0.94],
      start: start,
      end: end,
      drift: isHome ? 18 : 11,
      inactiveOpacity: isHome ? 0.02 : 0.018,
      activeOpacity: isHome ? 0.50 : 0.11
    });
  }

  function initLeftAvenuePath(avenue, pageType) {
    if (!avenue) {
      return;
    }

    var isHome = pageType === 'home';
    var start = isHome ? getAvenueDrawStart : getAmbientDrawStart;
    var end = isHome ? getAvenueDrawEnd : getAmbientDrawEnd;

    drawPathOnScroll(
      avenue.querySelector('.rcph-avenue-reveal'),
      document.body,
      start,
      end
    );
    revealJourneyItems(avenue, {
      itemSelector: '.rcph-avenue-stage',
      revealPoints: [0.05, 0.34, 0.63, 0.91],
      start: start,
      end: end,
      drift: isHome ? 16 : 10,
      inactiveOpacity: isHome ? 0.02 : 0.018,
      activeOpacity: isHome ? 0.50 : 0.105,
      influenceRange: 0.18
    });
  }

  function showPublicAmbientStatic(journey, avenue) {
    if (journey) {
      showDrawPathStatic(journey.querySelector('.rcph-journey-reveal'));
      Array.prototype.forEach.call(journey.querySelectorAll('.rcph-journey-stage'), function (item) {
        item.style.removeProperty('opacity');
        item.style.removeProperty('transform');
        item.removeAttribute('data-ambient-active');
      });
    }

    if (avenue) {
      showDrawPathStatic(avenue.querySelector('.rcph-avenue-reveal'));
      Array.prototype.forEach.call(avenue.querySelectorAll('.rcph-avenue-stage'), function (item) {
        item.style.removeProperty('opacity');
        item.style.removeProperty('transform');
        item.removeAttribute('data-ambient-active');
      });
    }
  }

  function initPublicAmbientBackground() {
    if (!isPublicAmbientPage()) {
      return;
    }

    var layer = document.querySelector('.rcph-ambient-layer');
    if (!layer) {
      return;
    }

    var pageType = getAmbientPageType();
    var breakpoint = getAmbientBreakpoint();
    var signature = 'public-dual-ambient-paths:' + pageType + ':' + breakpoint;

    if (state.homepageAmbientReady && state.homepageAmbientBreakpoint === signature) {
      return;
    }

    clearHomepageAmbientAnimations();
    while (layer.firstChild) {
      layer.removeChild(layer.firstChild);
    }

    state.homepageAmbientReady = true;
    state.homepageAmbientBreakpoint = signature;
    layer.setAttribute('data-ambient-breakpoint', breakpoint);
    layer.setAttribute('data-ambient-system', 'pune-avenues-rotaract-journey');
    layer.setAttribute('data-ambient-page-type', pageType === 'home' ? 'home' : 'public');
    layer.setAttribute('data-ambient-page', pageType);

    var avenue = createLeftAvenueAmbient(layer, breakpoint);
    var journey = createRotaractJourneyAmbient(layer, breakpoint);
    var canDrawOnScroll = !state.reduceMotion && breakpoint === 'desktop' && hasGsap() && state.scrollTriggerReady && window.ScrollTrigger && (pageType === 'home' || hasAmbientScrollRange());

    if (canDrawOnScroll) {
      initRightJourneyPath(journey, pageType);
      initLeftAvenuePath(avenue, pageType);
    } else {
      showPublicAmbientStatic(journey, avenue);
    }

    if (state.homepageAmbientResizeReady || typeof window.matchMedia !== 'function') {
      return;
    }

    state.homepageAmbientResizeReady = true;
    var resizeTimer = 0;
    window.addEventListener('resize', function () {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(function () {
        initPublicAmbientBackground();
      }, 180);
    }, { passive: true });
  }

  function initHomepageAmbientBackground() {
    initPublicAmbientBackground();
  }

  function initBodCardTilt(cards) {
    if (state.bodTiltReady || state.reduceMotion || isSmallScreen() || !hasGsap()) {
      return;
    }

    state.bodTiltReady = true;
    var gsap = getGsap();

    cards.forEach(function (card) {
      card.addEventListener('pointermove', function (event) {
        var rect = card.getBoundingClientRect();
        var relX = (event.clientX - rect.left) / Math.max(1, rect.width) - 0.5;
        var relY = (event.clientY - rect.top) / Math.max(1, rect.height) - 0.5;

        card.style.setProperty('--rcph-bod-shine-x', String((relX + 0.5) * 100) + '%');
        card.style.setProperty('--rcph-bod-shine-y', String((relY + 0.5) * 100) + '%');

        gsap.to(card, {
          rotateX: relY * -3.5,
          rotateY: relX * 4,
          y: -6,
          scale: 1.012,
          duration: 0.24,
          ease: 'power2.out',
          overwrite: true
        });
      });

      card.addEventListener('pointerleave', function () {
        card.style.removeProperty('--rcph-bod-shine-x');
        card.style.removeProperty('--rcph-bod-shine-y');

        gsap.to(card, {
          rotateX: 0,
          rotateY: 0,
          y: 0,
          scale: 1,
          duration: 0.42,
          ease: 'power3.out',
          overwrite: true,
          onComplete: function () {
            gsap.set(card, { clearProps: 'transform' });
          }
        });
      });
    });
  }

  function initBodHeroIntro() {
    var hero = document.getElementById('bod');
    if (!hero || state.reduceMotion || !hasGsap()) {
      revealAll(hero || document);
      return;
    }

    var gsap = getGsap();
    var heroItems = toArray('.bod-leadership-badge, .seo-section-heading, .bod-leadership-intro', hero);

    state.prepared.add(hero);
    heroItems.forEach(function (item) {
      state.prepared.add(item);
      item.classList.add('rcph-animating');
    });

    gsap.set(hero, {
      autoAlpha: 0,
      y: isSmallScreen() ? 18 : 34,
      scale: 0.985,
      '--rcph-bod-panel-glow': 0.32,
      willChange: 'opacity, transform'
    });

    gsap.set(heroItems, {
      autoAlpha: 0,
      y: isSmallScreen() ? 16 : 28,
      willChange: 'opacity, transform'
    });

    track(gsap.timeline({
      defaults: {
        ease: 'power3.out'
      },
      onStart: function () {
        hero.classList.add('rcph-animating');
      },
      onComplete: function () {
        finishElement(hero);
        finishElements(heroItems);
      }
    })
      .to(hero, {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        duration: 0.9
      }, 0)
      .to(hero, {
        '--rcph-bod-panel-glow': 1,
        duration: 1.35
      }, 0.05)
      .to(heroItems, {
        autoAlpha: 1,
        y: 0,
        duration: 0.78,
        stagger: 0.12
      }, 0.18));
  }

  function initBodAccentProgress() {
    var page = document.querySelector('.bod-showcase-page');
    if (!page || !canUseScrollAnimations() || !window.ScrollTrigger) {
      return;
    }

    document.body.style.setProperty('--rcph-bod-accent-progress', '0.12');

    track(window.ScrollTrigger.create({
      trigger: page,
      start: 'top 80%',
      end: 'bottom bottom',
      scrub: 0.35,
      onUpdate: function (self) {
        document.body.style.setProperty(
          '--rcph-bod-accent-progress',
          String(Math.max(0.12, self.progress).toFixed(3))
        );
      }
    }));
  }

  function initBodTitleProgress(root) {
    if (!canUseScrollAnimations()) {
      return;
    }

    var gsap = getGsap();

    toArray('.bod-section-title', root).forEach(function (title) {
      gsap.set(title, { '--rcph-bod-title-line': 0 });

      track(gsap.to(title, {
        '--rcph-bod-title-line': 1,
        duration: 0.85,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: title,
          start: 'top 84%',
          once: true
        }
      }));
    });
  }

  function initBodSectionPanels(root) {
    if (!canUseScrollAnimations()) {
      return;
    }

    var gsap = getGsap();
    var sections = toArray('.bod-showcase-section', root).filter(function (section) {
      return section.id !== 'bod';
    });

    sections.forEach(function (section, index) {
      if (state.prepared.has(section)) {
        return;
      }

      state.prepared.add(section);
      gsap.set(section, {
        autoAlpha: 0,
        x: !isSmallScreen() ? (index % 2 === 0 ? -16 : 16) : 0,
        y: isSmallScreen() ? 22 : 42,
        scale: 0.982,
        willChange: 'opacity, transform'
      });

      track(gsap.to(section, {
        autoAlpha: 1,
        x: 0,
        y: 0,
        scale: 1,
        duration: 0.9,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: section,
          start: 'top 94%',
          once: true
        },
        onStart: function () {
          section.classList.add('rcph-animating');
        },
        onComplete: function () {
          finishElement(section);
        }
      }));
    });
  }

  function getBodCardFromVars(index, total) {
    if (isSmallScreen()) {
      return {
        autoAlpha: 0,
        x: 0,
        y: 24,
        scale: 0.98,
        rotationY: 0
      };
    }

    var columns = Math.min(4, Math.max(1, total));
    var column = index % columns;
    var firstRow = index < columns;
    var fromVars = {
      autoAlpha: 0,
      x: index % 2 === 0 ? -18 : 18,
      y: 36,
      scale: 0.975,
      rotationY: 0
    };

    if (firstRow) {
      if (column === 0) {
        fromVars.x = -74;
        fromVars.rotationY = -5;
      } else if (column === columns - 1) {
        fromVars.x = 74;
        fromVars.rotationY = 5;
      } else {
        fromVars.x = 0;
        fromVars.y = 58;
      }
    }

    return fromVars;
  }

  function initBodLeadershipWall(root) {
    var wall = document.querySelector('.bod-leadership-wall');
    if (!wall || !canUseScrollAnimations()) {
      return;
    }

    var gsap = getGsap();
    var cards = toArray('.bod-card', wall).filter(function (card) {
      return !state.prepared.has(card);
    });

    if (!cards.length) {
      return;
    }

    cards.forEach(function (card, index) {
      state.prepared.add(card);
      card.classList.add('rcph-bod-card');

      gsap.set(card, Object.assign(getBodCardFromVars(index, cards.length), {
        transformPerspective: 900,
        willChange: 'opacity, transform'
      }));
    });

    track(gsap.to(cards, {
      autoAlpha: 1,
      x: 0,
      y: 0,
      scale: 1,
      rotationY: 0,
      duration: 0.92,
      ease: 'power3.out',
      stagger: {
        each: isSmallScreen() ? 0.045 : 0.07,
        grid: 'auto',
        from: 'start'
      },
      scrollTrigger: {
        trigger: wall,
        start: 'top 94%',
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

  function initBodCouncilCards(root) {
    if (!canUseScrollAnimations()) {
      return;
    }

    var gsap = getGsap();

    toArray('#district-council, #searic-council', root).forEach(function (section) {
      var cards = toArray('.bod-card', section).filter(function (card) {
        return !state.prepared.has(card);
      });

      if (!cards.length) {
        return;
      }

      cards.forEach(function (card) {
        state.prepared.add(card);
        card.classList.add('rcph-bod-card');
        gsap.set(card, {
          autoAlpha: 0,
          y: isSmallScreen() ? 18 : 30,
          scale: 0.965,
          willChange: 'opacity, transform'
        });
      });

      track(gsap.to(cards, {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        duration: 0.84,
        ease: 'power3.out',
        stagger: 0.08,
        scrollTrigger: {
          trigger: section,
          start: 'top 94%',
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
    });
  }

  function initBodContactReveal(root) {
    var contact = document.getElementById('contact');
    if (!contact || !canUseScrollAnimations()) {
      return;
    }

    var gsap = getGsap();
    var items = toArray('.contact-card, #contact > p', root).filter(function (item) {
      return !state.prepared.has(item);
    });

    if (!items.length) {
      return;
    }

    items.forEach(function (item) {
      state.prepared.add(item);
      gsap.set(item, {
        autoAlpha: 0,
        y: isSmallScreen() ? 16 : 26,
        scale: item.classList.contains('contact-card') ? 0.975 : 1,
        willChange: 'opacity, transform'
      });
    });

    track(gsap.to(items, {
      autoAlpha: 1,
      y: 0,
      scale: 1,
      duration: 0.74,
      ease: 'power3.out',
      stagger: 0.08,
      scrollTrigger: {
        trigger: contact,
        start: 'top 94%',
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
  }

  function initBodLeadershipShowcase() {
    if (!isBodPage()) {
      return;
    }

    var root = document.querySelector('body[data-rcph-page="bod"]') || document.body;
    var cards = toArray('.bod-card', root);

    cards.forEach(function (card) {
      card.classList.add('rcph-bod-card');
    });

    if (state.bodShowcaseReady) {
      initBodCardTilt(cards);
      return;
    }

    state.bodShowcaseReady = true;
    root.classList.add('rcph-bod-showcase-ready');

    if (state.reduceMotion || !hasGsap() || !state.scrollTriggerReady) {
      revealAll(root);
      return;
    }

    initBodHeroIntro();
    initBodAccentProgress();
    initBodTitleProgress(root);
    initBodSectionPanels(root);
    initBodLeadershipWall(root);
    initBodCouncilCards(root);
    initBodContactReveal(root);
    initBodCardTilt(cards);
    scheduleRefreshes();
  }

  function initHomepageCinematicAnimations() {
    initHomepageAmbientBackground();
    initHomepageCinematicHero();
    initHomepageScrollProgress();
    initHomepagePanelTransitions();
    initHomepageHighlightMotion();
    initHomepageProjectDeck();
    initHomepageGalleryMotion();
    scheduleRefreshes();
  }

  function initPremiumAnimations() {
    if (isPublicAmbientPage() && (state.reduceMotion || !hasGsap())) {
      initPublicAmbientBackground();
    }

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
    initPublicAmbientBackground();

    if (isHomepage()) {
      initHomepageCinematicAnimations();
      return;
    }

    if (isBodPage()) {
      initBodLeadershipShowcase();
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
    initHomepageAmbientBackground: initHomepageAmbientBackground,
    initPublicAmbientBackground: initPublicAmbientBackground,
    initBodLeadershipShowcase: initBodLeadershipShowcase,
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
