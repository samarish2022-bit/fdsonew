/**
 * Загрузка таблицы детализации женских парных турниров из localStorage (редактируемой в админке).
 * Ключ: fdso_women_doubles_tournaments. Если данных нет — остаётся встроенная в HTML таблица.
 */
(function () {
  'use strict';
  var KEY = 'fdso_women_doubles_tournaments';

  function escapeHtml(s) {
    if (s == null || s === '') return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function load() {
    var data = null;
    try {
      var raw = localStorage.getItem(KEY);
      if (raw) {
        data = JSON.parse(raw);
      }
      if (!data || !data.dates || !data.rows || !data.rows.length) {
        data = (typeof window.FDSO_DEFAULT_WOMEN_DOUBLES_TOURNAMENTS !== 'undefined' && window.FDSO_DEFAULT_WOMEN_DOUBLES_TOURNAMENTS.rows && window.FDSO_DEFAULT_WOMEN_DOUBLES_TOURNAMENTS.rows.length)
          ? window.FDSO_DEFAULT_WOMEN_DOUBLES_TOURNAMENTS
          : null;
      }
      if (!data || !data.rows.length) return;
    } catch (e) {
      return;
    }

    var theadDates = document.getElementById('women-doubles-detail-thead-dates');
    var tbody = document.getElementById('women-doubles-detail-tbody');
    if (!theadDates || !tbody) return;

    var dates = data.dates;
    var rows = data.rows;

    theadDates.innerHTML =
      '<th scope="col" class="col-rank">Рейтинг</th>' +
      '<th scope="col" class="col-name">Пара</th>' +
      dates.map(function (d) { return '<th scope="col" colspan="2">' + escapeHtml(d) + '</th>'; }).join('') +
      '<th scope="col" class="col-sum">Сумма</th>' +
      '<th scope="col" class="col-sum col-sum75">Сумма<br>75%</th>';

    var theadMo = document.getElementById('women-doubles-detail-thead-mo');
    if (theadMo) {
      var moCells = dates.map(function () { return '<th>М</th><th>О</th>'; }).join('');
      theadMo.innerHTML = '<th></th><th></th>' + moCells + '<th></th><th></th>';
    }

    tbody.innerHTML = '';
    rows.forEach(function (row) {
      var cells = row.cells || [];
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td>' + escapeHtml(String(row.rank || '')) + '</td>' +
        '<td>' + escapeHtml(row.name || '') + '</td>' +
        cells.map(function (c) { return '<td>' + escapeHtml(String(c || '')) + '</td>'; }).join('') +
        '';
      tbody.appendChild(tr);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();
