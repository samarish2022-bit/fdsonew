/**
 * Мобильное меню: при клике на пункт — закрыть offcanvas и выполнить переход/скролл.
 * Подключать на страницах, где есть #offcanvasNav и нет main.js.
 */
(function () {
  'use strict';

  function init() {
    var offcanvasEl = document.getElementById('offcanvasNav');
    if (!offcanvasEl) return;

    offcanvasEl.querySelectorAll('.mobile-nav-link').forEach(function (link) {
      link.addEventListener('click', function (e) {
        e.preventDefault();
        var href = link.getAttribute('href');
        var offcanvas = typeof bootstrap !== 'undefined' && bootstrap.Offcanvas && bootstrap.Offcanvas.getInstance(offcanvasEl);
        if (offcanvas) offcanvas.hide();

        if (href && href.charAt(0) === '#') {
          var target = document.querySelector(href);
          if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        } else if (href) {
          window.location.href = href;
        }
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
