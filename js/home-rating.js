/**
 * Главная: карточки рейтинга (топ-3 по каждому виду) + кнопка «Весь рейтинг».
 * Данные — те же, что на rating.html (localStorage → FDSO_DEFAULT_*).
 */
(function () {
  'use strict';

  var RATING_PAGE = 'rating.html';
  var TOP_N = 3;

  var CATEGORIES = [
    {
      id: 'men',
      title: 'Мужской рейтинг',
      key: 'fdso_men_tournaments',
      defaultKey: 'FDSO_DEFAULT_MEN_TOURNAMENTS'
    },
    {
      id: 'women',
      title: 'Женский рейтинг',
      key: 'fdso_women_tournaments',
      defaultKey: 'FDSO_DEFAULT_WOMEN_TOURNAMENTS'
    },
    {
      id: 'men-doubles',
      title: 'Мужской парный рейтинг',
      key: 'fdso_men_doubles_tournaments',
      defaultKey: 'FDSO_DEFAULT_MEN_DOUBLES_TOURNAMENTS'
    },
    {
      id: 'women-doubles',
      title: 'Женский парный рейтинг',
      key: 'fdso_women_doubles_tournaments',
      defaultKey: 'FDSO_DEFAULT_WOMEN_DOUBLES_TOURNAMENTS'
    }
  ];

  function escapeHtml(s) {
    if (s == null || s === '') return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function sumExcludingTwoSmallest(pointValues) {
    var arr = (pointValues || []).map(function (v) { return parseInt(v, 10) || 0; });
    arr.sort(function (a, b) { return a - b; });
    if (arr.length > 2) arr = arr.slice(2);
    else arr = [];
    return arr.reduce(function (s, n) { return s + n; }, 0);
  }

  function loadTournamentData(storageKey, defaultKey) {
    var data = null;
    try {
      var raw = localStorage.getItem(storageKey);
      if (raw) data = JSON.parse(raw);
      if (!data || !data.rows || !data.rows.length) {
        var def = window[defaultKey];
        data = (def && def.rows && def.rows.length) ? def : null;
      }
    } catch (e) {
      data = null;
    }
    return data;
  }

  /** Топ игроков по «Сумма 75%» — та же логика, что в rating-*.js */
  function getTopPlayers(data, limit) {
    if (!data || !data.rows || !data.rows.length) return [];
    var dates = data.dates || [];
    var cellCount = (dates.length * 2) + 2;
    var items = data.rows.map(function (row) {
      var cells = (row.cells || []).slice();
      while (cells.length < cellCount) cells.push('');
      var points = [];
      for (var i = 1; i < cellCount - 2; i += 2) points.push(cells[i]);
      return { name: row.name || '', sum75: sumExcludingTwoSmallest(points) };
    });
    items.sort(function (a, b) { return b.sum75 - a.sum75; });
    return items.slice(0, limit);
  }

  function placeIcon(place) {
    if (place === 1) return '<i data-lucide="trophy" aria-hidden="true"></i> ';
    if (place === 2 || place === 3) return '<i data-lucide="medal" aria-hidden="true"></i> ';
    return '';
  }

  function renderCard(category, top) {
    var listHtml;
    if (!top.length) {
      listHtml = '<p class="rating-home-card-empty text-muted mb-0">Пока нет данных рейтинга.</p>';
    } else {
      listHtml =
        '<ol class="rating-home-card-list">' +
        top.map(function (item, idx) {
          var place = idx + 1;
          var placeClass = 'rating-place';
          if (place === 1) placeClass += ' rating-place-1';
          else if (place === 2) placeClass += ' rating-place-2';
          else if (place === 3) placeClass += ' rating-place-3';
          return (
            '<li class="rating-home-card-row">' +
            '<span class="' + placeClass + '">' + placeIcon(place) + place + '</span>' +
            '<span class="rating-home-card-name">' + escapeHtml(item.name) + '</span>' +
            '<span class="rating-home-card-points">' + item.sum75 + '</span>' +
            '</li>'
          );
        }).join('') +
        '</ol>';
    }

    return (
      '<article class="col-12 col-md-6 col-xl-3">' +
      '<div class="rating-home-card">' +
      '<h3 class="rating-home-card-title">' + escapeHtml(category.title) + '</h3>' +
      listHtml +
      '</div>' +
      '</article>'
    );
  }

  function markSectionReady() {
    var el = document.getElementById('rating');
    if (el) el.classList.add('is-ready');
    try {
      window.dispatchEvent(new CustomEvent('fdso:section-ready', { detail: { id: 'rating' } }));
      window.dispatchEvent(new CustomEvent('fdso:content-ready'));
    } catch (err) { /* ignore */ }
  }

  function render() {
    var row = document.getElementById('rating-row');
    var moreWrap = document.getElementById('rating-more-wrap');
    if (!row) return;

    var html = CATEGORIES.map(function (cat) {
      var data = loadTournamentData(cat.key, cat.defaultKey);
      var top = getTopPlayers(data, TOP_N);
      return renderCard(cat, top);
    }).join('');

    row.innerHTML = html;

    if (moreWrap) {
      moreWrap.innerHTML =
        '<a href="' + RATING_PAGE + '" class="btn btn-outline-primary">Весь рейтинг</a>';
    }

    if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
      lucide.createIcons();
    }

    markSectionReady();
  }

  function init() {
    if (!document.getElementById('rating-row')) return;
    render();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
