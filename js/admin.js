/**
 * Панель администратора ФДСО
 * Авторизация по паролю, данные в localStorage.
 * Пароль по умолчанию: fdso2025 — измените в переменной ADMIN_PASSWORD ниже.
 */

(function () {
  'use strict';

  var ADMIN_SESSION_KEY = 'fdso_admin_session';
  var ADMIN_ACTIVE_TAB_KEY = 'fdso_admin_active_tab';
  var ADMIN_PASSWORD = 'fdso2025'; // Смените на свой пароль
  var KEY_NEWS = 'fdso_admin_news';
  var KEY_COMPETITIONS = 'fdso_admin_competitions';
  var KEY_PHOTOS = 'fdso_admin_photos';
  var KEY_DOCUMENTS = 'fdso_admin_documents';
  var KEY_FRIENDS = 'fdso_admin_friends';
  var KEY_MEN_TOURNAMENTS = 'fdso_men_tournaments';
  var KEY_WOMEN_TOURNAMENTS = 'fdso_women_tournaments';
  var KEY_MEN_DOUBLES_TOURNAMENTS = 'fdso_men_doubles_tournaments';
  var KEY_WOMEN_DOUBLES_TOURNAMENTS = 'fdso_women_doubles_tournaments';
  var KEY_PEOPLE = 'fdso_people';
  var MEN_TOURNAMENTS_DEFAULT_DATES = ['15.02.2025', '23.03.2025', '26.04.2025', '24.05.2025', '14.06.2025', '16.08.2025', '21.09.2025', '23.11.2025', '21.12.2025', '25.01.2026'];
  var WOMEN_TOURNAMENTS_DEFAULT_DATES = MEN_TOURNAMENTS_DEFAULT_DATES.slice();
  var MEN_DOUBLES_TOURNAMENTS_DEFAULT_DATES = MEN_TOURNAMENTS_DEFAULT_DATES.slice();
  var WOMEN_DOUBLES_TOURNAMENTS_DEFAULT_DATES = MEN_TOURNAMENTS_DEFAULT_DATES.slice();
  var MEN_TOURNAMENTS_CELLS_COUNT = 22; // 10*2 (M,O) + sum + sum75
  var menTournamentsHiddenDates = [];
  var menTournamentsResortTimeout = null;
  var womenTournamentsHiddenDates = [];
  var womenTournamentsResortTimeout = null;
  var menDoublesTournamentsHiddenDates = [];
  var menDoublesTournamentsResortTimeout = null;
  var womenDoublesTournamentsHiddenDates = [];
  var womenDoublesTournamentsResortTimeout = null;

  var pendingNewsImageDataUrl = null;
  var pendingNewsImageUrl = null;
  var pendingPhotoDataUrl = null;
  var pendingPhotoDataUrlFallback = null;
  var pendingPhotoDataUrls = [];
  var pendingDocumentDataUrl = null;
  var pendingDocumentMeta = null;
  var pendingEditNewsImageDataUrl = null;
  var pendingEditNewsImageUrl = null;
  var editNewsCurrentImageUrl = null;
  var editNewsImageCleared = false;
  var pendingCompetitionImageDataUrl = null;
  var pendingCompetitionImageUrl = null;
  var pendingEditCompetitionImageDataUrl = null;
  var pendingEditCompetitionImageUrl = null;
  var editCompetitionCurrentImageUrl = null;
  var editCompetitionImageCleared = false;
  var pendingEditDocumentDataUrl = null;
  var pendingEditDocumentMeta = null;
  var editDocumentCurrentUrl = null;
  var pendingFriendIconDataUrl = null;
  var pendingFriendIconUrl = null;
  var pendingEditFriendIconDataUrl = null;
  var pendingEditFriendIconUrl = null;
  var editFriendCurrentIconUrl = null;
  var editFriendIconCleared = false;

  /** Сжатие + путь и data URL (только для фотогалереи, без загрузки на сервер). */
  function saveImageToSite(file, maxWidth, quality) {
    maxWidth = maxWidth || 1200;
    quality = quality || 0.75;
    return compressImage(file, maxWidth, quality).then(function (dataUrl) {
      var name = 'img-' + Date.now() + '-' + Math.random().toString(36).slice(2, 9) + '.jpg';
      return { path: 'images/uploads/' + name, dataUrl: dataUrl };
    });
  }

  /** Загрузка изображения на сервер для новостей/соревнований/друзей. type: "news"|"competition"|"friend". Возвращает { url }. */
  function uploadImageToSite(file, type, maxWidth, quality) {
    maxWidth = maxWidth || 1200;
    quality = quality || 0.8;
    var origin = (typeof location !== 'undefined' && location.origin && (location.origin.startsWith('http://') || location.origin.startsWith('https://'))) ? location.origin : 'http://localhost:3000';
    return compressImage(file, maxWidth, quality).then(function (dataUrl) {
      return fetch(origin + '/api/upload-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: dataUrl, type: type })
      }).then(function (r) {
        if (!r.ok) return r.json().then(function (err) { throw new Error(err.error || r.statusText); });
        return r.json();
      });
    });
  }

  /**
   * Сжимает изображение и возвращает data URL (JPEG).
   * maxWidth — макс. ширина в px, quality — 0..1 для JPEG.
   */
  function compressImage(file, maxWidth, quality) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      var reader = new FileReader();
      reader.onload = function (e) {
        img.onload = function () {
          var w = img.width;
          var h = img.height;
          if (w > maxWidth) {
            h = Math.round((h * maxWidth) / w);
            w = maxWidth;
          }
          var canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          var ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          try {
            var dataUrl = canvas.toDataURL('image/jpeg', quality);
            resolve(dataUrl);
          } catch (err) {
            reject(err);
          }
        };
        img.onerror = function () { reject(new Error('Не удалось загрузить изображение')); };
        img.src = e.target.result;
      };
      reader.onerror = function () { reject(new Error('Не удалось прочитать файл')); };
      reader.readAsDataURL(file);
    });
  }

  function isAuthenticated() {
    return sessionStorage.getItem(ADMIN_SESSION_KEY) === '1';
  }

  function setAuthenticated(value) {
    if (value) {
      sessionStorage.setItem(ADMIN_SESSION_KEY, '1');
    } else {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
    }
  }

  function getNews() {
    try {
      var raw = localStorage.getItem(KEY_NEWS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function setNews(arr) {
    localStorage.setItem(KEY_NEWS, JSON.stringify(arr));
    saveNewsToSite(arr);
  }

  /** Только localStorage — при загрузке с сервера, без отправки на сервер */
  function setNewsOnlyLocal(arr) {
    localStorage.setItem(KEY_NEWS, JSON.stringify(Array.isArray(arr) ? arr : []));
  }

  function getCompetitions() {
    try {
      var raw = localStorage.getItem(KEY_COMPETITIONS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function setCompetitions(arr) {
    localStorage.setItem(KEY_COMPETITIONS, JSON.stringify(arr));
    saveCompetitionsToSite(arr);
  }

  function setCompetitionsOnlyLocal(arr) {
    localStorage.setItem(KEY_COMPETITIONS, JSON.stringify(Array.isArray(arr) ? arr : []));
  }

  function loadCompetitionsFromServer() {
    var origin = typeof location !== 'undefined' && location.origin && (location.origin.startsWith('http://') || location.origin.startsWith('https://'))
      ? location.origin
      : null;
    if (!origin) return Promise.resolve(null);
    return fetch(origin + '/api/competitions')
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (data) { return Array.isArray(data) ? data : []; })
      .catch(function () { return null; });
  }

  function saveCompetitionsToSite(arr) {
    var origin = typeof location !== 'undefined' && location.origin && (location.origin.startsWith('http://') || location.origin.startsWith('https://'))
      ? location.origin
      : 'http://localhost:3000';
    var payload = (Array.isArray(arr) ? arr : []).map(function (item) {
      var o = { id: item.id, title: item.title, text: item.text, date: item.date, status: item.status };
      if (item.imageUrl) o.imageUrl = item.imageUrl;
      return o;
    });
    fetch(origin + '/api/save-competitions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (r) {
        if (!r.ok) return r.json().then(function (err) { throw new Error(err.error || r.status); });
        return r.json();
      })
      .then(function () {})
      .catch(function (e) {
        console.warn('Не удалось сохранить соревнования на сервер:', e.message);
      });
  }

  /**
   * Загружает новости с сайта (GET /api/news). При открытии админки подставляет актуальный список с сервера.
   */
  function loadNewsFromServer() {
    var origin = typeof location !== 'undefined' && location.origin && (location.origin.startsWith('http://') || location.origin.startsWith('https://'))
      ? location.origin
      : null;
    if (!origin) return Promise.resolve(null);
    return fetch(origin + '/api/news')
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (data) { return Array.isArray(data) ? data : []; })
      .catch(function () { return null; });
  }

  /**
   * Сохраняет новости в файл на сайте (POST /api/save-news). Работает при запущенном сервере.
   * URL: с той же страницы (origin) или http://localhost:3000 при открытии по file://.
   */
  function saveNewsToSite(arr) {
    var origin = typeof location !== 'undefined' && location.origin && (location.origin.startsWith('http://') || location.origin.startsWith('https://'))
      ? location.origin
      : 'http://localhost:3000';
    var payload = (Array.isArray(arr) ? arr : []).map(function (item) {
      var o = { id: item.id, title: item.title, text: item.text, date: item.date };
      if (item.imageUrl) o.imageUrl = item.imageUrl;
      return o;
    });
    fetch(origin + '/api/save-news', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (r) {
        if (!r.ok) return r.json().then(function (err) { throw new Error(err.error || r.status); });
        return r.json();
      })
      .then(function () { /* сохранено */ })
      .catch(function (e) {
        console.warn('Не удалось сохранить новости на сервер:', e.message, '(откройте админку по адресу http://localhost:3000/admin.html)');
      });
  }

  function getPhotos() {
    try {
      var raw = localStorage.getItem(KEY_PHOTOS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function setPhotos(arr) {
    localStorage.setItem(KEY_PHOTOS, JSON.stringify(arr));
    savePhotosToSite(arr);
  }

  function setPhotosOnlyLocal(arr) {
    localStorage.setItem(KEY_PHOTOS, JSON.stringify(Array.isArray(arr) ? arr : []));
  }

  function loadPhotosFromServer() {
    var origin = typeof location !== 'undefined' && location.origin && (location.origin.startsWith('http://') || location.origin.startsWith('https://'))
      ? location.origin
      : null;
    if (!origin) return Promise.resolve(null);
    return fetch(origin + '/api/photos')
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (data) { return Array.isArray(data) ? data : []; })
      .catch(function () { return null; });
  }

  function savePhotosToSite(arr) {
    var origin = typeof location !== 'undefined' && location.origin && (location.origin.startsWith('http://') || location.origin.startsWith('https://'))
      ? location.origin
      : 'http://localhost:3000';
    var url = (origin && (origin.startsWith('http://') || origin.startsWith('https://')))
      ? '/api/save-photos'
      : 'http://localhost:3000/api/save-photos';
    var toSave = (Array.isArray(arr) ? arr : []).map(function (p) {
      return { id: p.id, url: p.url, thumbUrl: p.thumbUrl || undefined, caption: p.caption || '', competition: p.competition || '' };
    });
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toSave)
    })
      .then(function (r) {
        if (!r.ok) return r.json().catch(function () { return {}; }).then(function (err) { throw new Error(err.error || 'HTTP ' + r.status); });
        return r.json();
      })
      .catch(function (e) {
        console.warn('Не удалось сохранить фотографии на сервер:', e.message);
      });
  }

  function getDocuments() {
    try {
      var raw = localStorage.getItem(KEY_DOCUMENTS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function setDocuments(arr) {
    localStorage.setItem(KEY_DOCUMENTS, JSON.stringify(arr));
    saveDocumentsToSite(arr);
  }

  function setDocumentsOnlyLocal(arr) {
    localStorage.setItem(KEY_DOCUMENTS, JSON.stringify(Array.isArray(arr) ? arr : []));
  }

  function loadDocumentsFromServer() {
    var origin = typeof location !== 'undefined' && location.origin && (location.origin.startsWith('http://') || location.origin.startsWith('https://'))
      ? location.origin
      : null;
    if (!origin) return Promise.resolve(null);
    return fetch(origin + '/api/documents')
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (data) { return Array.isArray(data) ? data : []; })
      .catch(function () { return null; });
  }

  function saveDocumentsToSite(arr) {
    // При открытии с сервера — относительный URL (тот же хост и порт); с file:// — localhost
    var url = (typeof location !== 'undefined' && location.origin && (location.origin.startsWith('http://') || location.origin.startsWith('https://')))
      ? '/api/save-documents'
      : 'http://localhost:3000/api/save-documents';
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Array.isArray(arr) ? arr : [])
    })
      .then(function (r) {
        if (!r.ok) {
          return r.json().catch(function () { return {}; }).then(function (err) {
            throw new Error(err.error || err.message || 'HTTP ' + r.status);
          });
        }
        return r.json();
      })
      .then(function () {})
      .catch(function (e) {
        console.warn('Не удалось сохранить документы на сервер:', e.message);
        alert('Документы не записались в data/documents.json. Запустите сервер (npm start) и откройте админку по адресу http://localhost:3000/admin.html');
      });
  }

  function getFriends() {
    try {
      var raw = localStorage.getItem(KEY_FRIENDS);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function setFriends(arr) {
    localStorage.setItem(KEY_FRIENDS, JSON.stringify(Array.isArray(arr) ? arr : []));
    saveFriendsToSite(arr);
  }

  function setFriendsOnlyLocal(arr) {
    localStorage.setItem(KEY_FRIENDS, JSON.stringify(Array.isArray(arr) ? arr : []));
  }

  function loadFriendsFromServer() {
    var origin = typeof location !== 'undefined' && location.origin && (location.origin.startsWith('http://') || location.origin.startsWith('https://'))
      ? location.origin
      : null;
    if (!origin) return Promise.resolve(null);
    return fetch(origin + '/api/friends')
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (data) { return Array.isArray(data) ? data : []; })
      .catch(function () { return null; });
  }

  function saveFriendsToSite(arr) {
    var url = (typeof location !== 'undefined' && location.origin && (location.origin.startsWith('http://') || location.origin.startsWith('https://')))
      ? '/api/save-friends'
      : 'http://localhost:3000/api/save-friends';
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Array.isArray(arr) ? arr : [])
    })
      .then(function (r) {
        if (!r.ok) {
          return r.json().catch(function () { return {}; }).then(function (err) {
            throw new Error(err.error || err.message || 'HTTP ' + r.status);
          });
        }
        return r.json();
      })
      .then(function () {})
      .catch(function (e) {
        console.warn('Не удалось сохранить друзей на сервер:', e.message);
        alert('Данные не записались в data/friends.json. Запустите сервер (npm start) и откройте админку по адресу http://localhost:3000/admin.html');
      });
  }

  function getMenTournaments() {
    try {
      var raw = localStorage.getItem(KEY_MEN_TOURNAMENTS);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setMenTournaments(data) {
    if (data) {
      localStorage.setItem(KEY_MEN_TOURNAMENTS, JSON.stringify(data));
    } else {
      localStorage.removeItem(KEY_MEN_TOURNAMENTS);
    }
  }

  function getWomenTournaments() {
    try {
      var raw = localStorage.getItem(KEY_WOMEN_TOURNAMENTS);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setWomenTournaments(data) {
    if (data) {
      localStorage.setItem(KEY_WOMEN_TOURNAMENTS, JSON.stringify(data));
    } else {
      localStorage.removeItem(KEY_WOMEN_TOURNAMENTS);
    }
  }

  function getMenDoublesTournaments() {
    try {
      var raw = localStorage.getItem(KEY_MEN_DOUBLES_TOURNAMENTS);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setMenDoublesTournaments(data) {
    if (data) {
      localStorage.setItem(KEY_MEN_DOUBLES_TOURNAMENTS, JSON.stringify(data));
    } else {
      localStorage.removeItem(KEY_MEN_DOUBLES_TOURNAMENTS);
    }
  }

  function getWomenDoublesTournaments() {
    try {
      var raw = localStorage.getItem(KEY_WOMEN_DOUBLES_TOURNAMENTS);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function setWomenDoublesTournaments(data) {
    if (data) {
      localStorage.setItem(KEY_WOMEN_DOUBLES_TOURNAMENTS, JSON.stringify(data));
    } else {
      localStorage.removeItem(KEY_WOMEN_DOUBLES_TOURNAMENTS);
    }
  }

  function getPeople() {
    try {
      var raw = localStorage.getItem(KEY_PEOPLE);
      var data = raw ? JSON.parse(raw) : null;
      return (data && Array.isArray(data.list)) ? data.list : [];
    } catch (e) {
      return [];
    }
  }

  function setPeople(list) {
    var arr = (list && Array.isArray(list)) ? list : [];
    localStorage.setItem(KEY_PEOPLE, JSON.stringify({ list: arr }));
    savePeopleToSite(arr);
  }

  function setPeopleOnlyLocal(list) {
    var arr = (list && Array.isArray(list)) ? list : [];
    localStorage.setItem(KEY_PEOPLE, JSON.stringify({ list: arr }));
  }

  function loadPeopleFromServer() {
    var origin = typeof location !== 'undefined' && location.origin && (location.origin.startsWith('http://') || location.origin.startsWith('https://'))
      ? location.origin
      : null;
    if (!origin) return Promise.resolve(null);
    return fetch(origin + '/api/people')
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (data) { return Array.isArray(data) ? data : (data && Array.isArray(data.list) ? data.list : []); })
      .catch(function () { return null; });
  }

  function savePeopleToSite(list) {
    var origin = typeof location !== 'undefined' && location.origin && (location.origin.startsWith('http://') || location.origin.startsWith('https://'))
      ? location.origin
      : 'http://localhost:3000';
    var url = (origin && (origin.startsWith('http://') || origin.startsWith('https://')))
      ? '/api/save-people'
      : 'http://localhost:3000/api/save-people';
    var arr = (list && Array.isArray(list)) ? list : [];
    fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(arr)
    })
      .then(function (r) {
        if (!r.ok) return r.json().catch(function () { return {}; }).then(function (err) { throw new Error(err.error || 'HTTP ' + r.status); });
        return r.json();
      })
      .catch(function (e) {
        console.warn('Не удалось сохранить список «Люди» на сервер:', e.message);
      });
  }

  /** Собирает уникальные ФИО из всех рейтингов (localStorage + дефолты из JS). */
  function collectNamesFromRatings() {
    var seen = {};
    var names = [];
    function add(rows) {
      if (!rows || !rows.length) return;
      rows.forEach(function (row) {
        var n = (row.name || '').trim();
        if (n && !seen[n]) {
          seen[n] = true;
          names.push(n);
        }
      });
    }
    var menData = getMenTournamentsData();
    add(menData.rows);
    if (!menData.rows.length && typeof window.FDSO_DEFAULT_MEN_TOURNAMENTS !== 'undefined' && window.FDSO_DEFAULT_MEN_TOURNAMENTS.rows) {
      add(window.FDSO_DEFAULT_MEN_TOURNAMENTS.rows);
    }
    var womenData = getWomenTournamentsData();
    add(womenData.rows);
    if (!womenData.rows.length && typeof window.FDSO_DEFAULT_WOMEN_TOURNAMENTS !== 'undefined' && window.FDSO_DEFAULT_WOMEN_TOURNAMENTS.rows) {
      add(window.FDSO_DEFAULT_WOMEN_TOURNAMENTS.rows);
    }
    var menDoublesData = getMenDoublesTournamentsData();
    add(menDoublesData.rows);
    if (!menDoublesData.rows.length && typeof window.FDSO_DEFAULT_MEN_DOUBLES_TOURNAMENTS !== 'undefined' && window.FDSO_DEFAULT_MEN_DOUBLES_TOURNAMENTS.rows) {
      add(window.FDSO_DEFAULT_MEN_DOUBLES_TOURNAMENTS.rows);
    }
    var womenDoublesData = getWomenDoublesTournamentsData();
    add(womenDoublesData.rows);
    if (!womenDoublesData.rows.length && typeof window.FDSO_DEFAULT_WOMEN_DOUBLES_TOURNAMENTS !== 'undefined' && window.FDSO_DEFAULT_WOMEN_DOUBLES_TOURNAMENTS.rows) {
      add(window.FDSO_DEFAULT_WOMEN_DOUBLES_TOURNAMENTS.rows);
    }
    names.sort(function (a, b) { return a.localeCompare(b, 'ru'); });
    return names;
  }

  /** Объединяет текущий список людей с ФИО из рейтингов (новые — без повторов). */
  function mergePeopleWithRatings() {
    var ratingNames = collectNamesFromRatings();
    var existing = getPeople();
    var byName = {};
    existing.forEach(function (p) {
      var n = (p.name || '').trim();
      if (n) byName[n] = { name: n, birthDate: p.birthDate || '', feePaid: !!p.feePaid };
    });
    ratingNames.forEach(function (n) {
      if (!byName[n]) byName[n] = { name: n, birthDate: '', feePaid: false };
    });
    var list = Object.keys(byName).sort(function (a, b) { return a.localeCompare(b, 'ru'); }).map(function (k) { return byName[k]; });
    setPeople(list);
    return list;
  }

  function nextId(items) {
    var max = 0;
    items.forEach(function (item) {
      if (item.id > max) max = item.id;
    });
    return max + 1;
  }

  function formatDate(str) {
    if (!str) return '';
    var d = new Date(str);
    if (isNaN(d.getTime())) return str;
    var day = ('0' + d.getDate()).slice(-2);
    var month = ('0' + (d.getMonth() + 1)).slice(-2);
    var year = d.getFullYear();
    return day + '.' + month + '.' + year;
  }

  function showScreen(login) {
    var loginEl = document.getElementById('admin-login');
    var dashEl = document.getElementById('admin-dashboard');
    if (login) {
      if (loginEl) loginEl.style.display = 'block';
      if (dashEl) dashEl.style.display = 'none';
    } else {
      if (loginEl) loginEl.style.display = 'none';
      if (dashEl) dashEl.style.display = 'block';
      restoreAdminTab();
      renderNewsList();
      renderPhotosList();
      renderDocumentsList();
      initMenTournamentsOnce();
      initWomenTournamentsOnce();
      initMenDoublesTournamentsOnce();
      initWomenDoublesTournamentsOnce();
      initPeopleOnce();
    }
  }

  function getMenTournamentsData() {
    var data = getMenTournaments();
    if (data && data.dates && data.dates.length > 0) {
      return { dates: data.dates, rows: data.rows || [] };
    }
    return { dates: MEN_TOURNAMENTS_DEFAULT_DATES.slice(), rows: [] };
  }

  function getMenTournamentsCellCount(dates) {
    return (dates ? dates.length : 0) * 2 + 2;
  }

  function getWomenTournamentsData() {
    var data = getWomenTournaments();
    if (data && data.dates && data.dates.length > 0) {
      return { dates: data.dates, rows: data.rows || [] };
    }
    return { dates: WOMEN_TOURNAMENTS_DEFAULT_DATES.slice(), rows: [] };
  }

  function getWomenTournamentsCellCount(dates) {
    return (dates ? dates.length : 0) * 2 + 2;
  }

  function getMenDoublesTournamentsData() {
    var data = getMenDoublesTournaments();
    if (data && data.dates && data.dates.length > 0) {
      return { dates: data.dates, rows: data.rows || [] };
    }
    return { dates: MEN_DOUBLES_TOURNAMENTS_DEFAULT_DATES.slice(), rows: [] };
  }

  function getMenDoublesTournamentsCellCount(dates) {
    return (dates ? dates.length : 0) * 2 + 2;
  }

  function getWomenDoublesTournamentsData() {
    var data = getWomenDoublesTournaments();
    if (data && data.dates && data.dates.length > 0) {
      return { dates: data.dates, rows: data.rows || [] };
    }
    return { dates: WOMEN_DOUBLES_TOURNAMENTS_DEFAULT_DATES.slice(), rows: [] };
  }

  function getWomenDoublesTournamentsCellCount(dates) {
    return (dates ? dates.length : 0) * 2 + 2;
  }

  /** Сумма очков за вычетом двух наименьших (пустые = 0). */
  function sumExcludingTwoSmallest(pointValues) {
    var arr = (pointValues || []).map(function (v) { return parseInt(v, 10) || 0; });
    arr.sort(function (a, b) { return a - b; });
    if (arr.length > 2) arr = arr.slice(2);
    else arr = [];
    return arr.reduce(function (s, n) { return s + n; }, 0);
  }

  function renderMenTournamentsTable() {
    var data = getMenTournamentsData();
    var theadEl = document.getElementById('admin-men-tournaments-thead');
    var tbodyEl = document.getElementById('admin-men-tournaments-tbody');
    if (!theadEl || !tbodyEl) return;
    var dates = data.dates;
    var rows = data.rows;
    var cellCount = getMenTournamentsCellCount(dates);
    var dateCells = dates.map(function (d, i) {
      return '<th colspan="2" class="admin-date-col" data-date-idx="' + i + '"><span>' + escapeHtml(d) + '</span> <button type="button" class="btn btn-link btn-sm p-0 ms-1 admin-hide-date" data-date-idx="' + i + '" title="Скрыть столбец">Скрыть</button> <button type="button" class="btn btn-link btn-sm p-0 ms-1 admin-del-date" data-date-idx="' + i + '" title="Удалить столбец">×</button></th>';
    }).join('');
    var subHeaderCells = dates.map(function (d, i) {
      return '<th data-date-idx="' + i + '">М</th><th data-date-idx="' + i + '">О</th>';
    }).join('');
    theadEl.innerHTML =
      '<tr><th class="col-rank-input">Ре-нг</th><th class="col-name">ФИО</th>' +
      dateCells +
      '<th class="col-sum">Сумма</th><th class="col-sum">Сумма 75%</th><th style="width:3rem"></th></tr>' +
      '<tr><th></th><th></th>' +
      subHeaderCells +
      '<th></th><th></th><th></th></tr>';
    tbodyEl.innerHTML = '';
    var sortedRows = rows.slice().map(function (row) {
      var cells = row.cells || [];
      while (cells.length < cellCount) cells.push('');
      var points = [];
      for (var i = 1; i < cellCount - 2; i += 2) points.push(cells[i]);
      var sumVal = points.reduce(function (s, v) { return s + (parseInt(v, 10) || 0); }, 0);
      var sum75Val = sumExcludingTwoSmallest(points);
      cells[cellCount - 2] = sumVal;
      cells[cellCount - 1] = sum75Val;
      return { row: row, cells: cells, sum75: sum75Val };
    });
    sortedRows.sort(function (a, b) { return b.sum75 - a.sum75; });
    sortedRows.forEach(function (item, idx) {
      var row = item.row;
      var cells = item.cells;
      var originalIdx = rows.indexOf(row);
      row.rank = String(idx + 1);
      row.cells = cells;
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td><input type="text" class="form-control form-control-sm col-rank-input" value="' + escapeAttr(String(idx + 1)) + '" data-col="rank"></td>' +
        '<td><input type="text" class="form-control form-control-sm col-name-input" value="' + escapeAttr(row.name || '') + '" data-col="name"></td>' +
        cells.slice(0, cellCount).map(function (v, i) {
          var cls = i === cellCount - 2 ? ' form-control form-control-sm col-sum-input' : (i === cellCount - 1 ? ' form-control form-control-sm col-sum75-input' : '');
          var dateIdx = i < cellCount - 2 ? Math.floor(i / 2) : '';
          var dataDate = dateIdx !== '' ? ' data-date-idx="' + dateIdx + '"' : '';
          var readOnlyAttr = (i === cellCount - 2 || i === cellCount - 1) ? ' readonly title="Вычисляется автоматически"' : '';
          return '<td' + dataDate + '><input type="text" class="form-control form-control-sm' + cls + '" value="' + escapeAttr(String(v || '')) + '" data-col="' + i + '"' + readOnlyAttr + '></td>';
        }).join('') +
        '<td><button type="button" class="btn btn-outline-danger btn-sm btn-row-del admin-men-tournaments-del-row" data-idx="' + originalIdx + '">×</button></td>';
      tbodyEl.appendChild(tr);
      bindRowSumUpdate(tr, cellCount);
    });
    bindMenTournamentsDelRows();
    bindMenTournamentsDelDate();
    bindMenTournamentsHideDate();
    applyMenTournamentsHiddenColumns();
    updateMenTournamentsShowColsDropdown();
  }

  function renderWomenTournamentsTable() {
    var data = getWomenTournamentsData();
    var theadEl = document.getElementById('admin-women-tournaments-thead');
    var tbodyEl = document.getElementById('admin-women-tournaments-tbody');
    if (!theadEl || !tbodyEl) return;
    var dates = data.dates;
    var rows = data.rows;
    var cellCount = getWomenTournamentsCellCount(dates);
    var dateCells = dates.map(function (d, i) {
      return '<th colspan="2" class="admin-date-col" data-date-idx="' + i + '"><span>' + escapeHtml(d) + '</span> <button type="button" class="btn btn-link btn-sm p-0 ms-1 admin-hide-date" data-date-idx="' + i + '" title="Скрыть столбец">Скрыть</button> <button type="button" class="btn btn-link btn-sm p-0 ms-1 admin-del-date" data-date-idx="' + i + '" title="Удалить столбец">×</button></th>';
    }).join('');
    var subHeaderCells = dates.map(function (d, i) {
      return '<th data-date-idx="' + i + '">М</th><th data-date-idx="' + i + '">О</th>';
    }).join('');
    theadEl.innerHTML =
      '<tr><th class="col-rank-input">Ре-нг</th><th class="col-name">ФИО</th>' +
      dateCells +
      '<th class="col-sum">Сумма</th><th class="col-sum">Сумма 75%</th><th style="width:3rem"></th></tr>' +
      '<tr><th></th><th></th>' +
      subHeaderCells +
      '<th></th><th></th><th></th></tr>';
    tbodyEl.innerHTML = '';
    var sortedRows = rows.slice().map(function (row) {
      var cells = row.cells || [];
      while (cells.length < cellCount) cells.push('');
      var points = [];
      for (var i = 1; i < cellCount - 2; i += 2) points.push(cells[i]);
      var sumVal = points.reduce(function (s, v) { return s + (parseInt(v, 10) || 0); }, 0);
      var sum75Val = sumExcludingTwoSmallest(points);
      cells[cellCount - 2] = sumVal;
      cells[cellCount - 1] = sum75Val;
      return { row: row, cells: cells, sum75: sum75Val };
    });
    sortedRows.sort(function (a, b) { return b.sum75 - a.sum75; });
    sortedRows.forEach(function (item, idx) {
      var row = item.row;
      var cells = item.cells;
      var originalIdx = rows.indexOf(row);
      row.rank = String(idx + 1);
      row.cells = cells;
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td><input type="text" class="form-control form-control-sm col-rank-input" value="' + escapeAttr(String(idx + 1)) + '" data-col="rank"></td>' +
        '<td><input type="text" class="form-control form-control-sm col-name-input" value="' + escapeAttr(row.name || '') + '" data-col="name"></td>' +
        cells.slice(0, cellCount).map(function (v, i) {
          var cls = i === cellCount - 2 ? ' form-control form-control-sm col-sum-input' : (i === cellCount - 1 ? ' form-control form-control-sm col-sum75-input' : '');
          var dateIdx = i < cellCount - 2 ? Math.floor(i / 2) : '';
          var dataDate = dateIdx !== '' ? ' data-date-idx="' + dateIdx + '"' : '';
          var readOnlyAttr = (i === cellCount - 2 || i === cellCount - 1) ? ' readonly title="Вычисляется автоматически"' : '';
          return '<td' + dataDate + '><input type="text" class="form-control form-control-sm' + cls + '" value="' + escapeAttr(String(v || '')) + '" data-col="' + i + '"' + readOnlyAttr + '></td>';
        }).join('') +
        '<td><button type="button" class="btn btn-outline-danger btn-sm btn-row-del admin-women-tournaments-del-row" data-idx="' + originalIdx + '">×</button></td>';
      tbodyEl.appendChild(tr);
      bindRowSumUpdateWomen(tr, cellCount);
    });
    bindWomenTournamentsDelRows();
    bindWomenTournamentsDelDate();
    bindWomenTournamentsHideDate();
    applyWomenTournamentsHiddenColumns();
    updateWomenTournamentsShowColsDropdown();
  }

  function renderMenDoublesTournamentsTable() {
    var data = getMenDoublesTournamentsData();
    var theadEl = document.getElementById('admin-men-doubles-tournaments-thead');
    var tbodyEl = document.getElementById('admin-men-doubles-tournaments-tbody');
    if (!theadEl || !tbodyEl) return;
    var dates = data.dates;
    var rows = data.rows;
    var cellCount = getMenDoublesTournamentsCellCount(dates);
    var dateCells = dates.map(function (d, i) {
      return '<th colspan="2" class="admin-date-col" data-date-idx="' + i + '"><span>' + escapeHtml(d) + '</span> <button type="button" class="btn btn-link btn-sm p-0 ms-1 admin-hide-date" data-date-idx="' + i + '" title="Скрыть столбец">Скрыть</button> <button type="button" class="btn btn-link btn-sm p-0 ms-1 admin-del-date" data-date-idx="' + i + '" title="Удалить столбец">×</button></th>';
    }).join('');
    var subHeaderCells = dates.map(function (d, i) {
      return '<th data-date-idx="' + i + '">М</th><th data-date-idx="' + i + '">О</th>';
    }).join('');
    theadEl.innerHTML =
      '<tr><th class="col-rank-input">Ре-нг</th><th class="col-name">Пара</th>' +
      dateCells +
      '<th class="col-sum">Сумма</th><th class="col-sum">Сумма 75%</th><th style="width:3rem"></th></tr>' +
      '<tr><th></th><th></th>' +
      subHeaderCells +
      '<th></th><th></th><th></th></tr>';
    tbodyEl.innerHTML = '';
    var sortedRows = rows.slice().map(function (row) {
      var cells = row.cells || [];
      while (cells.length < cellCount) cells.push('');
      var points = [];
      for (var i = 1; i < cellCount - 2; i += 2) points.push(cells[i]);
      var sumVal = points.reduce(function (s, v) { return s + (parseInt(v, 10) || 0); }, 0);
      var sum75Val = sumExcludingTwoSmallest(points);
      cells[cellCount - 2] = sumVal;
      cells[cellCount - 1] = sum75Val;
      return { row: row, cells: cells, sum75: sum75Val };
    });
    sortedRows.sort(function (a, b) { return b.sum75 - a.sum75; });
    sortedRows.forEach(function (item, idx) {
      var row = item.row;
      var cells = item.cells;
      var originalIdx = rows.indexOf(row);
      row.rank = String(idx + 1);
      row.cells = cells;
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td><input type="text" class="form-control form-control-sm col-rank-input" value="' + escapeAttr(String(idx + 1)) + '" data-col="rank"></td>' +
        '<td><input type="text" class="form-control form-control-sm col-name-input" value="' + escapeAttr(row.name || '') + '" data-col="name"></td>' +
        cells.slice(0, cellCount).map(function (v, i) {
          var cls = i === cellCount - 2 ? ' form-control form-control-sm col-sum-input' : (i === cellCount - 1 ? ' form-control form-control-sm col-sum75-input' : '');
          var dateIdx = i < cellCount - 2 ? Math.floor(i / 2) : '';
          var dataDate = dateIdx !== '' ? ' data-date-idx="' + dateIdx + '"' : '';
          var readOnlyAttr = (i === cellCount - 2 || i === cellCount - 1) ? ' readonly title="Вычисляется автоматически"' : '';
          return '<td' + dataDate + '><input type="text" class="form-control form-control-sm' + cls + '" value="' + escapeAttr(String(v || '')) + '" data-col="' + i + '"' + readOnlyAttr + '></td>';
        }).join('') +
        '<td><button type="button" class="btn btn-outline-danger btn-sm btn-row-del admin-men-doubles-tournaments-del-row" data-idx="' + originalIdx + '">×</button></td>';
      tbodyEl.appendChild(tr);
      bindRowSumUpdateMenDoubles(tr, cellCount);
    });
    bindMenDoublesTournamentsDelRows();
    bindMenDoublesTournamentsDelDate();
    bindMenDoublesTournamentsHideDate();
    applyMenDoublesTournamentsHiddenColumns();
    updateMenDoublesTournamentsShowColsDropdown();
  }

  function renderWomenDoublesTournamentsTable() {
    var data = getWomenDoublesTournamentsData();
    var theadEl = document.getElementById('admin-women-doubles-tournaments-thead');
    var tbodyEl = document.getElementById('admin-women-doubles-tournaments-tbody');
    if (!theadEl || !tbodyEl) return;
    var dates = data.dates;
    var rows = data.rows;
    var cellCount = getWomenDoublesTournamentsCellCount(dates);
    var dateCells = dates.map(function (d, i) {
      return '<th colspan="2" class="admin-date-col" data-date-idx="' + i + '"><span>' + escapeHtml(d) + '</span> <button type="button" class="btn btn-link btn-sm p-0 ms-1 admin-hide-date" data-date-idx="' + i + '" title="Скрыть столбец">Скрыть</button> <button type="button" class="btn btn-link btn-sm p-0 ms-1 admin-del-date" data-date-idx="' + i + '" title="Удалить столбец">×</button></th>';
    }).join('');
    var subHeaderCells = dates.map(function (d, i) {
      return '<th data-date-idx="' + i + '">М</th><th data-date-idx="' + i + '">О</th>';
    }).join('');
    theadEl.innerHTML =
      '<tr><th class="col-rank-input">Ре-нг</th><th class="col-name">Пара</th>' +
      dateCells +
      '<th class="col-sum">Сумма</th><th class="col-sum">Сумма 75%</th><th style="width:3rem"></th></tr>' +
      '<tr><th></th><th></th>' +
      subHeaderCells +
      '<th></th><th></th><th></th></tr>';
    tbodyEl.innerHTML = '';
    var sortedRows = rows.slice().map(function (row) {
      var cells = row.cells || [];
      while (cells.length < cellCount) cells.push('');
      var points = [];
      for (var i = 1; i < cellCount - 2; i += 2) points.push(cells[i]);
      var sumVal = points.reduce(function (s, v) { return s + (parseInt(v, 10) || 0); }, 0);
      var sum75Val = sumExcludingTwoSmallest(points);
      cells[cellCount - 2] = sumVal;
      cells[cellCount - 1] = sum75Val;
      return { row: row, cells: cells, sum75: sum75Val };
    });
    sortedRows.sort(function (a, b) { return b.sum75 - a.sum75; });
    sortedRows.forEach(function (item, idx) {
      var row = item.row;
      var cells = item.cells;
      var originalIdx = rows.indexOf(row);
      row.rank = String(idx + 1);
      row.cells = cells;
      var tr = document.createElement('tr');
      tr.innerHTML =
        '<td><input type="text" class="form-control form-control-sm col-rank-input" value="' + escapeAttr(String(idx + 1)) + '" data-col="rank"></td>' +
        '<td><input type="text" class="form-control form-control-sm col-name-input" value="' + escapeAttr(row.name || '') + '" data-col="name"></td>' +
        cells.slice(0, cellCount).map(function (v, i) {
          var cls = i === cellCount - 2 ? ' form-control form-control-sm col-sum-input' : (i === cellCount - 1 ? ' form-control form-control-sm col-sum75-input' : '');
          var dateIdx = i < cellCount - 2 ? Math.floor(i / 2) : '';
          var dataDate = dateIdx !== '' ? ' data-date-idx="' + dateIdx + '"' : '';
          var readOnlyAttr = (i === cellCount - 2 || i === cellCount - 1) ? ' readonly title="Вычисляется автоматически"' : '';
          return '<td' + dataDate + '><input type="text" class="form-control form-control-sm' + cls + '" value="' + escapeAttr(String(v || '')) + '" data-col="' + i + '"' + readOnlyAttr + '></td>';
        }).join('') +
        '<td><button type="button" class="btn btn-outline-danger btn-sm btn-row-del admin-women-doubles-tournaments-del-row" data-idx="' + originalIdx + '">×</button></td>';
      tbodyEl.appendChild(tr);
      bindRowSumUpdateWomenDoubles(tr, cellCount);
    });
    bindWomenDoublesTournamentsDelRows();
    bindWomenDoublesTournamentsDelDate();
    bindWomenDoublesTournamentsHideDate();
    applyWomenDoublesTournamentsHiddenColumns();
    updateWomenDoublesTournamentsShowColsDropdown();
  }

  function applyMenTournamentsHiddenColumns() {
    var data = getMenTournamentsData();
    var numDates = (data.dates && data.dates.length) || 0;
    menTournamentsHiddenDates = menTournamentsHiddenDates.filter(function (idx) { return idx >= 0 && idx < numDates; });
    menTournamentsHiddenDates.forEach(function (idx) {
      document.querySelectorAll('#admin-men-tournaments-table [data-date-idx="' + idx + '"]').forEach(function (el) {
        el.classList.add('admin-col-hidden');
      });
    });
  }

  function updateMenTournamentsShowColsDropdown() {
    var wrap = document.getElementById('men-tournaments-show-cols-wrap');
    var btn = document.getElementById('men-tournaments-show-cols-btn');
    var list = document.getElementById('men-tournaments-show-cols-list');
    if (!wrap || !list) return;
    if (menTournamentsHiddenDates.length === 0) {
      wrap.style.display = 'none';
      return;
    }
    var data = getMenTournamentsData();
    var dates = data.dates || [];
    list.innerHTML =
      '<li><button type="button" class="dropdown-item admin-show-all" href="#">Показать все</button></li>' +
      '<li><hr class="dropdown-divider"></li>' +
      menTournamentsHiddenDates.map(function (idx) {
        var label = dates[idx] != null ? escapeHtml(dates[idx]) : 'Дата ' + (idx + 1);
        return '<li><button type="button" class="dropdown-item admin-show-date" data-date-idx="' + idx + '">' + label + ' — показать</button></li>';
      }).join('');
    if (btn) btn.textContent = 'Показать столбцы (' + menTournamentsHiddenDates.length + ')';
    wrap.style.display = 'inline-block';
    var showAllBtn = list.querySelector('.admin-show-all');
    if (showAllBtn) {
      showAllBtn.addEventListener('click', function () {
        menTournamentsHiddenDates.forEach(function (idx) {
          document.querySelectorAll('#admin-men-tournaments-table [data-date-idx="' + idx + '"]').forEach(function (el) {
            el.classList.remove('admin-col-hidden');
          });
        });
        menTournamentsHiddenDates = [];
        updateMenTournamentsShowColsDropdown();
      });
    }
    document.querySelectorAll('.admin-show-date').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-date-idx'), 10);
        if (isNaN(idx)) return;
        menTournamentsHiddenDates = menTournamentsHiddenDates.filter(function (i) { return i !== idx; });
        document.querySelectorAll('#admin-men-tournaments-table [data-date-idx="' + idx + '"]').forEach(function (el) {
          el.classList.remove('admin-col-hidden');
        });
        updateMenTournamentsShowColsDropdown();
      });
    });
  }

  function applyWomenTournamentsHiddenColumns() {
    var data = getWomenTournamentsData();
    var numDates = (data.dates && data.dates.length) || 0;
    womenTournamentsHiddenDates = womenTournamentsHiddenDates.filter(function (idx) { return idx >= 0 && idx < numDates; });
    womenTournamentsHiddenDates.forEach(function (idx) {
      document.querySelectorAll('#admin-women-tournaments-table [data-date-idx="' + idx + '"]').forEach(function (el) {
        el.classList.add('admin-col-hidden');
      });
    });
  }

  function updateWomenTournamentsShowColsDropdown() {
    var wrap = document.getElementById('women-tournaments-show-cols-wrap');
    var btn = document.getElementById('women-tournaments-show-cols-btn');
    var list = document.getElementById('women-tournaments-show-cols-list');
    if (!wrap || !list) return;
    if (womenTournamentsHiddenDates.length === 0) {
      wrap.style.display = 'none';
      return;
    }
    var data = getWomenTournamentsData();
    var dates = data.dates || [];
    list.innerHTML =
      '<li><button type="button" class="dropdown-item admin-show-all-women" href="#">Показать все</button></li>' +
      '<li><hr class="dropdown-divider"></li>' +
      womenTournamentsHiddenDates.map(function (idx) {
        var label = dates[idx] != null ? escapeHtml(dates[idx]) : 'Дата ' + (idx + 1);
        return '<li><button type="button" class="dropdown-item admin-show-date-women" data-date-idx="' + idx + '">' + label + ' — показать</button></li>';
      }).join('');
    if (btn) btn.textContent = 'Показать столбцы (' + womenTournamentsHiddenDates.length + ')';
    wrap.style.display = 'inline-block';
    var showAllBtn = list.querySelector('.admin-show-all-women');
    if (showAllBtn) {
      showAllBtn.addEventListener('click', function () {
        womenTournamentsHiddenDates.forEach(function (idx) {
          document.querySelectorAll('#admin-women-tournaments-table [data-date-idx="' + idx + '"]').forEach(function (el) {
            el.classList.remove('admin-col-hidden');
          });
        });
        womenTournamentsHiddenDates = [];
        updateWomenTournamentsShowColsDropdown();
      });
    }
    document.querySelectorAll('.admin-show-date-women').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-date-idx'), 10);
        if (isNaN(idx)) return;
        womenTournamentsHiddenDates = womenTournamentsHiddenDates.filter(function (i) { return i !== idx; });
        document.querySelectorAll('#admin-women-tournaments-table [data-date-idx="' + idx + '"]').forEach(function (el) {
          el.classList.remove('admin-col-hidden');
        });
        updateWomenTournamentsShowColsDropdown();
      });
    });
  }

  function bindMenTournamentsHideDate() {
    document.querySelectorAll('.admin-hide-date').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var idx = parseInt(btn.getAttribute('data-date-idx'), 10);
        if (isNaN(idx) || idx < 0) return;
        if (menTournamentsHiddenDates.indexOf(idx) !== -1) return;
        menTournamentsHiddenDates.push(idx);
        menTournamentsHiddenDates.sort(function (a, b) { return a - b; });
        document.querySelectorAll('#admin-men-tournaments-table [data-date-idx="' + idx + '"]').forEach(function (el) {
          el.classList.add('admin-col-hidden');
        });
        updateMenTournamentsShowColsDropdown();
      });
    });
  }

  function applyMenDoublesTournamentsHiddenColumns() {
    var data = getMenDoublesTournamentsData();
    var numDates = (data.dates && data.dates.length) || 0;
    menDoublesTournamentsHiddenDates = menDoublesTournamentsHiddenDates.filter(function (idx) { return idx >= 0 && idx < numDates; });
    menDoublesTournamentsHiddenDates.forEach(function (idx) {
      document.querySelectorAll('#admin-men-doubles-tournaments-table [data-date-idx="' + idx + '"]').forEach(function (el) {
        el.classList.add('admin-col-hidden');
      });
    });
  }

  function updateMenDoublesTournamentsShowColsDropdown() {
    var wrap = document.getElementById('men-doubles-tournaments-show-cols-wrap');
    var btn = document.getElementById('men-doubles-tournaments-show-cols-btn');
    var list = document.getElementById('men-doubles-tournaments-show-cols-list');
    if (!wrap || !list) return;
    if (menDoublesTournamentsHiddenDates.length === 0) {
      wrap.style.display = 'none';
      return;
    }
    var data = getMenDoublesTournamentsData();
    var dates = data.dates || [];
    list.innerHTML =
      '<li><button type="button" class="dropdown-item admin-show-all-men-doubles" href="#">Показать все</button></li>' +
      '<li><hr class="dropdown-divider"></li>' +
      menDoublesTournamentsHiddenDates.map(function (idx) {
        var label = dates[idx] != null ? escapeHtml(dates[idx]) : 'Дата ' + (idx + 1);
        return '<li><button type="button" class="dropdown-item admin-show-date-men-doubles" data-date-idx="' + idx + '">' + label + ' — показать</button></li>';
      }).join('');
    if (btn) btn.textContent = 'Показать столбцы (' + menDoublesTournamentsHiddenDates.length + ')';
    wrap.style.display = 'inline-block';
    var showAllBtn = list.querySelector('.admin-show-all-men-doubles');
    if (showAllBtn) {
      showAllBtn.addEventListener('click', function () {
        menDoublesTournamentsHiddenDates.forEach(function (idx) {
          document.querySelectorAll('#admin-men-doubles-tournaments-table [data-date-idx="' + idx + '"]').forEach(function (el) {
            el.classList.remove('admin-col-hidden');
          });
        });
        menDoublesTournamentsHiddenDates = [];
        updateMenDoublesTournamentsShowColsDropdown();
      });
    }
    document.querySelectorAll('.admin-show-date-men-doubles').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-date-idx'), 10);
        if (isNaN(idx)) return;
        menDoublesTournamentsHiddenDates = menDoublesTournamentsHiddenDates.filter(function (i) { return i !== idx; });
        document.querySelectorAll('#admin-men-doubles-tournaments-table [data-date-idx="' + idx + '"]').forEach(function (el) {
          el.classList.remove('admin-col-hidden');
        });
        updateMenDoublesTournamentsShowColsDropdown();
      });
    });
  }

  function bindMenDoublesTournamentsHideDate() {
    document.querySelectorAll('#admin-men-doubles-tournaments-table .admin-hide-date').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var idx = parseInt(btn.getAttribute('data-date-idx'), 10);
        if (isNaN(idx) || idx < 0) return;
        if (menDoublesTournamentsHiddenDates.indexOf(idx) !== -1) return;
        menDoublesTournamentsHiddenDates.push(idx);
        menDoublesTournamentsHiddenDates.sort(function (a, b) { return a - b; });
        document.querySelectorAll('#admin-men-doubles-tournaments-table [data-date-idx="' + idx + '"]').forEach(function (el) {
          el.classList.add('admin-col-hidden');
        });
        updateMenDoublesTournamentsShowColsDropdown();
      });
    });
  }

  function applyWomenDoublesTournamentsHiddenColumns() {
    var data = getWomenDoublesTournamentsData();
    var numDates = (data.dates && data.dates.length) || 0;
    womenDoublesTournamentsHiddenDates = womenDoublesTournamentsHiddenDates.filter(function (idx) { return idx >= 0 && idx < numDates; });
    womenDoublesTournamentsHiddenDates.forEach(function (idx) {
      document.querySelectorAll('#admin-women-doubles-tournaments-table [data-date-idx="' + idx + '"]').forEach(function (el) {
        el.classList.add('admin-col-hidden');
      });
    });
  }

  function updateWomenDoublesTournamentsShowColsDropdown() {
    var wrap = document.getElementById('women-doubles-tournaments-show-cols-wrap');
    var btn = document.getElementById('women-doubles-tournaments-show-cols-btn');
    var list = document.getElementById('women-doubles-tournaments-show-cols-list');
    if (!wrap || !list) return;
    if (womenDoublesTournamentsHiddenDates.length === 0) {
      wrap.style.display = 'none';
      return;
    }
    var data = getWomenDoublesTournamentsData();
    var dates = data.dates || [];
    list.innerHTML =
      '<li><button type="button" class="dropdown-item admin-show-all-women-doubles" href="#">Показать все</button></li>' +
      '<li><hr class="dropdown-divider"></li>' +
      womenDoublesTournamentsHiddenDates.map(function (idx) {
        var label = dates[idx] != null ? escapeHtml(dates[idx]) : 'Дата ' + (idx + 1);
        return '<li><button type="button" class="dropdown-item admin-show-date-women-doubles" data-date-idx="' + idx + '">' + label + ' — показать</button></li>';
      }).join('');
    if (btn) btn.textContent = 'Показать столбцы (' + womenDoublesTournamentsHiddenDates.length + ')';
    wrap.style.display = 'inline-block';
    var showAllBtn = list.querySelector('.admin-show-all-women-doubles');
    if (showAllBtn) {
      showAllBtn.addEventListener('click', function () {
        womenDoublesTournamentsHiddenDates.forEach(function (idx) {
          document.querySelectorAll('#admin-women-doubles-tournaments-table [data-date-idx="' + idx + '"]').forEach(function (el) {
            el.classList.remove('admin-col-hidden');
          });
        });
        womenDoublesTournamentsHiddenDates = [];
        updateWomenDoublesTournamentsShowColsDropdown();
      });
    }
    document.querySelectorAll('.admin-show-date-women-doubles').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var idx = parseInt(btn.getAttribute('data-date-idx'), 10);
        if (isNaN(idx)) return;
        womenDoublesTournamentsHiddenDates = womenDoublesTournamentsHiddenDates.filter(function (i) { return i !== idx; });
        document.querySelectorAll('#admin-women-doubles-tournaments-table [data-date-idx="' + idx + '"]').forEach(function (el) {
          el.classList.remove('admin-col-hidden');
        });
        updateWomenDoublesTournamentsShowColsDropdown();
      });
    });
  }

  function bindWomenDoublesTournamentsHideDate() {
    document.querySelectorAll('#admin-women-doubles-tournaments-table .admin-hide-date').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var idx = parseInt(btn.getAttribute('data-date-idx'), 10);
        if (isNaN(idx) || idx < 0) return;
        if (womenDoublesTournamentsHiddenDates.indexOf(idx) !== -1) return;
        womenDoublesTournamentsHiddenDates.push(idx);
        womenDoublesTournamentsHiddenDates.sort(function (a, b) { return a - b; });
        document.querySelectorAll('#admin-women-doubles-tournaments-table [data-date-idx="' + idx + '"]').forEach(function (el) {
          el.classList.add('admin-col-hidden');
        });
        updateWomenDoublesTournamentsShowColsDropdown();
      });
    });
  }

  function bindWomenTournamentsHideDate() {
    document.querySelectorAll('#admin-women-tournaments-table .admin-hide-date').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var idx = parseInt(btn.getAttribute('data-date-idx'), 10);
        if (isNaN(idx) || idx < 0) return;
        if (womenTournamentsHiddenDates.indexOf(idx) !== -1) return;
        womenTournamentsHiddenDates.push(idx);
        womenTournamentsHiddenDates.sort(function (a, b) { return a - b; });
        document.querySelectorAll('#admin-women-tournaments-table [data-date-idx="' + idx + '"]').forEach(function (el) {
          el.classList.add('admin-col-hidden');
        });
        updateWomenTournamentsShowColsDropdown();
      });
    });
  }

  function updateRowSum(tr, cellCount) {
    var inputs = tr.querySelectorAll('input[data-col]');
    var byCol = {};
    inputs.forEach(function (inp) {
      var col = inp.getAttribute('data-col');
      if (col !== 'rank' && col !== 'name') byCol[parseInt(col, 10)] = inp;
    });
    var points = [];
    for (var i = 1; i < cellCount - 2; i += 2) {
      var inp = byCol[i];
      points.push(inp ? inp.value : '');
    }
    var sum = points.reduce(function (s, v) { return s + (parseInt(v, 10) || 0); }, 0);
    var sum75 = sumExcludingTwoSmallest(points);
    var sumInp = byCol[cellCount - 2];
    if (sumInp) sumInp.value = sum;
    var sum75Inp = byCol[cellCount - 1];
    if (sum75Inp) sum75Inp.value = sum75;
    scheduleMenTournamentsResort();
  }

  function updateRowSumWomen(tr, cellCount) {
    var inputs = tr.querySelectorAll('input[data-col]');
    var byCol = {};
    inputs.forEach(function (inp) {
      var col = inp.getAttribute('data-col');
      if (col !== 'rank' && col !== 'name') byCol[parseInt(col, 10)] = inp;
    });
    var points = [];
    for (var i = 1; i < cellCount - 2; i += 2) {
      var inp = byCol[i];
      points.push(inp ? inp.value : '');
    }
    var sum = points.reduce(function (s, v) { return s + (parseInt(v, 10) || 0); }, 0);
    var sum75 = sumExcludingTwoSmallest(points);
    var sumInp = byCol[cellCount - 2];
    if (sumInp) sumInp.value = sum;
    var sum75Inp = byCol[cellCount - 1];
    if (sum75Inp) sum75Inp.value = sum75;
    scheduleWomenTournamentsResort();
  }

  function updateRowSumMenDoubles(tr, cellCount) {
    var inputs = tr.querySelectorAll('input[data-col]');
    var byCol = {};
    inputs.forEach(function (inp) {
      var col = inp.getAttribute('data-col');
      if (col !== 'rank' && col !== 'name') byCol[parseInt(col, 10)] = inp;
    });
    var points = [];
    for (var i = 1; i < cellCount - 2; i += 2) {
      var inp = byCol[i];
      points.push(inp ? inp.value : '');
    }
    var sum = points.reduce(function (s, v) { return s + (parseInt(v, 10) || 0); }, 0);
    var sum75 = sumExcludingTwoSmallest(points);
    var sumInp = byCol[cellCount - 2];
    if (sumInp) sumInp.value = sum;
    var sum75Inp = byCol[cellCount - 1];
    if (sum75Inp) sum75Inp.value = sum75;
    scheduleMenDoublesTournamentsResort();
  }

  function updateRowSumWomenDoubles(tr, cellCount) {
    var inputs = tr.querySelectorAll('input[data-col]');
    var byCol = {};
    inputs.forEach(function (inp) {
      var col = inp.getAttribute('data-col');
      if (col !== 'rank' && col !== 'name') byCol[parseInt(col, 10)] = inp;
    });
    var points = [];
    for (var i = 1; i < cellCount - 2; i += 2) {
      var inp = byCol[i];
      points.push(inp ? inp.value : '');
    }
    var sum = points.reduce(function (s, v) { return s + (parseInt(v, 10) || 0); }, 0);
    var sum75 = sumExcludingTwoSmallest(points);
    var sumInp = byCol[cellCount - 2];
    if (sumInp) sumInp.value = sum;
    var sum75Inp = byCol[cellCount - 1];
    if (sum75Inp) sum75Inp.value = sum75;
    scheduleWomenDoublesTournamentsResort();
  }

  function scheduleMenTournamentsResort() {
    if (menTournamentsResortTimeout) clearTimeout(menTournamentsResortTimeout);
    menTournamentsResortTimeout = setTimeout(function () {
      menTournamentsResortTimeout = null;
      var data = collectMenTournamentsFromTable();
      if (data && data.rows && data.rows.length) {
        setMenTournaments(data);
        renderMenTournamentsTable();
      }
    }, 400);
  }

  function scheduleWomenTournamentsResort() {
    if (womenTournamentsResortTimeout) clearTimeout(womenTournamentsResortTimeout);
    womenTournamentsResortTimeout = setTimeout(function () {
      womenTournamentsResortTimeout = null;
      var data = collectWomenTournamentsFromTable();
      if (data && data.rows && data.rows.length) {
        setWomenTournaments(data);
        renderWomenTournamentsTable();
      }
    }, 400);
  }

  function scheduleMenDoublesTournamentsResort() {
    if (menDoublesTournamentsResortTimeout) clearTimeout(menDoublesTournamentsResortTimeout);
    menDoublesTournamentsResortTimeout = setTimeout(function () {
      menDoublesTournamentsResortTimeout = null;
      var data = collectMenDoublesTournamentsFromTable();
      if (data && data.rows && data.rows.length) {
        setMenDoublesTournaments(data);
        renderMenDoublesTournamentsTable();
      }
    }, 400);
  }

  function scheduleWomenDoublesTournamentsResort() {
    if (womenDoublesTournamentsResortTimeout) clearTimeout(womenDoublesTournamentsResortTimeout);
    womenDoublesTournamentsResortTimeout = setTimeout(function () {
      womenDoublesTournamentsResortTimeout = null;
      var data = collectWomenDoublesTournamentsFromTable();
      if (data && data.rows && data.rows.length) {
        setWomenDoublesTournaments(data);
        renderWomenDoublesTournamentsTable();
      }
    }, 400);
  }

  function bindRowSumUpdate(tr, cellCount) {
    tr.querySelectorAll('input[data-col]').forEach(function (inp) {
      var col = inp.getAttribute('data-col');
      if (col === 'rank' || col === 'name') return;
      var num = parseInt(col, 10);
      if (isNaN(num)) return;
      if (num === cellCount - 2) {
        inp.addEventListener('input', function () {
          var points = [];
          for (var i = 1; i < cellCount - 2; i += 2) {
            var oInp = tr.querySelector('input[data-col="' + i + '"]');
            points.push(oInp ? oInp.value : '');
          }
          var sum75Inp = tr.querySelector('input[data-col="' + (cellCount - 1) + '"]');
          if (sum75Inp) sum75Inp.value = sumExcludingTwoSmallest(points);
          scheduleMenTournamentsResort();
        });
        return;
      }
      if (num === cellCount - 1) {
        inp.addEventListener('input', function () { scheduleMenTournamentsResort(); });
        return;
      }
      inp.addEventListener('input', function () { updateRowSum(tr, cellCount); });
    });
  }

  function bindRowSumUpdateWomen(tr, cellCount) {
    tr.querySelectorAll('input[data-col]').forEach(function (inp) {
      var col = inp.getAttribute('data-col');
      if (col === 'rank' || col === 'name') return;
      var num = parseInt(col, 10);
      if (isNaN(num)) return;
      if (num === cellCount - 2) {
        inp.addEventListener('input', function () {
          var points = [];
          for (var i = 1; i < cellCount - 2; i += 2) {
            var oInp = tr.querySelector('input[data-col="' + i + '"]');
            points.push(oInp ? oInp.value : '');
          }
          var sum75Inp = tr.querySelector('input[data-col="' + (cellCount - 1) + '"]');
          if (sum75Inp) sum75Inp.value = sumExcludingTwoSmallest(points);
          scheduleWomenTournamentsResort();
        });
        return;
      }
      if (num === cellCount - 1) {
        inp.addEventListener('input', function () { scheduleWomenTournamentsResort(); });
        return;
      }
      inp.addEventListener('input', function () { updateRowSumWomen(tr, cellCount); });
    });
  }

  function bindRowSumUpdateMenDoubles(tr, cellCount) {
    tr.querySelectorAll('input[data-col]').forEach(function (inp) {
      var col = inp.getAttribute('data-col');
      if (col === 'rank' || col === 'name') return;
      var num = parseInt(col, 10);
      if (isNaN(num)) return;
      if (num === cellCount - 2) {
        inp.addEventListener('input', function () {
          var points = [];
          for (var i = 1; i < cellCount - 2; i += 2) {
            var oInp = tr.querySelector('input[data-col="' + i + '"]');
            points.push(oInp ? oInp.value : '');
          }
          var sum75Inp = tr.querySelector('input[data-col="' + (cellCount - 1) + '"]');
          if (sum75Inp) sum75Inp.value = sumExcludingTwoSmallest(points);
          scheduleMenDoublesTournamentsResort();
        });
        return;
      }
      if (num === cellCount - 1) {
        inp.addEventListener('input', function () { scheduleMenDoublesTournamentsResort(); });
        return;
      }
      inp.addEventListener('input', function () { updateRowSumMenDoubles(tr, cellCount); });
    });
  }

  function bindRowSumUpdateWomenDoubles(tr, cellCount) {
    tr.querySelectorAll('input[data-col]').forEach(function (inp) {
      var col = inp.getAttribute('data-col');
      if (col === 'rank' || col === 'name') return;
      var num = parseInt(col, 10);
      if (isNaN(num)) return;
      if (num === cellCount - 2) {
        inp.addEventListener('input', function () {
          var points = [];
          for (var i = 1; i < cellCount - 2; i += 2) {
            var oInp = tr.querySelector('input[data-col="' + i + '"]');
            points.push(oInp ? oInp.value : '');
          }
          var sum75Inp = tr.querySelector('input[data-col="' + (cellCount - 1) + '"]');
          if (sum75Inp) sum75Inp.value = sumExcludingTwoSmallest(points);
          scheduleWomenDoublesTournamentsResort();
        });
        return;
      }
      if (num === cellCount - 1) {
        inp.addEventListener('input', function () { scheduleWomenDoublesTournamentsResort(); });
        return;
      }
      inp.addEventListener('input', function () { updateRowSumWomenDoubles(tr, cellCount); });
    });
  }

  function bindMenTournamentsDelDate() {
    document.querySelectorAll('.admin-del-date').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var idx = parseInt(btn.getAttribute('data-date-idx'), 10);
        if (isNaN(idx) || idx < 0) return;
        var data = getMenTournamentsData();
        if (data.dates.length <= 1) {
          alert('Должна остаться хотя бы одна дата турнира.');
          return;
        }
        data.dates.splice(idx, 1);
        data.rows.forEach(function (row) {
          var cells = row.cells || [];
          var start = idx * 2;
          if (cells.length > start + 1) cells.splice(start, 2);
          row.cells = cells;
        });
        menTournamentsHiddenDates = menTournamentsHiddenDates.filter(function (i) { return i !== idx; }).map(function (i) { return i > idx ? i - 1 : i; });
        setMenTournaments(data);
        renderMenTournamentsTable();
      });
    });
  }

  function bindWomenTournamentsDelDate() {
    document.querySelectorAll('#admin-women-tournaments-table .admin-del-date').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var idx = parseInt(btn.getAttribute('data-date-idx'), 10);
        if (isNaN(idx) || idx < 0) return;
        var data = getWomenTournamentsData();
        if (data.dates.length <= 1) {
          alert('Должна остаться хотя бы одна дата турнира.');
          return;
        }
        data.dates.splice(idx, 1);
        data.rows.forEach(function (row) {
          var cells = row.cells || [];
          var start = idx * 2;
          if (cells.length > start + 1) cells.splice(start, 2);
          row.cells = cells;
        });
        womenTournamentsHiddenDates = womenTournamentsHiddenDates.filter(function (i) { return i !== idx; }).map(function (i) { return i > idx ? i - 1 : i; });
        setWomenTournaments(data);
        renderWomenTournamentsTable();
      });
    });
  }

  function bindMenTournamentsDelRows() {
    document.querySelectorAll('.admin-men-tournaments-del-row').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var data = getMenTournamentsData();
        var idx = parseInt(btn.getAttribute('data-idx'), 10);
        if (isNaN(idx) || idx < 0 || idx >= data.rows.length) return;
        data.rows.splice(idx, 1);
        setMenTournaments(data);
        renderMenTournamentsTable();
      });
    });
  }

  function bindWomenTournamentsDelRows() {
    document.querySelectorAll('.admin-women-tournaments-del-row').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var data = getWomenTournamentsData();
        var idx = parseInt(btn.getAttribute('data-idx'), 10);
        if (isNaN(idx) || idx < 0 || idx >= data.rows.length) return;
        data.rows.splice(idx, 1);
        setWomenTournaments(data);
        renderWomenTournamentsTable();
      });
    });
  }

  function bindMenDoublesTournamentsDelDate() {
    document.querySelectorAll('#admin-men-doubles-tournaments-table .admin-del-date').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var idx = parseInt(btn.getAttribute('data-date-idx'), 10);
        if (isNaN(idx) || idx < 0) return;
        var data = getMenDoublesTournamentsData();
        if (data.dates.length <= 1) {
          alert('Должна остаться хотя бы одна дата турнира.');
          return;
        }
        data.dates.splice(idx, 1);
        data.rows.forEach(function (row) {
          var cells = row.cells || [];
          var start = idx * 2;
          if (cells.length > start + 1) cells.splice(start, 2);
          row.cells = cells;
        });
        menDoublesTournamentsHiddenDates = menDoublesTournamentsHiddenDates.filter(function (i) { return i !== idx; }).map(function (i) { return i > idx ? i - 1 : i; });
        setMenDoublesTournaments(data);
        renderMenDoublesTournamentsTable();
      });
    });
  }

  function bindMenDoublesTournamentsDelRows() {
    document.querySelectorAll('.admin-men-doubles-tournaments-del-row').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var data = getMenDoublesTournamentsData();
        var idx = parseInt(btn.getAttribute('data-idx'), 10);
        if (isNaN(idx) || idx < 0 || idx >= data.rows.length) return;
        data.rows.splice(idx, 1);
        setMenDoublesTournaments(data);
        renderMenDoublesTournamentsTable();
      });
    });
  }

  function bindWomenDoublesTournamentsDelDate() {
    document.querySelectorAll('#admin-women-doubles-tournaments-table .admin-del-date').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        var idx = parseInt(btn.getAttribute('data-date-idx'), 10);
        if (isNaN(idx) || idx < 0) return;
        var data = getWomenDoublesTournamentsData();
        if (data.dates.length <= 1) {
          alert('Должна остаться хотя бы одна дата турнира.');
          return;
        }
        data.dates.splice(idx, 1);
        data.rows.forEach(function (row) {
          var cells = row.cells || [];
          var start = idx * 2;
          if (cells.length > start + 1) cells.splice(start, 2);
          row.cells = cells;
        });
        womenDoublesTournamentsHiddenDates = womenDoublesTournamentsHiddenDates.filter(function (i) { return i !== idx; }).map(function (i) { return i > idx ? i - 1 : i; });
        setWomenDoublesTournaments(data);
        renderWomenDoublesTournamentsTable();
      });
    });
  }

  function bindWomenDoublesTournamentsDelRows() {
    document.querySelectorAll('.admin-women-doubles-tournaments-del-row').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var data = getWomenDoublesTournamentsData();
        var idx = parseInt(btn.getAttribute('data-idx'), 10);
        if (isNaN(idx) || idx < 0 || idx >= data.rows.length) return;
        data.rows.splice(idx, 1);
        setWomenDoublesTournaments(data);
        renderWomenDoublesTournamentsTable();
      });
    });
  }

  function collectMenTournamentsFromTable() {
    var tbody = document.getElementById('admin-men-tournaments-tbody');
    if (!tbody) return null;
    var data = getMenTournamentsData();
    var dates = data.dates;
    var rows = [];
    tbody.querySelectorAll('tr').forEach(function (tr) {
      var inputs = tr.querySelectorAll('input[data-col]');
      if (inputs.length < 2) return;
      var rank = '';
      var name = '';
      var cells = [];
      inputs.forEach(function (inp) {
        var col = inp.getAttribute('data-col');
        var val = inp.value.trim();
        if (col === 'rank') rank = val;
        else if (col === 'name') name = val;
        else cells.push(val);
      });
      rows.push({ rank: rank, name: name, cells: cells });
    });
    return { dates: dates, rows: rows };
  }

  function collectWomenTournamentsFromTable() {
    var tbody = document.getElementById('admin-women-tournaments-tbody');
    if (!tbody) return null;
    var data = getWomenTournamentsData();
    var dates = data.dates;
    var rows = [];
    tbody.querySelectorAll('tr').forEach(function (tr) {
      var inputs = tr.querySelectorAll('input[data-col]');
      if (inputs.length < 2) return;
      var rank = '';
      var name = '';
      var cells = [];
      inputs.forEach(function (inp) {
        var col = inp.getAttribute('data-col');
        var val = inp.value.trim();
        if (col === 'rank') rank = val;
        else if (col === 'name') name = val;
        else cells.push(val);
      });
      rows.push({ rank: rank, name: name, cells: cells });
    });
    return { dates: dates, rows: rows };
  }

  function collectMenDoublesTournamentsFromTable() {
    var tbody = document.getElementById('admin-men-doubles-tournaments-tbody');
    if (!tbody) return null;
    var data = getMenDoublesTournamentsData();
    var dates = data.dates;
    var rows = [];
    tbody.querySelectorAll('tr').forEach(function (tr) {
      var inputs = tr.querySelectorAll('input[data-col]');
      if (inputs.length < 2) return;
      var rank = '';
      var name = '';
      var cells = [];
      inputs.forEach(function (inp) {
        var col = inp.getAttribute('data-col');
        var val = inp.value.trim();
        if (col === 'rank') rank = val;
        else if (col === 'name') name = val;
        else cells.push(val);
      });
      rows.push({ rank: rank, name: name, cells: cells });
    });
    return { dates: dates, rows: rows };
  }

  function collectWomenDoublesTournamentsFromTable() {
    var tbody = document.getElementById('admin-women-doubles-tournaments-tbody');
    if (!tbody) return null;
    var data = getWomenDoublesTournamentsData();
    var dates = data.dates;
    var rows = [];
    tbody.querySelectorAll('tr').forEach(function (tr) {
      var inputs = tr.querySelectorAll('input[data-col]');
      if (inputs.length < 2) return;
      var rank = '';
      var name = '';
      var cells = [];
      inputs.forEach(function (inp) {
        var col = inp.getAttribute('data-col');
        var val = inp.value.trim();
        if (col === 'rank') rank = val;
        else if (col === 'name') name = val;
        else cells.push(val);
      });
      rows.push({ rank: rank, name: name, cells: cells });
    });
    return { dates: dates, rows: rows };
  }

  var menTournamentsInitialized = false;
  function initMenTournamentsOnce() {
    if (menTournamentsInitialized) return;
    menTournamentsInitialized = true;
    var loadBtn = document.getElementById('men-tournaments-load-default');
    var addBtn = document.getElementById('men-tournaments-add-row');
    var saveBtn = document.getElementById('men-tournaments-save');
    var statusEl = document.getElementById('men-tournaments-load-status');
    if (loadBtn) {
      loadBtn.addEventListener('click', function () {
        if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = 'Загрузка...'; }
        function applyData(dates, rows, source) {
          setMenTournaments({ dates: dates, rows: rows });
          renderMenTournamentsTable();
          if (statusEl) {
            statusEl.textContent = source ? source + ' Строк: ' + rows.length : 'Загружено строк: ' + rows.length;
            statusEl.style.display = 'block';
          }
        }
        function useEmbeddedDefault() {
          var data = typeof window.FDSO_DEFAULT_MEN_TOURNAMENTS !== 'undefined' ? window.FDSO_DEFAULT_MEN_TOURNAMENTS : null;
          if (data && Array.isArray(data.rows)) {
            applyData(data.dates || MEN_TOURNAMENTS_DEFAULT_DATES.slice(), data.rows, 'Данные по умолчанию (из файла).');
          } else if (statusEl) {
            statusEl.textContent = 'Не удалось загрузить. Откройте сайт через тот же адрес (например, локальный сервер), чтобы страница детализации была доступна.';
          }
        }
        function parseTableFromDoc(doc) {
          var table = doc.querySelector('.detail-table') || doc.querySelector('table');
          if (!table) return null;
          var dates = [];
          var firstTr = table.querySelector('thead tr');
          if (firstTr) {
            firstTr.querySelectorAll('th[colspan="2"]').forEach(function (th) { dates.push(th.textContent.trim()); });
          }
          if (dates.length < 1) dates = MEN_TOURNAMENTS_DEFAULT_DATES.slice();
          var rows = [];
          table.querySelectorAll('tbody tr').forEach(function (tr) {
            var tds = tr.querySelectorAll('td');
            if (tds.length < 4) return;
            var rank = tds[0].textContent.trim();
            var name = tds[1].textContent.trim();
            var cells = [];
            for (var i = 2; i < tds.length; i++) cells.push(tds[i].textContent.trim());
            rows.push({ rank: rank, name: name, cells: cells });
          });
          return { dates: dates, rows: rows };
        }
        function fallbackToStorageOrFile() {
          var stored = getMenTournaments();
          if (stored && stored.rows && stored.rows.length > 0) {
            applyData(stored.dates || MEN_TOURNAMENTS_DEFAULT_DATES.slice(), stored.rows, 'Загружено сохранённые данные.');
          } else {
            useEmbeddedDefault();
          }
        }
        function loadFromDetailPageByFetch(thenFallback) {
          fetch('rating-men-detail.html')
            .then(function (r) { return r.text(); })
            .then(function (html) {
              var parser = new DOMParser();
              var doc = parser.parseFromString(html, 'text/html');
              var data = doc ? parseTableFromDoc(doc) : null;
              if (data && data.rows.length > 0) {
                applyData(data.dates, data.rows, 'Загружено со страницы детализации.');
              } else if (thenFallback) {
                fallbackToStorageOrFile();
              }
            })
            .catch(function () {
              if (thenFallback) fallbackToStorageOrFile();
            });
        }
        loadFromDetailPageByFetch(true);
      });
    }
    var addDateBtn = document.getElementById('men-tournaments-add-date');
    if (addDateBtn) {
      addDateBtn.addEventListener('click', function () {
        var data = getMenTournamentsData();
        var newDate = prompt('Введите дату турнира (например: 25.01.2026)', '');
        if (newDate == null) return;
        newDate = newDate.trim();
        if (!newDate) return;
        data.dates.push(newDate);
        data.rows.forEach(function (row) {
          var cells = row.cells || [];
          var insertAt = cells.length - 2;
          if (insertAt < 0) insertAt = 0;
          cells.splice(insertAt, 0, '', '');
          row.cells = cells;
        });
        setMenTournaments(data);
        renderMenTournamentsTable();
      });
    }
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        var data = getMenTournamentsData();
        var cellCount = getMenTournamentsCellCount(data.dates);
        var emptyCells = [];
        for (var i = 0; i < cellCount; i++) emptyCells.push('');
        data.rows.push({ rank: String(data.rows.length + 1), name: '', cells: emptyCells });
        setMenTournaments(data);
        renderMenTournamentsTable();
      });
    }
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        var data = collectMenTournamentsFromTable();
        if (!data) return;
        setMenTournaments(data);
        if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = 'Сохранено. Строк: ' + data.rows.length; }
      });
    }
    var tabEl = document.querySelector('#men-tournaments-tab');
    if (tabEl) {
      tabEl.addEventListener('shown.bs.tab', function () {
        renderMenTournamentsTable();
      });
    }
    renderMenTournamentsTable();
  }

  var womenTournamentsInitialized = false;
  function initWomenTournamentsOnce() {
    if (womenTournamentsInitialized) return;
    womenTournamentsInitialized = true;
    var loadBtn = document.getElementById('women-tournaments-load-default');
    var addBtn = document.getElementById('women-tournaments-add-row');
    var saveBtn = document.getElementById('women-tournaments-save');
    var statusEl = document.getElementById('women-tournaments-load-status');
    if (loadBtn) {
      loadBtn.addEventListener('click', function () {
        if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = 'Загрузка...'; }
        function applyData(dates, rows, source) {
          setWomenTournaments({ dates: dates, rows: rows });
          renderWomenTournamentsTable();
          if (statusEl) {
            statusEl.textContent = source ? source + ' Строк: ' + rows.length : 'Загружено строк: ' + rows.length;
            statusEl.style.display = 'block';
          }
        }
        function useEmbeddedDefault() {
          var data = typeof window.FDSO_DEFAULT_WOMEN_TOURNAMENTS !== 'undefined' ? window.FDSO_DEFAULT_WOMEN_TOURNAMENTS : null;
          if (data && Array.isArray(data.rows)) {
            applyData(data.dates || WOMEN_TOURNAMENTS_DEFAULT_DATES.slice(), data.rows, 'Данные по умолчанию (из файла).');
          } else if (statusEl) {
            statusEl.textContent = 'Не удалось загрузить. Откройте сайт через тот же адрес (например, локальный сервер), чтобы страница детализации была доступна.';
          }
        }
        function parseTableFromDoc(doc) {
          var table = doc.querySelector('.detail-table') || doc.querySelector('table');
          if (!table) return null;
          var dates = [];
          var firstTr = table.querySelector('thead tr');
          if (firstTr) {
            firstTr.querySelectorAll('th[colspan="2"]').forEach(function (th) { dates.push(th.textContent.trim()); });
          }
          if (dates.length < 1) dates = WOMEN_TOURNAMENTS_DEFAULT_DATES.slice();
          var rows = [];
          table.querySelectorAll('tbody tr').forEach(function (tr) {
            var tds = tr.querySelectorAll('td');
            if (tds.length < 4) return;
            var rank = tds[0].textContent.trim();
            var name = tds[1].textContent.trim();
            var cells = [];
            for (var i = 2; i < tds.length; i++) cells.push(tds[i].textContent.trim());
            rows.push({ rank: rank, name: name, cells: cells });
          });
          return { dates: dates, rows: rows };
        }
        function fallbackToStorageOrFile() {
          var stored = getWomenTournaments();
          if (stored && stored.rows && stored.rows.length > 0) {
            applyData(stored.dates || WOMEN_TOURNAMENTS_DEFAULT_DATES.slice(), stored.rows, 'Загружено сохранённые данные.');
          } else {
            useEmbeddedDefault();
          }
        }
        function loadFromDetailPageByFetch(thenFallback) {
          fetch('rating-women-detail.html')
            .then(function (r) { return r.text(); })
            .then(function (html) {
              var parser = new DOMParser();
              var doc = parser.parseFromString(html, 'text/html');
              var data = doc ? parseTableFromDoc(doc) : null;
              if (data && data.rows.length > 0) {
                applyData(data.dates, data.rows, 'Загружено со страницы детализации.');
              } else if (thenFallback) {
                fallbackToStorageOrFile();
              }
            })
            .catch(function () {
              if (thenFallback) fallbackToStorageOrFile();
            });
        }
        loadFromDetailPageByFetch(true);
      });
    }
    var addDateBtn = document.getElementById('women-tournaments-add-date');
    if (addDateBtn) {
      addDateBtn.addEventListener('click', function () {
        var data = getWomenTournamentsData();
        var newDate = prompt('Введите дату турнира (например: 25.01.2026)', '');
        if (newDate == null) return;
        newDate = newDate.trim();
        if (!newDate) return;
        data.dates.push(newDate);
        data.rows.forEach(function (row) {
          var cells = row.cells || [];
          var insertAt = cells.length - 2;
          if (insertAt < 0) insertAt = 0;
          cells.splice(insertAt, 0, '', '');
          row.cells = cells;
        });
        setWomenTournaments(data);
        renderWomenTournamentsTable();
      });
    }
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        var data = getWomenTournamentsData();
        var cellCount = getWomenTournamentsCellCount(data.dates);
        var emptyCells = [];
        for (var i = 0; i < cellCount; i++) emptyCells.push('');
        data.rows.push({ rank: String(data.rows.length + 1), name: '', cells: emptyCells });
        setWomenTournaments(data);
        renderWomenTournamentsTable();
      });
    }
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        var data = collectWomenTournamentsFromTable();
        if (!data) return;
        setWomenTournaments(data);
        if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = 'Сохранено. Строк: ' + data.rows.length; }
      });
    }
    var tabEl = document.querySelector('#women-tournaments-tab');
    if (tabEl) {
      tabEl.addEventListener('shown.bs.tab', function () {
        renderWomenTournamentsTable();
      });
    }
    renderWomenTournamentsTable();
  }

  var menDoublesTournamentsInitialized = false;
  function initMenDoublesTournamentsOnce() {
    if (menDoublesTournamentsInitialized) return;
    menDoublesTournamentsInitialized = true;
    var loadBtn = document.getElementById('men-doubles-tournaments-load-default');
    var addBtn = document.getElementById('men-doubles-tournaments-add-row');
    var saveBtn = document.getElementById('men-doubles-tournaments-save');
    var statusEl = document.getElementById('men-doubles-tournaments-load-status');
    if (loadBtn) {
      loadBtn.addEventListener('click', function () {
        if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = 'Загрузка...'; }
        function applyData(dates, rows, source) {
          setMenDoublesTournaments({ dates: dates, rows: rows });
          renderMenDoublesTournamentsTable();
          if (statusEl) {
            statusEl.textContent = source ? source + ' Строк: ' + rows.length : 'Загружено строк: ' + rows.length;
            statusEl.style.display = 'block';
          }
        }
        function useEmbeddedDefault() {
          var data = typeof window.FDSO_DEFAULT_MEN_DOUBLES_TOURNAMENTS !== 'undefined' ? window.FDSO_DEFAULT_MEN_DOUBLES_TOURNAMENTS : null;
          if (data && Array.isArray(data.rows)) {
            applyData(data.dates || MEN_DOUBLES_TOURNAMENTS_DEFAULT_DATES.slice(), data.rows, 'Данные по умолчанию (из файла).');
          } else if (statusEl) {
            statusEl.textContent = 'Не удалось загрузить. Откройте сайт через тот же адрес (например, локальный сервер), чтобы страница детализации была доступна.';
          }
        }
        function parseTableFromDoc(doc) {
          var table = doc.querySelector('.detail-table') || doc.querySelector('table');
          if (!table) return null;
          var dates = [];
          var firstTr = table.querySelector('thead tr');
          if (firstTr) {
            firstTr.querySelectorAll('th[colspan="2"]').forEach(function (th) { dates.push(th.textContent.trim()); });
          }
          if (dates.length < 1) dates = MEN_DOUBLES_TOURNAMENTS_DEFAULT_DATES.slice();
          var rows = [];
          table.querySelectorAll('tbody tr').forEach(function (tr) {
            var tds = tr.querySelectorAll('td');
            if (tds.length < 4) return;
            var rank = tds[0].textContent.trim();
            var name = tds[1].textContent.trim();
            var cells = [];
            for (var i = 2; i < tds.length; i++) cells.push(tds[i].textContent.trim());
            rows.push({ rank: rank, name: name, cells: cells });
          });
          return { dates: dates, rows: rows };
        }
        function fallbackToStorageOrFile() {
          var stored = getMenDoublesTournaments();
          if (stored && stored.rows && stored.rows.length > 0) {
            applyData(stored.dates || MEN_DOUBLES_TOURNAMENTS_DEFAULT_DATES.slice(), stored.rows, 'Загружено сохранённые данные.');
          } else {
            useEmbeddedDefault();
          }
        }
        function loadFromDetailPageByFetch(thenFallback) {
          fetch('rating-men-doubles-detail.html')
            .then(function (r) { return r.text(); })
            .then(function (html) {
              var parser = new DOMParser();
              var doc = parser.parseFromString(html, 'text/html');
              var data = doc ? parseTableFromDoc(doc) : null;
              if (data && data.rows.length > 0) {
                applyData(data.dates, data.rows, 'Загружено со страницы детализации.');
              } else if (thenFallback) {
                fallbackToStorageOrFile();
              }
            })
            .catch(function () {
              if (thenFallback) fallbackToStorageOrFile();
            });
        }
        loadFromDetailPageByFetch(true);
      });
    }
    var addDateBtn = document.getElementById('men-doubles-tournaments-add-date');
    if (addDateBtn) {
      addDateBtn.addEventListener('click', function () {
        var data = getMenDoublesTournamentsData();
        var newDate = prompt('Введите дату турнира (например: 25.01.2026)', '');
        if (newDate == null) return;
        newDate = newDate.trim();
        if (!newDate) return;
        data.dates.push(newDate);
        data.rows.forEach(function (row) {
          var cells = row.cells || [];
          var insertAt = cells.length - 2;
          if (insertAt < 0) insertAt = 0;
          cells.splice(insertAt, 0, '', '');
          row.cells = cells;
        });
        setMenDoublesTournaments(data);
        renderMenDoublesTournamentsTable();
      });
    }
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        var data = getMenDoublesTournamentsData();
        var cellCount = getMenDoublesTournamentsCellCount(data.dates);
        var emptyCells = [];
        for (var i = 0; i < cellCount; i++) emptyCells.push('');
        data.rows.push({ rank: String(data.rows.length + 1), name: '', cells: emptyCells });
        setMenDoublesTournaments(data);
        renderMenDoublesTournamentsTable();
      });
    }
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        var data = collectMenDoublesTournamentsFromTable();
        if (!data) return;
        setMenDoublesTournaments(data);
        if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = 'Сохранено. Строк: ' + data.rows.length; }
      });
    }
    var tabEl = document.querySelector('#men-doubles-tournaments-tab');
    if (tabEl) {
      tabEl.addEventListener('shown.bs.tab', function () {
        renderMenDoublesTournamentsTable();
      });
    }
    renderMenDoublesTournamentsTable();
  }

  var womenDoublesTournamentsInitialized = false;
  function initWomenDoublesTournamentsOnce() {
    if (womenDoublesTournamentsInitialized) return;
    womenDoublesTournamentsInitialized = true;
    var loadBtn = document.getElementById('women-doubles-tournaments-load-default');
    var addBtn = document.getElementById('women-doubles-tournaments-add-row');
    var saveBtn = document.getElementById('women-doubles-tournaments-save');
    var statusEl = document.getElementById('women-doubles-tournaments-load-status');
    if (loadBtn) {
      loadBtn.addEventListener('click', function () {
        if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = 'Загрузка...'; }
        function applyData(dates, rows, source) {
          setWomenDoublesTournaments({ dates: dates, rows: rows });
          renderWomenDoublesTournamentsTable();
          if (statusEl) {
            statusEl.textContent = source ? source + ' Строк: ' + rows.length : 'Загружено строк: ' + rows.length;
            statusEl.style.display = 'block';
          }
        }
        function useEmbeddedDefault() {
          var data = typeof window.FDSO_DEFAULT_WOMEN_DOUBLES_TOURNAMENTS !== 'undefined' ? window.FDSO_DEFAULT_WOMEN_DOUBLES_TOURNAMENTS : null;
          if (data && Array.isArray(data.rows)) {
            applyData(data.dates || WOMEN_DOUBLES_TOURNAMENTS_DEFAULT_DATES.slice(), data.rows, 'Данные по умолчанию (из файла).');
          } else if (statusEl) {
            statusEl.textContent = 'Не удалось загрузить. Откройте сайт через тот же адрес (например, локальный сервер), чтобы страница детализации была доступна.';
          }
        }
        function parseTableFromDoc(doc) {
          var table = doc.querySelector('.detail-table') || doc.querySelector('table');
          if (!table) return null;
          var dates = [];
          var firstTr = table.querySelector('thead tr');
          if (firstTr) {
            firstTr.querySelectorAll('th[colspan="2"]').forEach(function (th) { dates.push(th.textContent.trim()); });
          }
          if (dates.length < 1) dates = WOMEN_DOUBLES_TOURNAMENTS_DEFAULT_DATES.slice();
          var rows = [];
          table.querySelectorAll('tbody tr').forEach(function (tr) {
            var tds = tr.querySelectorAll('td');
            if (tds.length < 4) return;
            var rank = tds[0].textContent.trim();
            var name = tds[1].textContent.trim();
            var cells = [];
            for (var i = 2; i < tds.length; i++) cells.push(tds[i].textContent.trim());
            rows.push({ rank: rank, name: name, cells: cells });
          });
          return { dates: dates, rows: rows };
        }
        function fallbackToStorageOrFile() {
          var stored = getWomenDoublesTournaments();
          if (stored && stored.rows && stored.rows.length > 0) {
            applyData(stored.dates || WOMEN_DOUBLES_TOURNAMENTS_DEFAULT_DATES.slice(), stored.rows, 'Загружено сохранённые данные.');
          } else {
            useEmbeddedDefault();
          }
        }
        function loadFromDetailPageByFetch(thenFallback) {
          fetch('rating-women-doubles-detail.html')
            .then(function (r) { return r.text(); })
            .then(function (html) {
              var parser = new DOMParser();
              var doc = parser.parseFromString(html, 'text/html');
              var data = doc ? parseTableFromDoc(doc) : null;
              if (data && data.rows.length > 0) {
                applyData(data.dates, data.rows, 'Загружено со страницы детализации.');
              } else if (thenFallback) {
                fallbackToStorageOrFile();
              }
            })
            .catch(function () {
              if (thenFallback) fallbackToStorageOrFile();
            });
        }
        loadFromDetailPageByFetch(true);
      });
    }
    var addDateBtn = document.getElementById('women-doubles-tournaments-add-date');
    if (addDateBtn) {
      addDateBtn.addEventListener('click', function () {
        var data = getWomenDoublesTournamentsData();
        var newDate = prompt('Введите дату турнира (например: 25.01.2026)', '');
        if (newDate == null) return;
        newDate = newDate.trim();
        if (!newDate) return;
        data.dates.push(newDate);
        data.rows.forEach(function (row) {
          var cells = row.cells || [];
          var insertAt = cells.length - 2;
          if (insertAt < 0) insertAt = 0;
          cells.splice(insertAt, 0, '', '');
          row.cells = cells;
        });
        setWomenDoublesTournaments(data);
        renderWomenDoublesTournamentsTable();
      });
    }
    if (addBtn) {
      addBtn.addEventListener('click', function () {
        var data = getWomenDoublesTournamentsData();
        var cellCount = getWomenDoublesTournamentsCellCount(data.dates);
        var emptyCells = [];
        for (var i = 0; i < cellCount; i++) emptyCells.push('');
        data.rows.push({ rank: String(data.rows.length + 1), name: '', cells: emptyCells });
        setWomenDoublesTournaments(data);
        renderWomenDoublesTournamentsTable();
      });
    }
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        var data = collectWomenDoublesTournamentsFromTable();
        if (!data) return;
        setWomenDoublesTournaments(data);
        if (statusEl) { statusEl.style.display = 'block'; statusEl.textContent = 'Сохранено. Строк: ' + data.rows.length; }
      });
    }
    var tabEl = document.querySelector('#women-doubles-tournaments-tab');
    if (tabEl) {
      tabEl.addEventListener('shown.bs.tab', function () {
        renderWomenDoublesTournamentsTable();
      });
    }
    renderWomenDoublesTournamentsTable();
  }

  function renderPeopleList() {
    var tbody = document.getElementById('people-tbody');
    var emptyEl = document.getElementById('people-empty');
    if (!tbody) return;
    var list = getPeople();
    if (emptyEl) emptyEl.style.display = list.length ? 'none' : 'block';
    tbody.innerHTML = '';
    list.forEach(function (p, idx) {
      var tr = document.createElement('tr');
      var birthVal = (p.birthDate || '').trim();
      var feeChecked = p.feePaid ? ' checked' : '';
      tr.innerHTML =
        '<td class="align-middle">' + escapeHtml(p.name || '') + '</td>' +
        '<td><input type="date" class="form-control form-control-sm people-birth" data-idx="' + idx + '" value="' + escapeAttr(birthVal) + '" placeholder="ГГГГ-ММ-ДД"></td>' +
        '<td class="text-center align-middle"><input type="checkbox" class="form-check-input people-fee" data-idx="' + idx + '"' + feeChecked + ' title="Оплата взноса"></td>';
      tbody.appendChild(tr);
    });
    bindPeopleInputs();
  }

  function bindPeopleInputs() {
    var list = getPeople();
    document.querySelectorAll('#people-tbody .people-birth').forEach(function (inp) {
      var idx = parseInt(inp.getAttribute('data-idx'), 10);
      inp.addEventListener('change', function () {
        if (idx >= 0 && idx < list.length) {
          list[idx].birthDate = (inp.value || '').trim();
          setPeople(list);
        }
      });
    });
    document.querySelectorAll('#people-tbody .people-fee').forEach(function (cb) {
      var idx = parseInt(cb.getAttribute('data-idx'), 10);
      cb.addEventListener('change', function () {
        if (idx >= 0 && idx < list.length) {
          list[idx].feePaid = cb.checked;
          setPeople(list);
        }
      });
    });
  }

  function savePeopleFromForm() {
    var list = getPeople();
    var rows = document.querySelectorAll('#people-tbody tr');
    rows.forEach(function (tr, idx) {
      if (idx >= list.length) return;
      var birthInp = tr.querySelector('.people-birth');
      var feeCb = tr.querySelector('.people-fee');
      if (birthInp) list[idx].birthDate = (birthInp.value || '').trim();
      if (feeCb) list[idx].feePaid = feeCb.checked;
    });
    setPeople(list);
  }

  var peopleInitialized = false;
  function initPeopleOnce() {
    if (peopleInitialized) return;
    peopleInitialized = true;
    var syncBtn = document.getElementById('people-sync-from-ratings');
    var saveBtn = document.getElementById('people-save');
    var addBtn = document.getElementById('people-add-btn');
    var addNameEl = document.getElementById('people-add-name');
    var addBirthEl = document.getElementById('people-add-birth');
    var addFeeEl = document.getElementById('people-add-fee');
    if (syncBtn) {
      syncBtn.addEventListener('click', function () {
        mergePeopleWithRatings();
        renderPeopleList();
      });
    }
    if (saveBtn) {
      saveBtn.addEventListener('click', function () {
        savePeopleFromForm();
      });
    }
    if (addBtn && addNameEl) {
      function doAddPerson() {
        var name = (addNameEl.value || '').trim();
        if (!name) return;
        var list = getPeople();
        var birthDate = (addBirthEl && addBirthEl.value) ? addBirthEl.value.trim() : '';
        var feePaid = addFeeEl ? addFeeEl.checked : false;
        list.push({ name: name, birthDate: birthDate, feePaid: feePaid });
        list.sort(function (a, b) { return (a.name || '').localeCompare(b.name || '', 'ru'); });
        setPeople(list);
        renderPeopleList();
        addNameEl.value = '';
        if (addBirthEl) addBirthEl.value = '';
        if (addFeeEl) addFeeEl.checked = false;
      }
      addBtn.addEventListener('click', doAddPerson);
      if (addNameEl) {
        addNameEl.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); doAddPerson(); }
        });
      }
    }
    var tabEl = document.querySelector('#people-tab');
    if (tabEl) {
      tabEl.addEventListener('shown.bs.tab', function () {
        renderPeopleList();
      });
    }
    renderPeopleList();
  }

  function renderNewsList() {
    var list = document.getElementById('admin-news-list');
    var empty = document.getElementById('news-empty');
    if (!list) return;
    var news = getNews();
    news = (Array.isArray(news) ? news : []).slice().sort(function (a, b) {
      var ta = new Date(a && a.date).getTime();
      var tb = new Date(b && b.date).getTime();
      if (isNaN(ta)) return 1;
      if (isNaN(tb)) return -1;
      return tb - ta;
    });
    list.innerHTML = '';
    if (empty) empty.style.display = news.length ? 'none' : 'block';
    news.forEach(function (item) {
      var li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between align-items-start';
      var photoBadge = item.imageUrl ? ' <span class="badge bg-secondary">фото</span>' : '';
      li.innerHTML =
        '<div><strong>' + escapeHtml(item.title) + '</strong>' + photoBadge + '<br><span class="text-muted small">' +
        escapeHtml((item.text || '').replace(/<[^>]+>/g, '')) + '</span><br><small>' + formatDate(item.date) + '</small></div>' +
        '<div class="d-flex gap-1"><button type="button" class="btn btn-outline-primary btn-sm admin-btn-edit-news" data-id="' + item.id + '" aria-label="Редактировать">Редактировать</button>' +
        '<button type="button" class="btn btn-outline-danger btn-sm admin-btn-delete" data-id="' + item.id + '" data-type="news" aria-label="Удалить">Удалить</button></div>';
      list.appendChild(li);
    });
    bindDeleteButtons();
    bindEditNewsButtons();
  }

  function renderCompetitionsList() {
    var list = document.getElementById('admin-competitions-list');
    var empty = document.getElementById('competitions-empty');
    if (!list) return;
    var comps = getCompetitions();
    comps = (Array.isArray(comps) ? comps : []).slice().sort(function (a, b) {
      var ta = new Date(a && a.date).getTime();
      var tb = new Date(b && b.date).getTime();
      if (isNaN(ta)) return 1;
      if (isNaN(tb)) return -1;
      return tb - ta;
    });
    list.innerHTML = '';
    if (empty) empty.style.display = comps.length ? 'none' : 'block';
    comps.forEach(function (item) {
      var statusText = item.status === 'past' ? 'Завершён' : 'Скоро';
      var photoBadge = item.imageUrl ? ' <span class="badge bg-secondary">фото</span>' : '';
      var li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between align-items-start';
      li.innerHTML =
        '<div><strong>' + escapeHtml(item.title) + '</strong>' + photoBadge + '<br><span class="text-muted small">' +
        escapeHtml(item.text) + '</span><br><small>' + formatDate(item.date) + ' · ' + statusText + '</small></div>' +
        '<div class="d-flex gap-1"><button type="button" class="btn btn-outline-primary btn-sm admin-btn-edit-competition" data-id="' + item.id + '" aria-label="Редактировать">Редактировать</button>' +
        '<button type="button" class="btn btn-outline-danger btn-sm admin-btn-delete" data-id="' + item.id + '" data-type="competition" aria-label="Удалить">Удалить</button></div>';
      list.appendChild(li);
    });
    bindDeleteButtons();
    bindEditCompetitionButtons();
  }

  function clearEditCompetitionImage() {
    pendingEditCompetitionImageDataUrl = null;
    pendingEditCompetitionImageUrl = null;
    editCompetitionImageCleared = true;
    var urlEl = document.getElementById('edit-competition-image-url');
    var fileEl = document.getElementById('edit-competition-image-file');
    var previewEl = document.getElementById('edit-competition-image-preview');
    var filenameEl = document.getElementById('edit-competition-image-filename');
    var clearBtn = document.getElementById('edit-competition-image-clear');
    if (urlEl) urlEl.value = '';
    if (fileEl) fileEl.value = '';
    if (previewEl) previewEl.innerHTML = '';
    if (filenameEl) filenameEl.textContent = '';
    if (clearBtn) clearBtn.style.display = 'none';
  }

  function bindEditCompetitionButtons() {
    document.querySelectorAll('.admin-btn-edit-competition').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = parseInt(btn.getAttribute('data-id'), 10);
        var comps = getCompetitions();
        var item = comps.filter(function (c) { return c.id === id; })[0];
        if (!item) return;
        editCompetitionImageCleared = false;
        pendingEditCompetitionImageDataUrl = null;
        pendingEditCompetitionImageUrl = null;
        editCompetitionCurrentImageUrl = item.imageUrl || (item.imageDataUrl ? item.imageDataUrl : null);
        document.getElementById('edit-competition-id').value = id;
        document.getElementById('edit-competition-title').value = item.title || '';
        document.getElementById('edit-competition-text').value = item.text || '';
        document.getElementById('edit-competition-date').value = item.date || '';
        document.getElementById('edit-competition-status').value = item.status === 'past' ? 'past' : 'upcoming';
        var urlEl = document.getElementById('edit-competition-image-url');
        var previewEl = document.getElementById('edit-competition-image-preview');
        var clearBtn = document.getElementById('edit-competition-image-clear');
        if (urlEl) urlEl.value = editCompetitionCurrentImageUrl && editCompetitionCurrentImageUrl.indexOf('data:') !== 0 ? editCompetitionCurrentImageUrl : '';
        if (previewEl) {
          if (editCompetitionCurrentImageUrl) {
            previewEl.innerHTML = '<img src="' + escapeAttr(editCompetitionCurrentImageUrl) + '" alt="" style="max-width:200px;max-height:120px;object-fit:cover;border-radius:8px;">';
            if (clearBtn) clearBtn.style.display = 'inline';
          } else {
            previewEl.innerHTML = '';
            if (clearBtn) clearBtn.style.display = 'none';
          }
        }
        document.getElementById('edit-competition-image-filename').textContent = '';
        document.getElementById('edit-competition-image-file').value = '';
        var modalEl = document.getElementById('modal-edit-competition');
        if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
          var modal = new bootstrap.Modal(modalEl);
          modal.show();
        }
      });
    });
  }

  function renderPhotosList() {
    var list = document.getElementById('admin-photos-list');
    var empty = document.getElementById('photos-empty');
    if (!list) return;
    var photos = getPhotos();
    list.innerHTML = '';
    if (empty) empty.style.display = photos.length ? 'none' : 'block';
    photos.forEach(function (item) {
      var col = document.createElement('div');
      col.className = 'col-md-4 col-lg-3';
      var compText = (item.competition || '').trim() ? escapeHtml(item.competition) : '—';
      col.innerHTML =
        '<div class="admin-photo-item card">' +
        '<img src="' + escapeAttr(item.url) + '" class="card-img-top" alt="" style="height:120px;object-fit:cover" onerror="this.style.background=\'#eee\'">' +
        '<div class="card-body p-2">' +
        '<p class="small mb-0 text-truncate" title="' + escapeAttr(item.caption || '') + '">' + escapeHtml(item.caption || '—') + '</p>' +
        '<p class="small mb-1 text-muted">Соревнование: ' + compText + '</p>' +
        '<button type="button" class="btn btn-outline-danger btn-sm w-100 admin-btn-delete" data-id="' + item.id + '" data-type="photo">Удалить</button>' +
        '</div></div>';
      list.appendChild(col);
    });
    bindDeleteButtons();
  }

  function renderDocumentsList() {
    var list = document.getElementById('admin-documents-list');
    var empty = document.getElementById('documents-empty');
    if (!list) return;
    var docs = getDocuments();
    list.innerHTML = '';
    if (empty) empty.style.display = docs.length ? 'none' : 'block';
    docs.forEach(function (item) {
      var li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between align-items-center';
      li.innerHTML =
        '<div><strong>' + escapeHtml(item.title) + '</strong> <span class="text-muted small">' + escapeHtml(item.meta || '') + '</span></div>' +
        '<div class="d-flex gap-1">' +
        '<button type="button" class="btn btn-outline-primary btn-sm admin-btn-edit-document" data-id="' + item.id + '" aria-label="Редактировать">Редактировать</button>' +
        '<button type="button" class="btn btn-outline-danger btn-sm admin-btn-delete" data-id="' + item.id + '" data-type="document">Удалить</button>' +
        '</div>';
      list.appendChild(li);
    });
    bindDeleteButtons();
    bindEditDocumentButtons();
  }

  function renderFriendsList() {
    var list = document.getElementById('admin-friends-list');
    var empty = document.getElementById('friends-empty');
    if (!list) return;
    var friends = getFriends();
    list.innerHTML = '';
    if (empty) empty.style.display = friends.length ? 'none' : 'block';
    friends.forEach(function (item) {
      var li = document.createElement('li');
      li.className = 'list-group-item d-flex justify-content-between align-items-center';
      var iconHtml = item.iconUrl
        ? '<img src="' + escapeAttr(item.iconUrl) + '" alt="" style="width:32px;height:32px;object-fit:cover;border-radius:50%;margin-right:0.5rem;">'
        : '';
      li.innerHTML =
        '<div class="d-flex align-items-center">' + iconHtml +
        '<div><strong>' + escapeHtml(item.title || '') + '</strong><br><span class="text-muted small">' + escapeHtml(item.url || '') + '</span></div></div>' +
        '<div class="d-flex gap-1">' +
        '<button type="button" class="btn btn-outline-primary btn-sm admin-btn-edit-friend" data-id="' + item.id + '" aria-label="Редактировать">Редактировать</button>' +
        '<button type="button" class="btn btn-outline-danger btn-sm admin-btn-delete" data-id="' + item.id + '" data-type="friend">Удалить</button>' +
        '</div>';
      list.appendChild(li);
    });
    bindDeleteButtons();
    bindEditFriendButtons();
  }

  function bindEditFriendButtons() {
    document.querySelectorAll('.admin-btn-edit-friend').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = parseInt(btn.getAttribute('data-id'), 10);
        var friends = getFriends();
        var item = friends.filter(function (f) { return f.id === id; })[0];
        if (!item) return;
        editFriendCurrentIconUrl = item.iconUrl || null;
        editFriendIconCleared = false;
        pendingEditFriendIconUrl = null;
        document.getElementById('edit-friend-id').value = id;
        document.getElementById('edit-friend-title').value = item.title || '';
        document.getElementById('edit-friend-url').value = item.url || '';
        var preview = document.getElementById('edit-friend-icon-preview');
        var filenameEl = document.getElementById('edit-friend-icon-filename');
        var clearBtn = document.getElementById('edit-friend-icon-clear');
        document.getElementById('edit-friend-icon-file').value = '';
        if (filenameEl) filenameEl.textContent = '';
        if (item.iconUrl) {
          if (preview) preview.innerHTML = '<img src="' + escapeAttr(item.iconUrl) + '" alt="" style="max-width:80px;max-height:80px;object-fit:cover;border-radius:50%;">';
          if (clearBtn) clearBtn.style.display = 'inline';
        } else {
          if (preview) preview.innerHTML = '';
          if (clearBtn) clearBtn.style.display = 'none';
        }
        var modalEl = document.getElementById('modal-edit-friend');
        if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
          var modal = new bootstrap.Modal(modalEl);
          modal.show();
        }
      });
    });
  }

  function bindEditDocumentButtons() {
    document.querySelectorAll('.admin-btn-edit-document').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = parseInt(btn.getAttribute('data-id'), 10);
        var docs = getDocuments();
        var item = docs.filter(function (d) { return d.id === id; })[0];
        if (!item) return;
        pendingEditDocumentDataUrl = null;
        pendingEditDocumentMeta = null;
        editDocumentCurrentUrl = item.url || '';
        document.getElementById('edit-doc-id').value = id;
        document.getElementById('edit-doc-title').value = item.title || '';
        document.getElementById('edit-doc-meta').value = item.meta || '';
        var urlEl = document.getElementById('edit-doc-url');
        if (urlEl) {
          urlEl.value = (item.url && item.url.indexOf('data:') !== 0) ? item.url : '';
        }
        var filenameEl = document.getElementById('edit-doc-filename');
        if (filenameEl) filenameEl.textContent = '';
        document.getElementById('edit-doc-file').value = '';
        var clearBtn = document.getElementById('edit-doc-clear');
        if (clearBtn) clearBtn.style.display = 'none';
        var modalEl = document.getElementById('modal-edit-document');
        if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
          var modal = new bootstrap.Modal(modalEl);
          modal.show();
        }
      });
    });
  }

  function bindDeleteButtons() {
    document.querySelectorAll('.admin-btn-delete').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = parseInt(btn.getAttribute('data-id'), 10);
        var type = btn.getAttribute('data-type');
        if (type === 'news') {
          var news = getNews().filter(function (n) { return n.id !== id; });
          setNews(news);
          renderNewsList();
        } else if (type === 'photo') {
          var photos = getPhotos().filter(function (p) { return p.id !== id; });
          setPhotos(photos);
          renderPhotosList();
        } else if (type === 'document') {
          var docs = getDocuments().filter(function (d) { return d.id !== id; });
          setDocuments(docs);
          renderDocumentsList();
        } else if (type === 'friend') {
          var friends = getFriends().filter(function (f) { return f.id !== id; });
          setFriends(friends);
          renderFriendsList();
        } else if (type === 'competition') {
          var comps = getCompetitions().filter(function (c) { return c.id !== id; });
          setCompetitions(comps);
          renderCompetitionsList();
        }
      });
    });
  }

  function bindEditNewsButtons() {
    document.querySelectorAll('.admin-btn-edit-news').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var id = parseInt(btn.getAttribute('data-id'), 10);
        var news = getNews();
        var item = news.filter(function (n) { return n.id === id; })[0];
        if (!item) return;
        editNewsCurrentImageUrl = item.imageUrl || null;
        editNewsImageCleared = false;
        pendingEditNewsImageDataUrl = null;
        pendingEditNewsImageUrl = null;
        document.getElementById('edit-news-id').value = id;
        document.getElementById('edit-news-title').value = item.title;
        setNewsTextToEditor(document.getElementById('edit-news-text'), item.text || '');
        document.getElementById('edit-news-date').value = item.date;
        var editUrl = document.getElementById('edit-news-image-url');
        var editPreview = document.getElementById('edit-news-image-preview');
        var editFilename = document.getElementById('edit-news-image-filename');
        var editClear = document.getElementById('edit-news-image-clear');
        editUrl.value = '';
        if (editFilename) editFilename.textContent = '';
        if (item.imageUrl) {
          if (item.imageUrl.indexOf('data:') !== 0) editUrl.value = item.imageUrl;
          if (editPreview) editPreview.innerHTML = '<img src="' + escapeAttr(item.imageUrl) + '" alt="" style="max-width:200px;max-height:120px;object-fit:cover;border-radius:8px;">';
          if (editClear) editClear.style.display = 'inline';
        } else {
          if (editPreview) editPreview.innerHTML = '';
          if (editClear) editClear.style.display = 'none';
        }
        var modalEl = document.getElementById('modal-edit-news');
        if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
          var modal = bootstrap.Modal.getOrCreateInstance(modalEl);
          modal.show();
        }
      });
    });
  }

  function escapeHtml(s) {
    if (!s) return '';
    var div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function escapeAttr(s) {
    if (!s) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  var ALLOWED_NEWS_TAGS = ['strong', 'b', 'em', 'i', 'br'];
  var BLOCK_TAGS = ['div', 'p'];
  function sanitizeNewsHtml(html) {
    if (!html || typeof html !== 'string') return '';
    var div = document.createElement('div');
    div.innerHTML = html;
    function walk(node) {
      if (node.nodeType === 3) return node.textContent;
      if (node.nodeType !== 1) return '';
      var tag = node.tagName.toLowerCase();
      if (ALLOWED_NEWS_TAGS.indexOf(tag) !== -1) {
        if (tag === 'br') return '<br>';
        var out = '<' + tag + '>';
        for (var i = 0; i < node.childNodes.length; i++) out += walk(node.childNodes[i]);
        return out + '</' + tag + '>';
      }
      var blockBreak = BLOCK_TAGS.indexOf(tag) !== -1 ? '<br>' : '';
      var out = '';
      for (var i = 0; i < node.childNodes.length; i++) out += walk(node.childNodes[i]);
      return blockBreak + out;
    }
    var out = '';
    for (var i = 0; i < div.childNodes.length; i++) out += walk(div.childNodes[i]);
    return out;
  }
  function getNewsTextFromEditor(el) {
    if (!el || !el.innerHTML) return '';
    return sanitizeNewsHtml(el.innerHTML.trim());
  }
  function setNewsTextToEditor(el, html) {
    if (!el) return;
    el.innerHTML = html ? sanitizeNewsHtml(html) : '';
  }
  var NEWS_EMOJI_LIST = ['😀','😊','👍','👏','🎯','🏆','🥇','🥈','🥉','✅','❤️','🔥','⭐','📅','📢','🏅','🎉','💪','🙌','😎'];
  var lastFocusedNewsEditor = null;
  function fillEmojiPicker(pickerEl) {
    if (!pickerEl || pickerEl.dataset.filled) return;
    pickerEl.dataset.filled = '1';
    NEWS_EMOJI_LIST.forEach(function (emoji) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'admin-emoji-btn';
      btn.textContent = emoji;
      btn.setAttribute('aria-label', 'Вставить ' + emoji);
      btn.addEventListener('click', function () {
        var editor = lastFocusedNewsEditor;
        if (editor) {
          editor.focus();
          document.execCommand('insertText', false, emoji);
        }
      });
      pickerEl.appendChild(btn);
    });
  }
  function initNewsEditorToolbar(editorEl, emojiBtn, pickerEl) {
    if (!editorEl) return;
    editorEl.addEventListener('focus', function () { lastFocusedNewsEditor = editorEl; });
    editorEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        e.preventDefault();
        var sel = window.getSelection();
        var range = sel && sel.rangeCount ? sel.getRangeAt(0) : null;
        if (range && editorEl.contains(range.commonAncestorContainer)) {
          var br = document.createElement('br');
          range.deleteContents();
          range.insertNode(br);
          range.setStartAfter(br);
          range.setEndAfter(br);
          sel.removeAllRanges();
          sel.addRange(range);
        } else {
          document.execCommand('insertHTML', false, '<br>');
        }
      }
    });
    var placeholder = editorEl.getAttribute('data-placeholder');
    if (placeholder) {
      editorEl.addEventListener('blur', function () {
        if (!editorEl.textContent.trim()) editorEl.classList.add('admin-rich-text-empty');
        else editorEl.classList.remove('admin-rich-text-empty');
      });
      if (!editorEl.textContent.trim()) editorEl.classList.add('admin-rich-text-empty');
    }
    var toolbar = editorEl.previousElementSibling;
    if (toolbar) {
      var boldBtn = toolbar.querySelector('.admin-edit-bold');
      var italicBtn = toolbar.querySelector('.admin-edit-italic');
      if (boldBtn) boldBtn.addEventListener('click', function () { editorEl.focus(); document.execCommand('bold', false, null); });
      if (italicBtn) italicBtn.addEventListener('click', function () { editorEl.focus(); document.execCommand('italic', false, null); });
      if (emojiBtn && pickerEl) {
        fillEmojiPicker(pickerEl);
        emojiBtn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          lastFocusedNewsEditor = editorEl;
          editorEl.focus();
          var isOpen = pickerEl.classList.toggle('show');
          if (isOpen) {
            var toolbar = editorEl.previousElementSibling;
            if (toolbar) {
              pickerEl.style.left = (emojiBtn.offsetLeft || 0) + 'px';
              pickerEl.style.top = (emojiBtn.offsetTop + (emojiBtn.offsetHeight || 0) + 4) + 'px';
            }
          }
        });
      }
    }
  }

  function initLogin() {
    var form = document.getElementById('login-form');
    var passwordInput = document.getElementById('admin-password');
    var errorEl = document.getElementById('login-error');
    if (!form) return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var pwd = passwordInput && passwordInput.value ? passwordInput.value : '';
      if (pwd === ADMIN_PASSWORD) {
        setAuthenticated(true);
        if (errorEl) errorEl.style.display = 'none';
        passwordInput.value = '';
        showScreen(false);
      } else {
        if (errorEl) errorEl.style.display = 'block';
      }
    });
  }

  function initLogout() {
    var btn = document.getElementById('admin-logout');
    if (btn) {
      btn.addEventListener('click', function () {
        setAuthenticated(false);
        showScreen(true);
      });
    }
  }

  function initEditNewsModal() {
    var modalEl = document.getElementById('modal-edit-news');
    var editImageFile = document.getElementById('edit-news-image-file');
    var editImageUrl = document.getElementById('edit-news-image-url');
    var editImagePreview = document.getElementById('edit-news-image-preview');
    var editImageFilename = document.getElementById('edit-news-image-filename');
    var editImageClear = document.getElementById('edit-news-image-clear');
    var editSaveBtn = document.getElementById('edit-news-save');

    function clearEditNewsImage() {
      pendingEditNewsImageDataUrl = null;
      pendingEditNewsImageUrl = null;
      editNewsImageCleared = true;
      if (editImageFile) editImageFile.value = '';
      if (editImageUrl) editImageUrl.value = '';
      if (editImagePreview) editImagePreview.innerHTML = '';
      if (editImageFilename) editImageFilename.textContent = '';
      if (editImageClear) editImageClear.style.display = 'none';
    }

    if (editImageFile) {
      editImageFile.addEventListener('change', function () {
        var file = this.files && this.files[0];
        if (!file || !file.type.match(/^image\//)) return;
        if (editImageUrl) editImageUrl.value = '';
        editNewsImageCleared = false;
        uploadImageToSite(file, 'news', 1200, 0.8).then(function (result) {
          pendingEditNewsImageUrl = result.url;
          pendingEditNewsImageDataUrl = null;
          if (editImageFilename) editImageFilename.textContent = file.name;
          if (editImagePreview) {
            editImagePreview.innerHTML = '<img src="' + escapeAttr(result.url) + '" alt="" style="max-width:200px;max-height:120px;object-fit:cover;border-radius:8px;">';
          }
          if (editImageClear) editImageClear.style.display = 'inline';
        }).catch(function () {
          alert('Не удалось загрузить изображение. Запустите сервер (npm start).');
        });
      });
    }
    if (editImageClear) editImageClear.addEventListener('click', clearEditNewsImage);

    if (editSaveBtn) {
      editSaveBtn.addEventListener('click', function () {
        var idEl = document.getElementById('edit-news-id');
        var id = idEl ? parseInt(idEl.value, 10) : 0;
        var title = document.getElementById('edit-news-title').value.trim();
        var text = getNewsTextFromEditor(document.getElementById('edit-news-text'));
        var date = document.getElementById('edit-news-date').value;
        if (!title || !date) return;
        if (!text || !text.replace(/<[^>]+>/g, '').trim()) return;
        var imageUrl = pendingEditNewsImageUrl ||
          (editNewsImageCleared ? '' : ((editImageUrl && editImageUrl.value.trim()) || editNewsCurrentImageUrl || ''));
        var news = getNews();
        var idx = news.findIndex(function (n) { return n.id === id; });
        if (idx === -1) return;
        news[idx] = { id: id, title: title, text: text, date: date };
        if (imageUrl) news[idx].imageUrl = imageUrl;
        setNews(news);
        renderNewsList();
        if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
          var modal = bootstrap.Modal.getInstance(modalEl);
          if (modal) modal.hide();
        }
      });
    }

    if (modalEl) {
      modalEl.addEventListener('hidden.bs.modal', function () {
        document.getElementById('edit-news-id').value = '';
        document.getElementById('edit-news-title').value = '';
        setNewsTextToEditor(document.getElementById('edit-news-text'), '');
        document.getElementById('edit-news-date').value = '';
        clearEditNewsImage();
        editNewsCurrentImageUrl = null;
      });
    }
    var editNewsTextEl = document.getElementById('edit-news-text');
    var editToolbar = editNewsTextEl && editNewsTextEl.previousElementSibling;
    initNewsEditorToolbar(editNewsTextEl, editToolbar && editToolbar.querySelector('.admin-edit-emoji'), document.getElementById('edit-news-emoji-picker'));
  }

  function initNewsForm() {
    var form = document.getElementById('form-add-news');
    if (!form) return;
    var dateInput = document.getElementById('news-date');
    var newsImageFile = document.getElementById('news-image-file');
    var newsImageUrl = document.getElementById('news-image-url');
    var newsImagePreview = document.getElementById('news-image-preview');
    var newsImageFilename = document.getElementById('news-image-filename');
    var newsImageClear = document.getElementById('news-image-clear');

    if (dateInput && !dateInput.value) {
      var today = new Date();
      dateInput.value = today.getFullYear() + '-' + ('0' + (today.getMonth() + 1)).slice(-2) + '-' + ('0' + today.getDate()).slice(-2);
    }

    function clearNewsImage() {
      pendingNewsImageDataUrl = null;
      pendingNewsImageUrl = null;
      if (newsImageFile) newsImageFile.value = '';
      if (newsImageUrl) newsImageUrl.value = '';
      if (newsImagePreview) newsImagePreview.innerHTML = '';
      if (newsImageFilename) newsImageFilename.textContent = '';
      if (newsImageClear) newsImageClear.style.display = 'none';
    }

    function setNewsImagePreview(src, filename) {
      if (newsImageFilename) newsImageFilename.textContent = filename || '';
      if (newsImagePreview) {
        newsImagePreview.innerHTML = '<img src="' + escapeAttr(src) + '" alt="" style="max-width:200px;max-height:120px;object-fit:cover;border-radius:8px;">';
      }
      if (newsImageClear) newsImageClear.style.display = 'inline';
    }

    if (newsImageFile) {
      newsImageFile.addEventListener('change', function () {
        var file = this.files && this.files[0];
        if (!file || !file.type.match(/^image\//)) return;
        if (newsImageUrl) newsImageUrl.value = '';
        uploadImageToSite(file, 'news', 1200, 0.8).then(function (result) {
          pendingNewsImageUrl = result.url;
          pendingNewsImageDataUrl = null;
          setNewsImagePreview(result.url, file.name);
        }).catch(function () {
          alert('Не удалось загрузить изображение. Запустите сервер (npm start).');
        });
      });
    }
    if (newsImageClear) newsImageClear.addEventListener('click', clearNewsImage);

    var newsTextEl = document.getElementById('news-text');
    var newsToolbar = newsTextEl && newsTextEl.previousElementSibling;
    initNewsEditorToolbar(newsTextEl, newsToolbar && newsToolbar.querySelector('.admin-edit-emoji'), document.getElementById('news-emoji-picker'));

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var title = document.getElementById('news-title').value.trim();
      var text = getNewsTextFromEditor(newsTextEl);
      var imageUrl = pendingNewsImageUrl || (newsImageUrl && newsImageUrl.value.trim()) || '';
      var date = document.getElementById('news-date').value;
      if (!title || !date) return;
      if (!text || !text.replace(/<[^>]+>/g, '').trim()) return;
      var news = getNews();
      var id = nextId(news);
      var item = { id: id, title: title, text: text, date: date };
      if (imageUrl) item.imageUrl = imageUrl;
      news.push(item);
      setNews(news);
      document.getElementById('news-title').value = '';
      setNewsTextToEditor(newsTextEl, '');
      clearNewsImage();
      form.reset();
      if (dateInput) dateInput.value = date;
      renderNewsList();
    });

    document.addEventListener('click', function (e) {
      if (!e.target.closest('.admin-emoji-picker') && !e.target.closest('.admin-edit-emoji')) {
        document.querySelectorAll('.admin-emoji-picker.show').forEach(function (p) { p.classList.remove('show'); });
      }
    });
  }

  function initCompetitionsForm() {
    var form = document.getElementById('form-add-competition');
    if (!form) return;
    var dateInput = document.getElementById('competition-date');
    var competitionImageFile = document.getElementById('competition-image-file');
    var competitionImageUrl = document.getElementById('competition-image-url');
    var competitionImagePreview = document.getElementById('competition-image-preview');
    var competitionImageFilename = document.getElementById('competition-image-filename');
    var competitionImageClear = document.getElementById('competition-image-clear');
    if (dateInput && !dateInput.value) {
      var today = new Date();
      dateInput.value = today.getFullYear() + '-' + ('0' + (today.getMonth() + 1)).slice(-2) + '-' + ('0' + today.getDate()).slice(-2);
    }
    function clearCompetitionImage() {
      pendingCompetitionImageDataUrl = null;
      pendingCompetitionImageUrl = null;
      if (competitionImageFile) competitionImageFile.value = '';
      if (competitionImageUrl) competitionImageUrl.value = '';
      if (competitionImagePreview) competitionImagePreview.innerHTML = '';
      if (competitionImageFilename) competitionImageFilename.textContent = '';
      if (competitionImageClear) competitionImageClear.style.display = 'none';
    }
    function setCompetitionImagePreview(src, filename) {
      if (competitionImageFilename) competitionImageFilename.textContent = filename || '';
      if (competitionImagePreview) {
        competitionImagePreview.innerHTML = '<img src="' + escapeAttr(src) + '" alt="" style="max-width:200px;max-height:120px;object-fit:cover;border-radius:8px;">';
      }
      if (competitionImageClear) competitionImageClear.style.display = 'inline';
    }
    if (competitionImageFile) {
      competitionImageFile.addEventListener('change', function () {
        var file = this.files && this.files[0];
        if (!file || !file.type.match(/^image\//)) return;
        if (competitionImageUrl) competitionImageUrl.value = '';
        uploadImageToSite(file, 'competition', 1200, 0.8).then(function (result) {
          pendingCompetitionImageUrl = result.url;
          pendingCompetitionImageDataUrl = null;
          setCompetitionImagePreview(result.url, file.name);
        }).catch(function () {
          alert('Не удалось загрузить изображение. Запустите сервер (npm start).');
        });
      });
    }
    if (competitionImageClear) competitionImageClear.addEventListener('click', clearCompetitionImage);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var title = document.getElementById('competition-title').value.trim();
      var text = document.getElementById('competition-text').value.trim();
      var imageUrl = pendingCompetitionImageUrl || (competitionImageUrl && competitionImageUrl.value.trim()) || '';
      var date = document.getElementById('competition-date').value;
      var status = document.getElementById('competition-status').value;
      if (!title || !text || !date) return;
      var comps = getCompetitions();
      var id = nextId(comps);
      var item = { id: id, title: title, text: text, date: date, status: status === 'past' ? 'past' : 'upcoming' };
      if (imageUrl) item.imageUrl = imageUrl;
      comps.push(item);
      setCompetitions(comps);
      document.getElementById('competition-title').value = '';
      document.getElementById('competition-text').value = '';
      clearCompetitionImage();
      form.reset();
      if (dateInput) dateInput.value = date;
      renderCompetitionsList();
    });
  }

  function initEditCompetitionModal() {
    var modalEl = document.getElementById('modal-edit-competition');
    var saveBtn = document.getElementById('edit-competition-save');
    var editCompetitionImageFile = document.getElementById('edit-competition-image-file');
    var editCompetitionImageUrl = document.getElementById('edit-competition-image-url');
    var editCompetitionImagePreview = document.getElementById('edit-competition-image-preview');
    var editCompetitionImageFilename = document.getElementById('edit-competition-image-filename');
    var editCompetitionImageClear = document.getElementById('edit-competition-image-clear');
    if (!saveBtn || !modalEl) return;
    if (editCompetitionImageFile) {
      editCompetitionImageFile.addEventListener('change', function () {
        var file = this.files && this.files[0];
        if (!file || !file.type.match(/^image\//)) return;
        if (editCompetitionImageUrl) editCompetitionImageUrl.value = '';
        uploadImageToSite(file, 'competition', 1200, 0.8).then(function (result) {
          pendingEditCompetitionImageUrl = result.url;
          pendingEditCompetitionImageDataUrl = null;
          if (editCompetitionImageFilename) editCompetitionImageFilename.textContent = file.name;
          if (editCompetitionImagePreview) {
            editCompetitionImagePreview.innerHTML = '<img src="' + escapeAttr(result.url) + '" alt="" style="max-width:200px;max-height:120px;object-fit:cover;border-radius:8px;">';
          }
          if (editCompetitionImageClear) editCompetitionImageClear.style.display = 'inline';
        }).catch(function () {
          alert('Не удалось загрузить изображение. Запустите сервер (npm start).');
        });
      });
    }
    if (editCompetitionImageClear) editCompetitionImageClear.addEventListener('click', clearEditCompetitionImage);
    saveBtn.addEventListener('click', function () {
      var id = parseInt(document.getElementById('edit-competition-id').value, 10);
      var title = document.getElementById('edit-competition-title').value.trim();
      var text = document.getElementById('edit-competition-text').value.trim();
      var date = document.getElementById('edit-competition-date').value;
      var status = document.getElementById('edit-competition-status').value;
      if (!title || !text || !date) return;
      var comps = getCompetitions();
      var idx = comps.findIndex(function (c) { return c.id === id; });
      if (idx === -1) return;
      var imageUrl = pendingEditCompetitionImageUrl ||
        (editCompetitionImageCleared ? '' : ((editCompetitionImageUrl && editCompetitionImageUrl.value.trim()) || editCompetitionCurrentImageUrl || ''));
      comps[idx] = { id: id, title: title, text: text, date: date, status: status === 'past' ? 'past' : 'upcoming' };
      if (imageUrl) comps[idx].imageUrl = imageUrl;
      setCompetitions(comps);
      renderCompetitionsList();
      if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        var modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
      }
    });
    modalEl.addEventListener('hidden.bs.modal', function () {
      document.getElementById('edit-competition-id').value = '';
      document.getElementById('edit-competition-title').value = '';
      document.getElementById('edit-competition-text').value = '';
      document.getElementById('edit-competition-date').value = '';
      document.getElementById('edit-competition-status').value = 'upcoming';
      clearEditCompetitionImage();
      editCompetitionCurrentImageUrl = null;
    });
  }

  function initPhotoForm() {
    var form = document.getElementById('form-add-photo');
    if (!form) return;
    var photoFile = document.getElementById('photo-file');
    var photoUrl = document.getElementById('photo-url');
    var photoPreview = document.getElementById('photo-preview');
    var photoFilename = document.getElementById('photo-filename');
    var photoClear = document.getElementById('photo-clear');

    function clearPhotoUpload() {
      pendingPhotoDataUrl = null;
      pendingPhotoDataUrlFallback = null;
      pendingPhotoDataUrls = [];
      if (photoFile) photoFile.value = '';
      if (photoUrl) photoUrl.value = '';
      if (photoPreview) photoPreview.innerHTML = '';
      if (photoFilename) photoFilename.textContent = '';
      if (photoClear) photoClear.style.display = 'none';
    }

    if (photoFile) {
      photoFile.addEventListener('change', function () {
        var files = this.files;
        if (!files || !files.length) return;
        if (photoUrl) photoUrl.value = '';
        var imageFiles = [];
        for (var i = 0; i < files.length; i++) {
          if (files[i].type && files[i].type.match(/^image\//)) imageFiles.push(files[i]);
        }
        if (!imageFiles.length) return;
        if (imageFiles.length === 1) {
          saveImageToSite(imageFiles[0], 1200, 0.75).then(function (result) {
            pendingPhotoDataUrl = result.path;
            pendingPhotoDataUrlFallback = result.dataUrl;
            pendingPhotoDataUrls = [];
            if (photoFilename) photoFilename.textContent = imageFiles[0].name;
            if (photoPreview) {
              photoPreview.innerHTML = '<img src="' + escapeAttr(result.dataUrl) + '" alt="" style="max-width:200px;max-height:120px;object-fit:cover;border-radius:8px;">';
            }
            if (photoClear) photoClear.style.display = 'inline';
          }).catch(function () {
            alert('Не удалось обработать изображение.');
          });
          return;
        }
        pendingPhotoDataUrl = null;
        if (photoFilename) photoFilename.textContent = 'Выбрано файлов: ' + imageFiles.length;
        if (photoClear) photoClear.style.display = 'inline';
        var done = 0;
        var total = imageFiles.length;
        pendingPhotoDataUrls = [];
        if (photoPreview) photoPreview.innerHTML = '<span class="text-muted small">Обработка…</span>';
        function processNext() {
          if (done >= total) {
            if (photoPreview && pendingPhotoDataUrls.length) {
              var html = '';
              for (var j = 0; j < pendingPhotoDataUrls.length && j < 12; j++) {
                var item = pendingPhotoDataUrls[j];
                var src = (typeof item === 'object' && item.dataUrl) ? item.dataUrl : item;
                html += '<img src="' + escapeAttr(src) + '" alt="" class="admin-preview-thumb">';
              }
              if (pendingPhotoDataUrls.length > 12) {
                html += '<span class="text-muted small align-self-center">+ ещё ' + (pendingPhotoDataUrls.length - 12) + '</span>';
              }
              photoPreview.innerHTML = '<div class="d-flex flex-wrap gap-2 align-items-center">' + html + '</div>';
            }
            return;
          }
          var file = imageFiles[done];
          saveImageToSite(file, 1200, 0.75).then(function (result) {
            pendingPhotoDataUrls.push({ path: result.path, dataUrl: result.dataUrl });
            done++;
            processNext();
          }).catch(function () {
            done++;
            processNext();
          });
        }
        processNext();
      });
    }
    if (photoClear) photoClear.addEventListener('click', clearPhotoUpload);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var caption = document.getElementById('photo-caption').value.trim();
      var competition = (document.getElementById('photo-competition') && document.getElementById('photo-competition').value) ? document.getElementById('photo-competition').value.trim() : '';
      var photos = getPhotos();
      var origin = typeof location !== 'undefined' && location.origin && (location.origin.startsWith('http://') || location.origin.startsWith('https://')) ? location.origin : null;
      var apiBase = origin || 'http://localhost:3000';

      function uploadOnePhoto(imageBase64, filename, doneCallback) {
        fetch(apiBase + '/api/upload-photo', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ competition: competition, caption: caption, imageBase64: imageBase64, filename: filename || 'photo.jpg' })
        })
          .then(function (r) { return r.ok ? r.json() : r.json().then(function (err) { throw new Error(err.error || r.status); }); })
          .then(function (data) { doneCallback(null, data); })
          .catch(function (err) { doneCallback(err); });
      }

      if (pendingPhotoDataUrls && pendingPhotoDataUrls.length > 0) {
        var id = nextId(photos);
        if (origin) {
          var idx = 0;
          var uploaded = [];
          function next() {
            if (idx >= pendingPhotoDataUrls.length) {
              uploaded.forEach(function (item) {
                photos.push({ id: id++, url: item.url, thumbUrl: item.thumbUrl, caption: caption, competition: competition });
              });
              setPhotos(photos);
              document.getElementById('photo-caption').value = '';
              if (document.getElementById('photo-competition')) document.getElementById('photo-competition').value = '';
              clearPhotoUpload();
              renderPhotosList();
              return;
            }
            var item = pendingPhotoDataUrls[idx];
            var dataUrl = (typeof item === 'object' && item.dataUrl) ? item.dataUrl : item;
            uploadOnePhoto(dataUrl, 'photo-' + idx + '.jpg', function (err, data) {
              if (err) {
                alert('Не удалось загрузить фото на сервер: ' + (err.message || err));
                idx++;
                next();
                return;
              }
              uploaded.push({ url: data.url, thumbUrl: data.thumbUrl });
              idx++;
              next();
            });
          }
          next();
          return;
        }
        for (var i = 0; i < pendingPhotoDataUrls.length; i++) {
          var item = pendingPhotoDataUrls[i];
          var url = (typeof item === 'object' && item.path) ? item.path : item;
          var dataUrl = (typeof item === 'object' && item.dataUrl) ? item.dataUrl : undefined;
          photos.push({ id: id + i, url: url, dataUrl: dataUrl, caption: caption, competition: competition });
        }
        setPhotos(photos);
        document.getElementById('photo-caption').value = '';
        if (document.getElementById('photo-competition')) document.getElementById('photo-competition').value = '';
        clearPhotoUpload();
        renderPhotosList();
        return;
      }
      if (pendingPhotoDataUrl && origin) {
        var singleId = nextId(photos);
        var base64 = pendingPhotoDataUrlFallback || pendingPhotoDataUrl;
        if (base64 && base64.indexOf('data:image') === 0) {
          uploadOnePhoto(base64, 'photo.jpg', function (err, data) {
            if (err) {
              alert('Не удалось загрузить фото на сервер: ' + (err.message || err));
              return;
            }
            photos.push({ id: singleId, url: data.url, thumbUrl: data.thumbUrl, caption: caption, competition: competition });
            setPhotos(photos);
            document.getElementById('photo-caption').value = '';
            if (document.getElementById('photo-competition')) document.getElementById('photo-competition').value = '';
            clearPhotoUpload();
            renderPhotosList();
          });
          return;
        }
      }
      var url = pendingPhotoDataUrl || (photoUrl && photoUrl.value.trim()) || '';
      if (!url) {
        alert('Укажите URL изображения или выберите файлы.');
        return;
      }
      var id = nextId(photos);
      photos.push({ id: id, url: url, dataUrl: pendingPhotoDataUrlFallback || undefined, caption: caption, competition: competition });
      setPhotos(photos);
      document.getElementById('photo-caption').value = '';
      if (document.getElementById('photo-competition')) document.getElementById('photo-competition').value = '';
      clearPhotoUpload();
      renderPhotosList();
    });
  }

  function getFileExtension(name) {
    if (!name) return '';
    var i = name.lastIndexOf('.');
    return i >= 0 ? name.slice(i + 1).toUpperCase() : '';
  }

  function initDocumentForm() {
    var form = document.getElementById('form-add-document');
    if (!form) return;
    var docFile = document.getElementById('doc-file');
    var docUrl = document.getElementById('doc-url');
    var docMeta = document.getElementById('doc-meta');
    var docFilename = document.getElementById('doc-filename');
    var docClear = document.getElementById('doc-clear');

    function clearDocumentUpload() {
      pendingDocumentDataUrl = null;
      pendingDocumentMeta = null;
      if (docFile) docFile.value = '';
      if (docUrl) docUrl.value = '';
      if (docFilename) docFilename.textContent = '';
      if (docClear) docClear.style.display = 'none';
    }

    if (docFile) {
      docFile.addEventListener('change', function () {
        var file = this.files && this.files[0];
        if (!file) return;
        if (docUrl) docUrl.value = '';
        var reader = new FileReader();
        reader.onload = function (e) {
          pendingDocumentDataUrl = e.target.result;
          var ext = getFileExtension(file.name);
          pendingDocumentMeta = ext || 'PDF';
          if (docMeta) docMeta.value = pendingDocumentMeta;
          if (docFilename) docFilename.textContent = file.name;
          if (docClear) docClear.style.display = 'inline';
        };
        reader.onerror = function () {
          alert('Не удалось прочитать файл.');
        };
        reader.readAsDataURL(file);
      });
    }
    if (docClear) docClear.addEventListener('click', function () {
      clearDocumentUpload();
      if (docMeta) docMeta.value = '';
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var titleEl = document.getElementById('doc-title');
      var title = titleEl && titleEl.value.trim();
      var url = pendingDocumentDataUrl || (docUrl && docUrl.value.trim()) || '';
      var meta = (docMeta && docMeta.value.trim()) || pendingDocumentMeta || 'PDF';
      if (!title) return;
      if (!url) {
        alert('Укажите ссылку на файл или загрузите документ с компьютера.');
        return;
      }
      var docs = getDocuments();
      if (!Array.isArray(docs)) docs = [];
      var id = nextId(docs);
      docs.push({ id: id, title: title, url: url, meta: meta });
      try {
        setDocuments(docs);
      } catch (err) {
        if (err && err.name === 'QuotaExceededError') {
          alert('Не удалось сохранить документ: превышен лимит хранилища. Попробуйте документ меньшего размера или укажите ссылку вместо загрузки файла.');
        } else {
          alert('Ошибка при сохранении: ' + (err && err.message ? err.message : 'неизвестная ошибка'));
        }
        return;
      }
      if (titleEl) titleEl.value = '';
      if (docMeta) docMeta.value = '';
      clearDocumentUpload();
      renderDocumentsList();
    });
  }

  function initEditDocumentModal() {
    var modalEl = document.getElementById('modal-edit-document');
    var saveBtn = document.getElementById('edit-doc-save');
    var editDocFile = document.getElementById('edit-doc-file');
    var editDocUrl = document.getElementById('edit-doc-url');
    var editDocMeta = document.getElementById('edit-doc-meta');
    var editDocFilename = document.getElementById('edit-doc-filename');
    var editDocClear = document.getElementById('edit-doc-clear');
    if (!saveBtn || !modalEl) return;

    function clearEditDocumentUpload() {
      pendingEditDocumentDataUrl = null;
      pendingEditDocumentMeta = null;
      if (editDocFile) editDocFile.value = '';
      if (editDocFilename) editDocFilename.textContent = '';
      if (editDocClear) editDocClear.style.display = 'none';
    }

    if (editDocFile) {
      editDocFile.addEventListener('change', function () {
        var file = this.files && this.files[0];
        if (!file) return;
        if (editDocUrl) editDocUrl.value = '';
        var reader = new FileReader();
        reader.onload = function (e) {
          pendingEditDocumentDataUrl = e.target.result;
          var ext = getFileExtension(file.name);
          pendingEditDocumentMeta = ext || 'PDF';
          if (editDocMeta) editDocMeta.value = pendingEditDocumentMeta;
          if (editDocFilename) editDocFilename.textContent = file.name;
          if (editDocClear) editDocClear.style.display = 'inline';
        };
        reader.onerror = function () {
          alert('Не удалось прочитать файл.');
        };
        reader.readAsDataURL(file);
      });
    }
    if (editDocClear) editDocClear.addEventListener('click', function () {
      clearEditDocumentUpload();
    });

    saveBtn.addEventListener('click', function () {
      var id = parseInt(document.getElementById('edit-doc-id').value, 10);
      var title = document.getElementById('edit-doc-title').value.trim();
      if (!title) return;
      var docs = getDocuments();
      var idx = docs.findIndex(function (d) { return d.id === id; });
      if (idx === -1) return;
      var url = pendingEditDocumentDataUrl || (editDocUrl && editDocUrl.value.trim()) || editDocumentCurrentUrl || '';
      var meta = (editDocMeta && editDocMeta.value.trim()) || pendingEditDocumentMeta || docs[idx].meta || 'PDF';
      if (!url) {
        alert('Укажите ссылку, загрузите новый файл или оставьте текущий документ (не удаляйте URL и не нажимайте «Убрать» для текущего файла).');
        return;
      }
      docs[idx] = { id: id, title: title, url: url, meta: meta };
      setDocuments(docs);
      renderDocumentsList();
      if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        var modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
      }
    });

    modalEl.addEventListener('hidden.bs.modal', function () {
      document.getElementById('edit-doc-id').value = '';
      document.getElementById('edit-doc-title').value = '';
      document.getElementById('edit-doc-url').value = '';
      document.getElementById('edit-doc-meta').value = '';
      clearEditDocumentUpload();
      editDocumentCurrentUrl = null;
    });
  }

  function initFriendsForm() {
    var form = document.getElementById('form-add-friend');
    if (!form) return;
    var fileInput = document.getElementById('friend-icon-file');
    var filenameEl = document.getElementById('friend-icon-filename');
    var clearBtn = document.getElementById('friend-icon-clear');
    var previewEl = document.getElementById('friend-icon-preview');

    function clearFriendIcon() {
      pendingFriendIconUrl = null;
      if (fileInput) fileInput.value = '';
      if (filenameEl) filenameEl.textContent = '';
      if (clearBtn) clearBtn.style.display = 'none';
      if (previewEl) previewEl.innerHTML = '';
    }

    if (fileInput) {
      fileInput.addEventListener('change', function () {
        var file = this.files && this.files[0];
        if (!file) return;
        if (filenameEl) filenameEl.textContent = 'Загрузка…';
        uploadImageToSite(file, 'friend')
          .then(function (res) {
            pendingFriendIconUrl = res && res.url ? res.url : null;
            if (filenameEl) filenameEl.textContent = file.name;
            if (clearBtn) clearBtn.style.display = 'inline';
            if (previewEl && pendingFriendIconUrl) {
              previewEl.innerHTML = '<img src="' + escapeAttr(pendingFriendIconUrl) + '" alt="" style="max-width:80px;max-height:80px;object-fit:cover;border-radius:50%;">';
            }
          })
          .catch(function (err) {
            if (filenameEl) filenameEl.textContent = '';
            alert('Не удалось загрузить иконку: ' + (err && err.message ? err.message : 'ошибка'));
          });
      });
    }
    if (clearBtn) clearBtn.addEventListener('click', clearFriendIcon);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var titleEl = document.getElementById('friend-title');
      var urlEl = document.getElementById('friend-url');
      var title = titleEl && titleEl.value.trim();
      var url = urlEl && urlEl.value.trim();
      if (!title || !url) {
        alert('Заполните название и ссылку.');
        return;
      }
      var friends = getFriends();
      if (!Array.isArray(friends)) friends = [];
      var id = nextId(friends);
      friends.push({ id: id, title: title, url: url, iconUrl: pendingFriendIconUrl || undefined });
      setFriends(friends);
      if (titleEl) titleEl.value = '';
      if (urlEl) urlEl.value = '';
      clearFriendIcon();
      renderFriendsList();
    });
  }

  function initEditFriendModal() {
    var modalEl = document.getElementById('modal-edit-friend');
    var saveBtn = document.getElementById('edit-friend-save');
    var fileInput = document.getElementById('edit-friend-icon-file');
    var filenameEl = document.getElementById('edit-friend-icon-filename');
    var clearBtn = document.getElementById('edit-friend-icon-clear');
    var previewEl = document.getElementById('edit-friend-icon-preview');
    if (!saveBtn || !modalEl) return;

    function clearEditFriendIcon() {
      pendingEditFriendIconUrl = null;
      editFriendIconCleared = true;
      if (fileInput) fileInput.value = '';
      if (filenameEl) filenameEl.textContent = '';
      if (clearBtn) clearBtn.style.display = 'none';
      if (previewEl) previewEl.innerHTML = '';
    }

    if (fileInput) {
      fileInput.addEventListener('change', function () {
        var file = this.files && this.files[0];
        if (!file) return;
        if (filenameEl) filenameEl.textContent = 'Загрузка…';
        uploadImageToSite(file, 'friend')
          .then(function (res) {
            pendingEditFriendIconUrl = res && res.url ? res.url : null;
            editFriendIconCleared = false;
            if (filenameEl) filenameEl.textContent = file.name;
            if (clearBtn) clearBtn.style.display = 'inline';
            if (previewEl && pendingEditFriendIconUrl) {
              previewEl.innerHTML = '<img src="' + escapeAttr(pendingEditFriendIconUrl) + '" alt="" style="max-width:80px;max-height:80px;object-fit:cover;border-radius:50%;">';
            }
          })
          .catch(function (err) {
            if (filenameEl) filenameEl.textContent = '';
            alert('Не удалось загрузить иконку: ' + (err && err.message ? err.message : 'ошибка'));
          });
      });
    }
    if (clearBtn) clearBtn.addEventListener('click', clearEditFriendIcon);

    saveBtn.addEventListener('click', function () {
      var id = parseInt(document.getElementById('edit-friend-id').value, 10);
      var title = document.getElementById('edit-friend-title').value.trim();
      var url = document.getElementById('edit-friend-url').value.trim();
      if (!title || !url) {
        alert('Заполните название и ссылку.');
        return;
      }
      var friends = getFriends();
      var idx = friends.findIndex(function (f) { return f.id === id; });
      if (idx < 0) return;
      var iconUrl = editFriendIconCleared ? '' : (pendingEditFriendIconUrl || editFriendCurrentIconUrl || '');
      friends[idx] = { id: id, title: title, url: url, iconUrl: iconUrl || undefined };
      setFriends(friends);
      renderFriendsList();
      if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        var modal = bootstrap.Modal.getInstance(modalEl);
        if (modal) modal.hide();
      }
    });

    modalEl.addEventListener('hidden.bs.modal', function () {
      document.getElementById('edit-friend-id').value = '';
      document.getElementById('edit-friend-title').value = '';
      document.getElementById('edit-friend-url').value = '';
      clearEditFriendIcon();
      pendingEditFriendIconUrl = null;
      editFriendCurrentIconUrl = null;
      editFriendIconCleared = false;
    });
  }

  function restoreAdminTab() {
    var savedId = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(ADMIN_ACTIVE_TAB_KEY) : null;
    if (!savedId) return;
    var tabBtn = document.getElementById(savedId);
    if (!tabBtn || typeof bootstrap === 'undefined' || !bootstrap.Tab) return;
    try {
      var tab = bootstrap.Tab.getOrCreateInstance(tabBtn);
      tab.show();
    } catch (e) {}
  }

  function initAdminTabPersistence() {
    var tabsEl = document.getElementById('admin-tabs');
    if (!tabsEl) return;
    tabsEl.addEventListener('shown.bs.tab', function (e) {
      if (e.target && e.target.id && typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(ADMIN_ACTIVE_TAB_KEY, e.target.id);
      }
    });
  }

  function init() {
    if (isAuthenticated()) {
      showScreen(false);
    } else {
      showScreen(true);
    }
    initLogin();
    initLogout();
    initAdminTabPersistence();
    initEditNewsModal();
    initNewsForm();
    initNewsExport();
    initCompetitionsForm();
    initEditCompetitionModal();
    initPhotoForm();
    initDocumentForm();
    initEditDocumentModal();
    initFriendsForm();
    initEditFriendModal();
    loadNewsFromServer().then(function (arr) {
      if (Array.isArray(arr)) {
        setNewsOnlyLocal(arr);
        renderNewsList();
      }
    });
    loadCompetitionsFromServer().then(function (arr) {
      if (Array.isArray(arr)) {
        setCompetitionsOnlyLocal(arr);
        renderCompetitionsList();
      }
    });
    loadDocumentsFromServer().then(function (arr) {
      if (Array.isArray(arr) && arr.length > 0) {
        setDocumentsOnlyLocal(arr);
      }
      renderDocumentsList();
    });
    loadFriendsFromServer().then(function (arr) {
      if (Array.isArray(arr) && arr.length > 0) {
        setFriendsOnlyLocal(arr);
      }
      renderFriendsList();
    });
    loadPhotosFromServer().then(function (arr) {
      if (Array.isArray(arr) && arr.length > 0) {
        setPhotosOnlyLocal(arr);
      }
      renderPhotosList();
    });
    loadPeopleFromServer().then(function (arr) {
      if (Array.isArray(arr)) {
        setPeopleOnlyLocal(arr);
      }
      renderPeopleList();
    });
  }

  function initNewsExport() {
    var btn = document.getElementById('news-export-btn');
    if (btn) {
      btn.addEventListener('click', function () {
        var news = getNews();
        var json = JSON.stringify(news, null, 2);
        var blob = new Blob([json], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'news.json';
        a.click();
        URL.revokeObjectURL(a.href);
      });
    }
    var btnJs = document.getElementById('news-export-js-btn');
    if (btnJs) {
      btnJs.addEventListener('click', function () {
        var news = getNews();
        var js = 'window.FDSO_NEWS = ' + JSON.stringify(news) + ';';
        var blob = new Blob([js], { type: 'application/javascript' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'news-data.js';
        a.click();
        URL.revokeObjectURL(a.href);
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
