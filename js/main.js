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
   * Скролл к секции (или её заголовку). behavior: 'smooth' | 'auto'
   */
  function scrollToSection(target, behavior) {
    if (!target) return;
    var title = target.querySelector && (
      target.querySelector('.container > .section-title') ||
      target.querySelector('.section-title')
    );
    var el = title || target;
    el.scrollIntoView({ behavior: behavior || 'smooth', block: 'start' });
  }

  /**
   * Переход с других страниц (rating.html → index.html#competitions):
   * браузер часто оставляет взгляд наверху из‑за scroll-behavior: smooth / поздней вёрстки.
   * Явно прокручиваем к якорю после загрузки и ещё раз после отрисовки контента.
   */
  function initHashScrollOnLoad() {
    var hash = window.location.hash;
    if (!hash || hash === '#') return;

    function go(behavior) {
      var target = document.querySelector(hash);
      if (target) scrollToSection(target, behavior || 'auto');
    }

    go('auto');
    requestAnimationFrame(function () {
      go('auto');
    });
    window.addEventListener('load', function () {
      go('auto');
      setTimeout(function () {
        go('auto');
        if (typeof ScrollTrigger !== 'undefined' && ScrollTrigger.refresh) {
          ScrollTrigger.refresh();
        }
      }, 150);
    });
  }

  /**
   * Smooth scroll for same-page anchor links (#news и т.п.)
   * Ссылки внутри мобильного меню — в initMobileMenuClose
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
        if (history.pushState) {
          history.pushState(null, '', href);
        }
        scrollToSection(target, 'smooth');
      });
    });
  }

  /**
   * Мобильное меню: закрыть offcanvas и перейти/проскроллить.
   * Ссылки на другие страницы (index.html#…) — всегда полный переход, не скролл на месте.
   */
  function initMobileMenuClose() {
    var offcanvasEl = document.getElementById('offcanvasNav');
    if (!offcanvasEl) return;

    offcanvasEl.querySelectorAll('.mobile-nav-link').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        var href = link.getAttribute('href');
        if (!href) return;

        var offcanvas = typeof bootstrap !== 'undefined' && bootstrap.Offcanvas && bootstrap.Offcanvas.getInstance(offcanvasEl);

        // Другая страница или тот же файл с путём — полный переход (сохраняет #якорь)
        if (href.charAt(0) !== '#') {
          if (offcanvas) {
            offcanvasEl.addEventListener('hidden.bs.offcanvas', function once() {
              offcanvasEl.removeEventListener('hidden.bs.offcanvas', once);
              window.location.href = href;
            });
            offcanvas.hide();
          } else {
            window.location.href = href;
          }
          return;
        }

        var target = document.querySelector(href);
        if (target) {
          if (offcanvas) {
            offcanvasEl.addEventListener('hidden.bs.offcanvas', function once() {
              offcanvasEl.removeEventListener('hidden.bs.offcanvas', once);
              scrollToSection(target, 'smooth');
            });
            offcanvas.hide();
          } else {
            scrollToSection(target, 'smooth');
          }
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
      // Заголовки разделов всегда на месте — иначе при переходе из меню остаются opacity: 0
      if (el.classList.contains('section-title')) {
        el.style.opacity = '1';
        el.style.transform = 'none';
        return;
      }

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
    initHashScrollOnLoad();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
