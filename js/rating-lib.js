/**
 * Общая логика рейтинга ФДСО:
 * - сводные таблицы (место / участник / очки) на rating.html
 * - детализация турниров на rating-*-detail.html
 */
(function (global) {
  'use strict';

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

  /**
   * Данные турниров: localStorage → window[defaultGlobal] → null
   * @param {string} storageKey
   * @param {string} defaultGlobal
   */
  function loadTournamentData(storageKey, defaultGlobal) {
    var data = null;
    try {
      var raw = localStorage.getItem(storageKey);
      if (raw) data = JSON.parse(raw);
      if (!data || !data.rows || !data.rows.length) {
        var def = global[defaultGlobal];
        data = (def && def.rows && def.rows.length) ? def : null;
      }
      if (!data || !data.rows.length) return null;
    } catch (e) {
      return null;
    }
    return data;
  }

  /** Топ / полный список по «Сумма 75%». */
  function rankPlayers(data, limit) {
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
    if (typeof limit === 'number' && limit > 0) return items.slice(0, limit);
    return items;
  }

  function placeIconHtml(place) {
    if (place === 1) return '<i data-lucide="trophy" aria-hidden="true"></i> ';
    if (place === 2 || place === 3) return '<i data-lucide="medal" aria-hidden="true"></i> ';
    return '';
  }

  function placeClassName(place) {
    var cls = 'rating-place';
    if (place === 1) cls += ' rating-place-1';
    else if (place === 2) cls += ' rating-place-2';
    else if (place === 3) cls += ' rating-place-3';
    return cls;
  }

  /**
   * Сводная таблица рейтинга.
   * opts: { storageKey, defaultGlobal, panelSelector }
   */
  function renderSummary(opts) {
    var tbody = document.querySelector(opts.panelSelector + ' .rating-table tbody');
    if (!tbody) return false;
    var data = loadTournamentData(opts.storageKey, opts.defaultGlobal);
    if (!data) return false;

    var items = rankPlayers(data);
    tbody.innerHTML = items.map(function (item, idx) {
      var place = idx + 1;
      return (
        '<tr><td><span class="' + placeClassName(place) + '">' +
        placeIconHtml(place) + place + '</span></td><td>' +
        escapeHtml(item.name) + '</td><td>' + item.sum75 +
        '</td><td><span class="rating-change rating-change-none">—</span></td></tr>'
      );
    }).join('');
    return true;
  }

  /**
   * Детализация турниров.
   * opts: {
   *   storageKey, defaultGlobal,
   *   theadDatesId, tbodyId,
   *   nameHeader,
   *   theadMoId?  // опционально: строка М/О
   * }
   */
  function renderDetail(opts) {
    var data = loadTournamentData(opts.storageKey, opts.defaultGlobal);
    if (!data) return false;

    var theadDates = document.getElementById(opts.theadDatesId);
    var tbody = document.getElementById(opts.tbodyId);
    if (!theadDates || !tbody) return false;

    var dates = data.dates || [];
    var rows = data.rows || [];
    var nameHeader = opts.nameHeader || 'Фамилия Имя отчество';

    theadDates.innerHTML =
      '<th scope="col" class="col-rank">Рейтинг</th>' +
      '<th scope="col" class="col-name">' + escapeHtml(nameHeader) + '</th>' +
      dates.map(function (d) {
        return '<th scope="col" colspan="2">' + escapeHtml(d) + '</th>';
      }).join('') +
      '<th scope="col" class="col-sum">Сумма</th>' +
      '<th scope="col" class="col-sum col-sum75">Сумма<br>75%</th>';

    if (opts.theadMoId) {
      var theadMo = document.getElementById(opts.theadMoId);
      if (theadMo) {
        var moCells = dates.map(function () { return '<th>М</th><th>О</th>'; }).join('');
        theadMo.innerHTML = '<th></th><th></th>' + moCells + '<th></th><th></th>';
      }
    }

    tbody.innerHTML = '';
    rows.forEach(function (row) {
      var cells = row.cells || [];
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + escapeHtml(String(row.rank || '')) + '</td>' +
        '<td>' + escapeHtml(row.name || '') + '</td>' +
        cells.map(function (c) { return '<td>' + escapeHtml(String(c || '')) + '</td>'; }).join('');
      tbody.appendChild(tr);
    });
    return true;
  }

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  /**
   * Запуск сводных таблиц на rating.html
   * @param {Array} panels — массив opts для renderSummary
   */
  function initSummaryPage(panels) {
    onReady(function () {
      (panels || []).forEach(function (opts) {
        renderSummary(opts);
      });
      if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
        lucide.createIcons();
      }
    });
  }

  /** Запуск детализации на rating-*-detail.html */
  function initDetailPage(opts) {
    onReady(function () {
      renderDetail(opts);
    });
  }

  global.FDSORating = {
    escapeHtml: escapeHtml,
    sumExcludingTwoSmallest: sumExcludingTwoSmallest,
    loadTournamentData: loadTournamentData,
    rankPlayers: rankPlayers,
    renderSummary: renderSummary,
    renderDetail: renderDetail,
    initSummaryPage: initSummaryPage,
    initDetailPage: initDetailPage
  };
})(typeof window !== 'undefined' ? window : this);
