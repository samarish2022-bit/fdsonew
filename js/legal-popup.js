/**
 * Открытие политики и правил в отдельном popup-окне;
 * кнопка «Закрыть» на legal-страницах.
 */
(function () {
  'use strict';

  var POPUP_NAME_PREFIX = 'fdso_legal_';
  var POPUP_WIDTH = 720;
  var POPUP_HEIGHT = 820;

  function popupFeatures() {
    var dualScreenLeft = typeof window.screenLeft !== 'undefined' ? window.screenLeft : window.screenX;
    var dualScreenTop = typeof window.screenTop !== 'undefined' ? window.screenTop : window.screenY;
    var width = window.innerWidth || document.documentElement.clientWidth || screen.width;
    var height = window.innerHeight || document.documentElement.clientHeight || screen.height;
    var left = Math.max(0, Math.round(dualScreenLeft + (width - POPUP_WIDTH) / 2));
    var top = Math.max(0, Math.round(dualScreenTop + (height - POPUP_HEIGHT) / 2));
    return [
      'popup=yes',
      'width=' + POPUP_WIDTH,
      'height=' + POPUP_HEIGHT,
      'left=' + left,
      'top=' + top,
      'scrollbars=yes',
      'resizable=yes',
      'menubar=no',
      'toolbar=no',
      'location=no',
      'status=no'
    ].join(',');
  }

  function openLegalPopup(url, nameKey) {
    var name = POPUP_NAME_PREFIX + (nameKey || 'doc');
    var win = window.open(url, name, popupFeatures());
    if (win) {
      try { win.focus(); } catch (e) {}
      return win;
    }
    // Если браузер заблокировал popup — открыть в той же вкладке
    window.location.href = url;
    return null;
  }

  function initFooterPopups() {
    var links = document.querySelectorAll('a.js-legal-popup, a[data-legal-popup]');
    Array.prototype.forEach.call(links, function (link) {
      if (link.getAttribute('data-legal-bound') === '1') return;
      link.setAttribute('data-legal-bound', '1');
      link.addEventListener('click', function (e) {
        e.preventDefault();
        var href = link.getAttribute('href');
        if (!href || href === '#') return;
        var key = link.getAttribute('data-legal-popup') || 'doc';
        openLegalPopup(href, key);
      });
    });
  }

  function initCloseButton() {
    var btn = document.getElementById('legal-close');
    if (!btn) return;
    btn.addEventListener('click', function () {
      window.close();
      // Если окно открыто не через script (напрямую) — уводим на главную
      setTimeout(function () {
        if (!window.closed) {
          window.location.href = 'index.html';
        }
      }, 150);
    });
  }

  function init() {
    initFooterPopups();
    initCloseButton();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.FDSOOpenLegalPopup = openLegalPopup;
})();
