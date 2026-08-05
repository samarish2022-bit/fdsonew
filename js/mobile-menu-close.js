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
        if (!href) return;

        var offcanvas = typeof bootstrap !== 'undefined' && bootstrap.Offcanvas && bootstrap.Offcanvas.getInstance(offcanvasEl);

        function go() {
          // index.html#competitions и т.п. — полный переход, чтобы якорь не потерялся
          if (href.charAt(0) !== '#') {
            window.location.href = href;
            return;
          }
          var target = document.querySelector(href);
          if (target) {
            var title = target.querySelector('.container > .section-title') || target.querySelector('.section-title');
            (title || target).scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }

        if (offcanvas) {
          offcanvasEl.addEventListener('hidden.bs.offcanvas', function once() {
            offcanvasEl.removeEventListener('hidden.bs.offcanvas', once);
            go();
          });
          offcanvas.hide();
        } else {
          go();
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
