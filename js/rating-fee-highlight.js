/**
 * Подсветка ФИО в рейтинге: если в админке (раздел «Люди») взнос не оплачен — ФИО выделяется красным.
 * Данные: при открытии по HTTP(S) — с сервера GET /api/people, иначе localStorage fdso_people (list с полями name, feePaid).
 */
(function () {
  'use strict';
  var KEY_PEOPLE = 'fdso_people';
  var cachedPeopleFromServer = null;

  function isHttp() {
    return typeof location !== 'undefined' && location.origin &&
      (location.origin.startsWith('http://') || location.origin.startsWith('https://'));
  }

  /**
   * Загружает список людей с сайта (GET /api/people). При успехе кэширует и возвращает массив, иначе null.
   */
  function loadPeopleFromServer() {
    if (!isHttp()) return Promise.resolve(null);
    var url = location.origin + '/api/people?t=' + Date.now();
    return fetch(url)
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('not ok')); })
      .then(function (data) {
        var list = Array.isArray(data) ? data : (data && Array.isArray(data.list) ? data.list : []);
        cachedPeopleFromServer = list;
        return list;
      })
      .catch(function () {
        cachedPeopleFromServer = null;
        return null;
      });
  }

  /**
   * Синхронно возвращает список людей: приоритет — кэш с сервера, иначе localStorage.
   */
  function getPeopleList() {
    if (cachedPeopleFromServer !== null && Array.isArray(cachedPeopleFromServer)) {
      return cachedPeopleFromServer;
    }
    try {
      var raw = localStorage.getItem(KEY_PEOPLE);
      var data = raw ? JSON.parse(raw) : null;
      return (data && Array.isArray(data.list)) ? data.list : [];
    } catch (e) {
      return [];
    }
  }

  function getUnpaidNames() {
    var list = getPeopleList();
    var set = {};
    list.forEach(function (p) {
      if (p && !p.feePaid) {
        var n = (p.name || '').trim();
        if (n) set[n] = true;
      }
    });
    return set;
  }

  function applyHighlight() {
    var unpaid = getUnpaidNames();
    var selector = '.rating-table tbody tr td:nth-child(2), .detail-table tbody tr td:nth-child(2)';
    document.querySelectorAll(selector).forEach(function (td) {
      var name = (td.textContent || '').trim();
      if (unpaid[name]) {
        td.classList.add('text-danger');
      } else {
        td.classList.remove('text-danger');
      }
    });
  }

  function run() {
    if (isHttp()) {
      loadPeopleFromServer().then(function () {
        applyHighlight();
      });
    } else {
      applyHighlight();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run);
  } else {
    run();
  }
})();
