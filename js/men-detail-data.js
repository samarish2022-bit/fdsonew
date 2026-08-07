/**
 * Детализация мужских турниров.
 * Требует: rating-lib.js + default-men-tournaments.js
 */
(function () {
  'use strict';
  if (!window.FDSORating) return;
  FDSORating.initDetailPage({
    storageKey: 'fdso_men_tournaments',
    defaultGlobal: 'FDSO_DEFAULT_MEN_TOURNAMENTS',
    theadDatesId: 'men-detail-thead-dates',
    tbodyId: 'men-detail-tbody',
    nameHeader: 'Фамилия Имя отчество'
  });
})();
