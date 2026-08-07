/**
 * Детализация мужских парных турниров.
 * Требует: rating-lib.js + default-men-doubles-tournaments.js
 */
(function () {
  'use strict';
  if (!window.FDSORating) return;
  FDSORating.initDetailPage({
    storageKey: 'fdso_men_doubles_tournaments',
    defaultGlobal: 'FDSO_DEFAULT_MEN_DOUBLES_TOURNAMENTS',
    theadDatesId: 'men-doubles-detail-thead-dates',
    tbodyId: 'men-doubles-detail-tbody',
    nameHeader: 'Пара'
  });
})();
