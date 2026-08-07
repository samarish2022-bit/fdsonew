/**
 * Детализация женских турниров.
 * Требует: rating-lib.js + default-women-tournaments.js
 */
(function () {
  'use strict';
  if (!window.FDSORating) return;
  FDSORating.initDetailPage({
    storageKey: 'fdso_women_tournaments',
    defaultGlobal: 'FDSO_DEFAULT_WOMEN_TOURNAMENTS',
    theadDatesId: 'women-detail-thead-dates',
    tbodyId: 'women-detail-tbody',
    nameHeader: 'Фамилия Имя отчество'
  });
})();
