/**
 * Политика и правила: открытие в overlay-popup на странице
 * (надёжнее window.open — его часто блокируют браузеры).
 */
(function () {
  'use strict';

  var overlayEl = null;
  var frameEl = null;
  var titleEl = null;
  var lastFocus = null;

  function ensureOverlay() {
    if (overlayEl) return overlayEl;

    overlayEl = document.createElement('div');
    overlayEl.id = 'legal-popup-overlay';
    overlayEl.className = 'legal-popup-overlay';
    overlayEl.setAttribute('hidden', '');
    overlayEl.setAttribute('role', 'dialog');
    overlayEl.setAttribute('aria-modal', 'true');
    overlayEl.setAttribute('aria-labelledby', 'legal-popup-title');
    overlayEl.innerHTML =
      '<div class="legal-popup-backdrop" data-legal-dismiss="1"></div>' +
      '<div class="legal-popup-window">' +
      '  <div class="legal-popup-chrome">' +
      '    <h2 class="legal-popup-title" id="legal-popup-title">Документ</h2>' +
      '    <button type="button" class="legal-popup-close" data-legal-dismiss="1" aria-label="Закрыть">Закрыть</button>' +
      '  </div>' +
      '  <iframe class="legal-popup-frame" title="Текст документа"></iframe>' +
      '</div>';

    document.body.appendChild(overlayEl);
    frameEl = overlayEl.querySelector('.legal-popup-frame');
    titleEl = overlayEl.querySelector('.legal-popup-title');

    overlayEl.addEventListener('click', function (e) {
      var t = e.target;
      if (t && t.getAttribute && t.getAttribute('data-legal-dismiss') === '1') {
        closeLegalPopup();
      }
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlayEl && !overlayEl.hasAttribute('hidden')) {
        closeLegalPopup();
      }
    });

    return overlayEl;
  }

  function openLegalPopup(url, title) {
    ensureOverlay();
    lastFocus = document.activeElement;
    titleEl.textContent = title || 'Документ';
    // embed=1 — страница в iframe без своей кнопки «Закрыть»/редиректа
    var sep = url.indexOf('?') >= 0 ? '&' : '?';
    frameEl.src = url + sep + 'embed=1';
    overlayEl.removeAttribute('hidden');
    document.body.classList.add('legal-popup-open');
    var closeBtn = overlayEl.querySelector('.legal-popup-close');
    if (closeBtn) closeBtn.focus();
    return true;
  }

  function closeLegalPopup() {
    if (!overlayEl) return;
    overlayEl.setAttribute('hidden', '');
    document.body.classList.remove('legal-popup-open');
    if (frameEl) frameEl.src = 'about:blank';
    if (lastFocus && typeof lastFocus.focus === 'function') {
      try { lastFocus.focus(); } catch (e) {}
    }
  }

  function titleFromLink(link) {
    var key = link.getAttribute('data-legal-popup') || '';
    if (key === 'privacy') return 'Политика конфиденциальности';
    if (key === 'terms') return 'Правила использования сайта';
    return (link.textContent || 'Документ').replace(/\s+/g, ' ').trim();
  }

  function onLegalLinkClick(e) {
    var link = e.target && e.target.closest
      ? e.target.closest('a.js-legal-popup, a[data-legal-popup]')
      : null;
    if (!link || !document.body.contains(link)) return;
    var href = link.getAttribute('href');
    if (!href || href === '#') {
      e.preventDefault();
      return;
    }
    // Не перехватывать модификаторы (открытие в новой вкладке по желанию пользователя)
    if (e.defaultPrevented) return;
    if (e.button !== 0) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    e.preventDefault();
    e.stopPropagation();
    openLegalPopup(href, titleFromLink(link));
  }

  function initFooterPopups() {
    // Capture — до других обработчиков (smooth scroll и т.п.)
    document.addEventListener('click', onLegalLinkClick, true);
  }

  function initCloseButton() {
    var btn = document.getElementById('legal-close');
    if (!btn) return;

    var params = new URLSearchParams(window.location.search || '');
    var embedded = params.get('embed') === '1' || window.self !== window.top;

    if (embedded) {
      document.documentElement.classList.add('legal-embed');
      btn.addEventListener('click', function () {
        if (window.self !== window.top) {
          try {
            window.parent.postMessage({ type: 'fdso-legal-close' }, '*');
          } catch (err) {}
          return;
        }
        window.close();
      });
      return;
    }

    btn.addEventListener('click', function () {
      window.close();
      setTimeout(function () {
        if (!window.closed) window.location.href = 'index.html';
      }, 150);
    });
  }

  function initParentMessage() {
    window.addEventListener('message', function (e) {
      if (e && e.data && e.data.type === 'fdso-legal-close') {
        closeLegalPopup();
      }
    });
  }

  function init() {
    initFooterPopups();
    initCloseButton();
    initParentMessage();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.FDSOOpenLegalPopup = openLegalPopup;
  window.FDSOCloseLegalPopup = closeLegalPopup;
})();
