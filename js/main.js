/**
 * Apple-style Landing — Main script
 * Smooth scroll, GSAP animations, progress bar, Lucide icons
 */

(function () {
  'use strict';

  // Register GSAP ScrollTrigger
  if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
    gsap.registerPlugin(ScrollTrigger);
  }

  /**
   * Initialize Lucide icons (replace elements with data-lucide by SVG)
   */
  function initIcons() {
    if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
      lucide.createIcons();
    }
  }

  /**
   * Progress bar: width based on scroll position
   */
  function initProgressBar() {
    var bar = document.getElementById('progressBar');
    if (!bar) return;

    function updateProgress() {
      var winScroll = document.documentElement.scrollTop || document.body.scrollTop;
      var height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      var percent = height > 0 ? (winScroll / height) * 100 : 0;
      bar.style.width = percent + '%';
    }

    window.addEventListener('scroll', function () {
      requestAnimationFrame(updateProgress);
    });
    updateProgress();
  }

  /**
   * Smooth scroll for anchor links (fallback if CSS scroll-behavior not enough)
   * Ссылки внутри мобильного меню не обрабатываем — их закрытие и переход в initMobileMenuClose
   */
  function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
      if (anchor.closest('#offcanvasNav')) return;
      var href = anchor.getAttribute('href');
      if (href === '#') return;
      var target = document.querySelector(href);
      if (!target) return;

      anchor.addEventListener('click', function (e) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }

  /**
   * Мобильное меню: по клику на пункт — закрыть меню и выполнить переход/скролл.
   * Скролл выполняется после полного закрытия offcanvas, чтобы заголовок секции оказался сразу под шапкой (учитывается scroll-margin-top в CSS).
   */
  function initMobileMenuClose() {
    var offcanvasEl = document.getElementById('offcanvasNav');
    if (!offcanvasEl) return;

    offcanvasEl.querySelectorAll('.mobile-nav-link').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        var href = link.getAttribute('href');
        var hash = href && href.indexOf('#') !== -1 ? href.slice(href.indexOf('#')) : '';

        if (hash && document.querySelector(hash)) {
          var target = document.querySelector(hash);
          var offcanvas = typeof bootstrap !== 'undefined' && bootstrap.Offcanvas && bootstrap.Offcanvas.getInstance(offcanvasEl);
          if (offcanvas) {
            offcanvasEl.addEventListener('hidden.bs.offcanvas', function once() {
              offcanvasEl.removeEventListener('hidden.bs.offcanvas', once);
              target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
            offcanvas.hide();
          } else {
            target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        } else if (href) {
          window.location.href = href;
        }
      });
    });
  }

  /**
   * GSAP: animate elements on scroll
   */
  function initScrollAnimations() {
    if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') {
      document.querySelectorAll('.animate-item').forEach(function (el) {
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
      return;
    }

    gsap.utils.toArray('.animate-item').forEach(function (el) {
      gsap.fromTo(
        el,
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          duration: 0.7,
          ease: 'power2.out',
          scrollTrigger: {
            trigger: el,
            start: 'top 88%',
            end: 'bottom 12%',
            toggleActions: 'play none none none',
          },
        }
      );
    });
  }

  /**
   * Optional: subtle hero entrance animation
   */
  function initHeroAnimation() {
    if (typeof gsap === 'undefined') return;

    var heroItems = document.querySelectorAll('.hero .animate-item');
    if (!heroItems.length) return;

    gsap.fromTo(
      heroItems,
      { opacity: 0, y: 32 },
      {
        opacity: 1,
        y: 0,
        duration: 0.9,
        stagger: 0.12,
        ease: 'power2.out',
        delay: 0.2,
      }
    );
  }

  /**
   * Run all inits
   */
  function init() {
    initIcons();
    initProgressBar();
    initSmoothScroll();
    initMobileMenuClose();
    initScrollAnimations();
    initHeroAnimation();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
