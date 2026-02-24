/**
 * Мужской рейтинг формируется из таблицы «Детализация мужских турниров»
 * (localStorage fdso_men_tournaments). Сортировка по Сумма 75%.
 */
(function () {
  'use strict';
  var KEY = 'fdso_men_tournaments';

  function escapeHtml(s) {
    if (s == null || s === '') return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  /** Сумма очков за вычетом двух наименьших (пустые = 0). */
  function sumExcludingTwoSmallest(pointValues) {
    var arr = (pointValues || []).map(function (v) { return parseInt(v, 10) || 0; });
    arr.sort(function (a, b) { return a - b; });
    if (arr.length > 2) arr = arr.slice(2);
    else arr = [];
    return arr.reduce(function (s, n) { return s + n; }, 0);
  }

  function load() {
    var tbody = document.querySelector('#men-panel .rating-table tbody');
    if (!tbody) return;
    var data = null;
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        data = JSON.parse(raw);
      }
      if (!data || !data.rows || !data.rows.length) {
        data = (typeof window.FDSO_DEFAULT_MEN_TOURNAMENTS !== 'undefined' && window.FDSO_DEFAULT_MEN_TOURNAMENTS.rows && window.FDSO_DEFAULT_MEN_TOURNAMENTS.rows.length)
          ? window.FDSO_DEFAULT_MEN_TOURNAMENTS
          : null;
      }
      if (!data || !data.rows.length) return;
    } catch (e) {
      return;
    }

    var dates = data.dates || [];
    var rows = data.rows;
    var cellCount = (dates.length * 2) + 2;

    var items = rows.map(function (row) {
      var cells = (row.cells || []).slice();
      while (cells.length < cellCount) cells.push('');
      var points = [];
      for (var i = 1; i < cellCount - 2; i += 2) points.push(cells[i]);
      var sum75 = sumExcludingTwoSmallest(points);
      return { name: row.name || '', sum75: sum75 };
    });

    items.sort(function (a, b) { return b.sum75 - a.sum75; });

    var html = items.map(function (item, idx) {
      var place = idx + 1;
      var placeClass = 'rating-place';
      if (place === 1) placeClass += ' rating-place-1';
      else if (place === 2) placeClass += ' rating-place-2';
      else if (place === 3) placeClass += ' rating-place-3';
      var icon = '';
      if (place === 1) icon = '<i data-lucide="trophy" aria-hidden="true"></i> ';
      else if (place === 2 || place === 3) icon = '<i data-lucide="medal" aria-hidden="true"></i> ';
      return '<tr><td><span class="' + placeClass + '">' + icon + place + '</span></td><td>' +
        escapeHtml(item.name) + '</td><td>' + item.sum75 + '</td><td><span class="rating-change rating-change-none">—</span></td></tr>';
    }).join('');

    tbody.innerHTML = html;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();
