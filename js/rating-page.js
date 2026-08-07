/**
 * rating.html — сводные таблицы всех видов рейтинга.
 * Требует: rating-lib.js + default-*-tournaments.js
 */
(function () {
  'use strict';
  if (!window.FDSORating) return;

  FDSORating.initSummaryPage([
    {
      storageKey: 'fdso_men_tournaments',
      defaultGlobal: 'FDSO_DEFAULT_MEN_TOURNAMENTS',
      panelSelector: '#men-panel'
    },
    {
      storageKey: 'fdso_women_tournaments',
      defaultGlobal: 'FDSO_DEFAULT_WOMEN_TOURNAMENTS',
      panelSelector: '#women-panel'
    },
    {
      storageKey: 'fdso_men_doubles_tournaments',
      defaultGlobal: 'FDSO_DEFAULT_MEN_DOUBLES_TOURNAMENTS',
      panelSelector: '#men-doubles-panel'
    },
    {
      storageKey: 'fdso_women_doubles_tournaments',
      defaultGlobal: 'FDSO_DEFAULT_WOMEN_DOUBLES_TOURNAMENTS',
      panelSelector: '#women-doubles-panel'
    }
  ]);
})();
