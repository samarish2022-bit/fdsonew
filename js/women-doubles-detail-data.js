/**
 * Детализация женских парных турниров.
 * Требует: rating-lib.js + default-women-doubles-tournaments.js
 */
(function () {
  'use strict';
  if (!window.FDSORating) return;
  FDSORating.initDetailPage({
    storageKey: 'fdso_women_doubles_tournaments',
    defaultGlobal: 'FDSO_DEFAULT_WOMEN_DOUBLES_TOURNAMENTS',
    theadDatesId: 'women-doubles-detail-thead-dates',
    tbodyId: 'women-doubles-detail-tbody',
    theadMoId: 'women-doubles-detail-thead-mo',
    nameHeader: 'Пара'
  });
})();
