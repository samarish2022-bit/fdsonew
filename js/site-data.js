/**
 * Вывод на главную страницу данных из панели администратора.
 * Новости загружаются из data/news.json, соревнования из data/competitions.json, документы из data/documents.json — один источник для всех при открытии через сервер.
 * Фотографии загружаются из data/photos.json (или GET /api/photos); файлы хранятся в images/uploads/photos/<соревнование>/.
 */

(function () {
  'use strict';

  var KEY_NEWS = 'fdso_admin_news';
  var KEY_COMPETITIONS = 'fdso_admin_competitions';
  var KEY_PHOTOS = 'fdso_admin_photos';
  var KEY_DOCUMENTS = 'fdso_admin_documents';
  var KEY_FRIENDS = 'fdso_admin_friends';
  var scriptSrc = typeof document !== 'undefined' && document.currentScript && document.currentScript.src;
  var basePath = scriptSrc ? scriptSrc.replace(/\/js\/[^/]*$/, '/') : '';
  var NEWS_FILE = basePath ? basePath + 'data/news.json' : 'data/news.json';
  var COMPETITIONS_FILE = basePath ? basePath + 'data/competitions.json' : 'data/competitions.json';
  var DOCUMENTS_FILE = basePath ? basePath + 'data/documents.json' : 'data/documents.json';
  var FRIENDS_FILE = basePath ? basePath + 'data/friends.json' : 'data/friends.json';
  var PHOTOS_FILE = basePath ? basePath + 'data/photos.json' : 'data/photos.json';

  var cachedNewsFromFile = null;
  var cachedCompetitionsFromFile = null;
  var cachedDocumentsFromFile = null;
  var cachedFriendsFromFile = null;
  var cachedPhotosFromFile = null;

  /**
   * Извлекает массив новостей из ответа (поддержка [] и { news: [] }).
   */
  function parseNewsData(data) {
    if (Array.isArray(data)) return data;
    if (data && typeof data === 'object' && Array.isArray(data.news)) return data.news;
    return [];
  }

  /**
   * Загружает новости с сайта. При открытии по адресу сервера — GET /api/news (надёжно).
   * Иначе — data/news.json, затем fallback на window.FDSO_NEWS или localStorage.
   */
  function loadNewsFromFile() {
    var apiUrl = typeof location !== 'undefined' && location.origin &&
      (location.origin.startsWith('http://') || location.origin.startsWith('https://'))
      ? location.origin + '/api/news'
      : null;

    function applyData(data) {
      var arr = parseNewsData(data);
      cachedNewsFromFile = arr;
      return cachedNewsFromFile;
    }

    if (apiUrl) {
      return fetch(apiUrl + '?t=' + Date.now())
        .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('not ok')); })
        .then(applyData)
        .catch(function () {
          return fetch(NEWS_FILE + '?t=' + Date.now())
            .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('not ok')); })
            .then(applyData);
        })
        .catch(function () {
          if (typeof window !== 'undefined' && window.FDSO_NEWS && Array.isArray(window.FDSO_NEWS) && window.FDSO_NEWS.length > 0) {
            cachedNewsFromFile = window.FDSO_NEWS;
          } else {
            cachedNewsFromFile = null;
          }
          return cachedNewsFromFile;
        });
    }

    return fetch(NEWS_FILE + '?t=' + Date.now())
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('not ok')); })
      .then(applyData)
      .catch(function () {
        if (typeof window !== 'undefined' && window.FDSO_NEWS && Array.isArray(window.FDSO_NEWS) && window.FDSO_NEWS.length > 0) {
          cachedNewsFromFile = window.FDSO_NEWS;
          return Promise.resolve();
        }
        return new Promise(function (resolve) {
          var script = document.createElement('script');
          script.src = basePath + 'data/news-data.js?t=' + Date.now();
          script.onload = function () {
            if (window.FDSO_NEWS && Array.isArray(window.FDSO_NEWS) && window.FDSO_NEWS.length > 0) {
              cachedNewsFromFile = window.FDSO_NEWS;
            } else {
              cachedNewsFromFile = null;
            }
            resolve();
          };
          script.onerror = function () {
            cachedNewsFromFile = null;
            resolve();
          };
          document.head.appendChild(script);
        });
      });
  }

  function getNews() {
    if (cachedNewsFromFile !== null && Array.isArray(cachedNewsFromFile)) return cachedNewsFromFile;
    try {
      var raw = localStorage.getItem(KEY_NEWS);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * Загружает соревнования с сайта (GET /api/competitions или data/competitions.json).
   */
  function loadCompetitionsFromFile() {
    var apiUrl = typeof location !== 'undefined' && location.origin &&
      (location.origin.startsWith('http://') || location.origin.startsWith('https://'))
      ? location.origin + '/api/competitions'
      : null;
    function applyData(data) {
      var arr = Array.isArray(data) ? data : (data && Array.isArray(data.competitions) ? data.competitions : []);
      cachedCompetitionsFromFile = arr;
      return cachedCompetitionsFromFile;
    }
    if (apiUrl) {
      return fetch(apiUrl + '?t=' + Date.now())
        .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('not ok')); })
        .then(applyData)
        .catch(function () {
          return fetch(COMPETITIONS_FILE + '?t=' + Date.now())
            .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('not ok')); })
            .then(applyData);
        })
        .catch(function () {
          cachedCompetitionsFromFile = null;
          return cachedCompetitionsFromFile;
        });
    }
    return fetch(COMPETITIONS_FILE + '?t=' + Date.now())
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('not ok')); })
      .then(applyData)
      .catch(function () {
        cachedCompetitionsFromFile = null;
        return cachedCompetitionsFromFile;
      });
  }

  function getCompetitions() {
    if (cachedCompetitionsFromFile !== null && Array.isArray(cachedCompetitionsFromFile)) return cachedCompetitionsFromFile;
    try {
      var raw = localStorage.getItem(KEY_COMPETITIONS);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function getAllCompetitionsSorted() {
    var list = (Array.isArray(getCompetitions()) ? getCompetitions() : []).map(function (item) {
      return {
        title: item && (item.title != null) ? String(item.title) : '',
        text: item && (item.text != null) ? String(item.text) : '',
        date: item && (item.date != null) ? String(item.date) : '',
        status: item && (item.status === 'past' || item.status === 'upcoming') ? item.status : 'upcoming',
        imageUrl: item && item.imageUrl || null,
        imageDataUrl: item && item.imageDataUrl || null
      };
    }).filter(function (item) { return item.title || item.text; });
    list.sort(function (a, b) {
      var ta = new Date(a.date).getTime();
      var tb = new Date(b.date).getTime();
      if (isNaN(ta)) return 1;
      if (isNaN(tb)) return -1;
      return tb - ta;
    });
    return list;
  }

  function getAllNewsSorted() {
    var admin = getNews();
    var combined = (Array.isArray(admin) ? admin : []).map(function (item) {
      return {
        title: item && (item.title != null) ? String(item.title) : '',
        text: item && (item.text != null) ? String(item.text) : '',
        date: item && (item.date != null) ? String(item.date) : '',
        imageUrl: item && item.imageUrl || null,
        imageDataUrl: item && item.imageDataUrl || null,
        icon: 'file-text'
      };
    }).filter(function (item) { return item.title || item.text; });
    combined.sort(function (a, b) {
      var ta = new Date(a.date).getTime();
      var tb = new Date(b.date).getTime();
      if (isNaN(ta)) return 1;
      if (isNaN(tb)) return -1;
      return tb - ta;
    });
    return combined;
  }

  /**
   * Загружает фотографии с сайта (GET /api/photos или data/photos.json).
   */
  function loadPhotosFromFile() {
    var apiUrl = typeof location !== 'undefined' && location.origin &&
      (location.origin.startsWith('http://') || location.origin.startsWith('https://'))
      ? location.origin + '/api/photos'
      : null;
    function applyData(data) {
      var arr = Array.isArray(data) ? data : (data && Array.isArray(data.photos) ? data.photos : []);
      cachedPhotosFromFile = arr;
      return cachedPhotosFromFile;
    }
    if (apiUrl) {
      return fetch(apiUrl)
        .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('not ok')); })
        .then(applyData)
        .catch(function () {
          return fetch(PHOTOS_FILE + '?t=' + Date.now())
            .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('not ok')); })
            .then(applyData);
        })
        .catch(function () {
          cachedPhotosFromFile = null;
          return cachedPhotosFromFile;
        });
    }
    return fetch(PHOTOS_FILE + '?t=' + Date.now())
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('not ok')); })
      .then(applyData)
      .catch(function () {
        cachedPhotosFromFile = null;
        return cachedPhotosFromFile;
      });
  }

  /** Фотографии: приоритет — данные с сервера (data/photos.json), иначе localStorage. */
  function getPhotos() {
    if (cachedPhotosFromFile !== null && Array.isArray(cachedPhotosFromFile)) return cachedPhotosFromFile;
    try {
      var raw = localStorage.getItem(KEY_PHOTOS);
      var data = raw ? JSON.parse(raw) : null;
      return Array.isArray(data) ? data : [];
    } catch (e) {
      return [];
    }
  }

  /**
   * Загружает документы с сайта (GET /api/documents или data/documents.json).
   */
  function loadDocumentsFromFile() {
    var apiUrl = typeof location !== 'undefined' && location.origin &&
      (location.origin.startsWith('http://') || location.origin.startsWith('https://'))
      ? location.origin + '/api/documents'
      : null;
    function applyData(data) {
      var arr = Array.isArray(data) ? data : (data && Array.isArray(data.documents) ? data.documents : []);
      cachedDocumentsFromFile = arr;
      return cachedDocumentsFromFile;
    }
    if (apiUrl) {
      return fetch(apiUrl + '?t=' + Date.now())
        .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('not ok')); })
        .then(applyData)
        .catch(function () {
          return fetch(DOCUMENTS_FILE + '?t=' + Date.now())
            .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('not ok')); })
            .then(applyData);
        })
        .catch(function () {
          cachedDocumentsFromFile = null;
          return cachedDocumentsFromFile;
        });
    }
    return fetch(DOCUMENTS_FILE + '?t=' + Date.now())
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('not ok')); })
      .then(applyData)
      .catch(function () {
        cachedDocumentsFromFile = null;
        return cachedDocumentsFromFile;
      });
  }

  function getDocuments() {
    if (cachedDocumentsFromFile !== null && Array.isArray(cachedDocumentsFromFile)) return cachedDocumentsFromFile;
    try {
      var raw = localStorage.getItem(KEY_DOCUMENTS);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
  }

  function loadFriendsFromFile() {
    var apiUrl = typeof location !== 'undefined' && location.origin &&
      (location.origin.startsWith('http://') || location.origin.startsWith('https://'))
      ? location.origin + '/api/friends'
      : null;
    function applyData(data) {
      var arr = Array.isArray(data) ? data : (data && Array.isArray(data.friends) ? data.friends : []);
      cachedFriendsFromFile = arr;
      return cachedFriendsFromFile;
    }
    if (apiUrl) {
      return fetch(apiUrl + '?t=' + Date.now())
        .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('not ok')); })
        .then(applyData)
        .catch(function () {
          return fetch(FRIENDS_FILE + '?t=' + Date.now())
            .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('not ok')); })
            .then(applyData);
        })
        .catch(function () {
          cachedFriendsFromFile = null;
          return cachedFriendsFromFile;
        });
    }
    return fetch(FRIENDS_FILE + '?t=' + Date.now())
      .then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('not ok')); })
      .then(applyData)
      .catch(function () {
        cachedFriendsFromFile = null;
        return cachedFriendsFromFile;
      });
  }

  function getFriends() {
    if (cachedFriendsFromFile !== null && Array.isArray(cachedFriendsFromFile)) return cachedFriendsFromFile;
    try {
      var raw = localStorage.getItem(KEY_FRIENDS);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    } catch (e) {
      return [];
    }
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

  function formatDate(str) {
    if (!str) return '';
    var d = new Date(str);
    if (isNaN(d.getTime())) return str;
    var months = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
    return d.getDate() + ' ' + months[d.getMonth()] + ' ' + d.getFullYear();
  }

  function getDartTargetSvg() {
    var cx = 24;
    var cy = 24;
    var r = 22;
    var segments = '';
    for (var i = 0; i < 20; i++) {
      var a1 = (i * 18) * Math.PI / 180;
      var a2 = ((i + 1) * 18) * Math.PI / 180;
      var x1 = cx + r * Math.cos(a1);
      var y1 = cy + r * Math.sin(a1);
      var x2 = cx + r * Math.cos(a2);
      var y2 = cy + r * Math.sin(a2);
      var fill = (i % 2 === 0) ? '#1d1d1f' : '#e8e8ed';
      segments += '<polygon points="' + cx + ',' + cy + ' ' + x1.toFixed(2) + ',' + y1.toFixed(2) + ' ' + x2.toFixed(2) + ',' + y2.toFixed(2) + '" fill="' + fill + '"/>';
    }
    return '<svg class="news-card-dart-target" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">' +
      segments +
      '<circle cx="' + cx + '" cy="' + cy + '" r="22" fill="none" stroke="#1d1d1f" stroke-width="1.2"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="18" fill="none" stroke="#1d1d1f" stroke-width="0.8"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="12" fill="none" stroke="#1d1d1f" stroke-width="0.8"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="8" fill="#2e7d32"/>' +
      '<circle cx="' + cx + '" cy="' + cy + '" r="3.5" fill="#c62828"/>' +
      '</svg>';
  }

  function renderAdminNews() {
    var row = document.getElementById('news-row');
    if (!row) return;
    row.innerHTML = '';
    var path = typeof window.location !== 'undefined' ? (window.location.pathname || '') : '';
    var isNewsPage = path.indexOf('news') !== -1;
    var allNews = getAllNewsSorted();
    var news = isNewsPage ? allNews : allNews.slice(0, NEWS_HOME_LIMIT);
    if (!news.length) {
      row.innerHTML = '<div class="col-12"><p class="text-muted">Пока нет новостей. Добавьте их в панели администратора.</p></div>';
      var moreWrap = document.getElementById('news-more-wrap');
      if (moreWrap) moreWrap.innerHTML = '';
      return;
    }
    news.forEach(function (item) {
      var col = document.createElement('article');
      col.className = 'col-12 col-md-6 col-lg-4';
      var imageBlock = '';
      if (item.imageUrl) {
        imageBlock =
          '<div class="news-card-image-wrap">' +
          '<img src="' + escapeAttr(item.imageUrl) + '" alt="" class="news-card-image" loading="lazy">' +
          '</div>';
      }
      col.innerHTML =
        '<div class="news-card' + (item.imageUrl ? ' news-card-has-image' : '') + '">' +
        imageBlock +
        '<div class="news-card-icon">' + getDartTargetSvg() + '</div>' +
        '<h3 class="news-card-title">' + escapeHtml(item.title) + '</h3>' +
        '<p class="news-card-text">' + sanitizeNewsHtml((item.text || '').replace(/\n/g, '<br>')) + '</p>' +
        '<button type="button" class="news-card-toggle" aria-expanded="false">Читать полностью</button>' +
        '<time class="news-card-date" datetime="' + escapeAttr(item.date) + '">' + formatDate(item.date) + '</time>' +
        '</div>';
      var newsImg = col.querySelector('.news-card-image');
      if (newsImg && item.imageDataUrl) {
        newsImg.onerror = function () { this.src = item.imageDataUrl; };
      }
      row.appendChild(col);
    });
    bindNewsToggleButtons();
    hideReadMoreIfNotNeeded();
    var moreWrap = document.getElementById('news-more-wrap');
    if (moreWrap && !isNewsPage && allNews.length > 0) {
      moreWrap.innerHTML = '<a href="' + escapeAttr(NEWS_PAGE) + '" class="btn btn-outline-primary">Все новости</a>';
    } else if (moreWrap) {
      moreWrap.innerHTML = '';
    }
  }

  function hideReadMoreIfNotNeeded() {
    document.querySelectorAll('.news-card').forEach(function (card) {
      var textEl = card.querySelector('.news-card-text');
      var btn = card.querySelector('.news-card-toggle');
      if (!textEl || !btn) return;
      if (textEl.scrollHeight <= textEl.clientHeight) {
        btn.classList.add('news-card-toggle-hidden');
      } else {
        btn.classList.remove('news-card-toggle-hidden');
      }
    });
  }

  function hideCompetitionReadMoreIfNotNeeded() {
    document.querySelectorAll('.competition-card').forEach(function (card) {
      var textEl = card.querySelector('.competition-card-text');
      var btn = card.querySelector('.competition-card-toggle');
      if (!textEl || !btn) return;
      if (textEl.scrollHeight <= textEl.clientHeight) {
        btn.classList.add('competition-card-toggle-hidden');
      } else {
        btn.classList.remove('competition-card-toggle-hidden');
      }
    });
  }

  function bindCompetitionToggleButtons() {
    document.querySelectorAll('.competition-card-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var card = btn.closest('.competition-card');
        if (!card) return;
        var isExpanded = card.classList.contains('competition-card-expanded');
        if (isExpanded) {
          card.classList.remove('competition-card-expanded');
          btn.textContent = 'Читать полностью';
          btn.setAttribute('aria-expanded', 'false');
        } else {
          card.classList.add('competition-card-expanded');
          btn.textContent = 'Свернуть';
          btn.setAttribute('aria-expanded', 'true');
        }
      });
    });
  }

  function bindNewsToggleButtons() {
    document.querySelectorAll('.news-card-toggle').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var card = btn.closest('.news-card');
        if (!card) return;
        var isExpanded = card.classList.contains('news-card-expanded');
        if (isExpanded) {
          card.classList.remove('news-card-expanded');
          btn.textContent = 'Читать полностью';
          btn.setAttribute('aria-expanded', 'false');
        } else {
          card.classList.add('news-card-expanded');
          btn.textContent = 'Свернуть';
          btn.setAttribute('aria-expanded', 'true');
        }
      });
    });
  }

  function renderCompetitions() {
    var row = document.getElementById('competitions-row');
    if (!row) return;
    row.innerHTML = '';
    var path = typeof window.location !== 'undefined' ? (window.location.pathname || '') : '';
    var isCompetitionsPage = path.indexOf('competitions') !== -1;
    var allList = getAllCompetitionsSorted();
    var list = isCompetitionsPage ? allList : allList.slice(0, COMPETITIONS_HOME_LIMIT);
    if (!list.length) {
      row.innerHTML = '<div class="col-12"><p class="text-muted">Пока нет соревнований. Добавьте их в панели администратора.</p></div>';
      var moreWrap = document.getElementById('competitions-more-wrap');
      if (moreWrap) moreWrap.innerHTML = '';
      return;
    }
    list.forEach(function (item) {
      var badgeClass = item.status === 'past' ? 'competition-card-badge-past' : 'competition-card-badge-upcoming';
      var badgeText = item.status === 'past' ? 'Завершён' : 'Скоро';
      var imageBlock = '';
      if (item.imageUrl) {
        imageBlock =
          '<div class="competition-card-image-wrap">' +
          '<img src="' + escapeAttr(item.imageUrl) + '" alt="" class="competition-card-image" loading="lazy">' +
          '</div>';
      }
      var hasImage = !!item.imageUrl;
      var col = document.createElement('article');
      col.className = 'col-12 col-md-6 col-lg-4';
      col.innerHTML =
        '<div class="competition-card' + (hasImage ? ' competition-card-has-image' : '') + '">' +
        imageBlock +
        '<div class="competition-card-date">' +
        '<i data-lucide="calendar" aria-hidden="true"></i>' +
        '<time datetime="' + escapeAttr(item.date) + '">' + formatDate(item.date) + '</time>' +
        '</div>' +
        '<h3 class="competition-card-title">' + escapeHtml(item.title) + '</h3>' +
        '<p class="competition-card-text">' + escapeHtml(item.text) + '</p>' +
        '<button type="button" class="competition-card-toggle" aria-expanded="false">Читать полностью</button>' +
        '<span class="competition-card-badge ' + badgeClass + '">' + escapeHtml(badgeText) + '</span>' +
        '</div>';
      var cardImg = col.querySelector('.competition-card-image');
      if (cardImg && item.imageDataUrl) {
        cardImg.onerror = function () { this.src = item.imageDataUrl; };
      }
      row.appendChild(col);
    });
    bindCompetitionToggleButtons();
    hideCompetitionReadMoreIfNotNeeded();
    var moreWrap = document.getElementById('competitions-more-wrap');
    if (moreWrap && !isCompetitionsPage && allList.length > 0) {
      moreWrap.innerHTML = '<a href="' + escapeAttr(COMPETITIONS_PAGE) + '" class="btn btn-outline-primary">Все соревнования</a>';
    } else if (moreWrap) {
      moreWrap.innerHTML = '';
    }
    if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
      lucide.createIcons();
    }
  }

  var PHOTO_GALLERY_PAGE = 'gallery.html';
  var PHOTO_HOME_LIMIT = 5;
  var NEWS_PAGE = 'news.html';
  var NEWS_HOME_LIMIT = 3;
  var COMPETITIONS_PAGE = 'competitions.html';
  var COMPETITIONS_HOME_LIMIT = 3;

  function renderPhotoItem(item, wrapClass, photoIndex) {
    var wrap = document.createElement('div');
    wrap.className = wrapClass || 'photo-gallery-item animate-item';
    if (typeof photoIndex === 'number') wrap.setAttribute('data-photo-index', String(photoIndex));
    var imgSrc = item.thumbUrl || item.url;
    wrap.innerHTML =
      '<a href="' + escapeAttr(item.url) + '" class="photo-card" target="_blank" rel="noopener">' +
      '<img src="' + escapeAttr(imgSrc) + '" alt="' + escapeAttr(item.caption || '') + '" loading="lazy" decoding="async">' +
      '<span class="photo-card-caption">' + escapeHtml(item.caption || 'Фото') + '</span>' +
      '</a>';
    var img = wrap.querySelector('img');
    if (img) {
      if (item.dataUrl) img.onerror = function () { this.src = item.dataUrl; };
      else if (item.thumbUrl && item.url) img.onerror = function () { this.src = item.url; };
    }
    return wrap;
  }

  /** На главной: 5 последних фото + кнопка в фотогалерею. */
  function renderHomePhotos(container) {
    var photos = getPhotos();
    if (!photos.length) {
      container.innerHTML = '<p class="text-muted">Пока нет фотографий. Добавьте их в разделе «Фотографии» панели администратора.</p>';
      return;
    }
    var latest = photos.slice(-PHOTO_HOME_LIMIT).reverse();
    window.__FDSO_CURRENT_PHOTO_LIST = latest;
    container.innerHTML = '';
    var gallery = document.createElement('div');
    gallery.className = 'photo-gallery photo-gallery-single-row';
    latest.forEach(function (item, i) {
      gallery.appendChild(renderPhotoItem(item, 'photo-gallery-item', i));
    });
    container.appendChild(gallery);
    var btnWrap = document.createElement('div');
    btnWrap.className = 'photo-gallery-more';
    btnWrap.innerHTML = '<a href="' + escapeAttr(PHOTO_GALLERY_PAGE) + '" class="btn btn-outline-primary">Перейти в фотогалерею</a>';
    container.appendChild(btnWrap);
  }

  /** Строит группы фото по событиям (соревнованиям). Возвращает { keys: string[], groups: {} }. */
  function getPhotosByEvents() {
    var photos = getPhotos();
    var groups = {};
    photos.forEach(function (item) {
      var key = (item.competition || '').trim();
      if (!key) key = 'Разное';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    });
    var keys = Object.keys(groups).sort(function (a, b) {
      if (a === 'Разное') return 1;
      if (b === 'Разное') return -1;
      return a.localeCompare(b, 'ru');
    });
    return { keys: keys, groups: groups };
  }

  /** Страница галереи: список событий (карточки с переходом в каждое). */
  function renderGalleryEventsList(container) {
    var data = getPhotosByEvents();
    var keys = data.keys;
    var groups = data.groups;
    if (!keys.length) {
      container.innerHTML = '<p class="text-muted">Пока нет фотографий. Добавьте их в разделе «Фотографии» панели администратора.</p>';
      return;
    }
    container.innerHTML = '';
    var listWrap = document.createElement('div');
    listWrap.className = 'photo-events-list';
    listWrap.setAttribute('role', 'list');
    keys.forEach(function (name, index) {
      var items = groups[name];
      var count = items.length;
      var firstPhoto = items[0];
      var thumbUrl = firstPhoto && (firstPhoto.thumbUrl || firstPhoto.url) ? escapeAttr(firstPhoto.thumbUrl || firstPhoto.url) : '';
      var slug = 'event-' + index;
      var card = document.createElement('a');
      card.href = 'gallery.html#' + slug;
      card.className = 'photo-event-card';
      card.setAttribute('role', 'listitem');
      var thumbHtml = thumbUrl
        ? '<span class="photo-event-card-thumb" style="background-image:url(' + thumbUrl + ')"></span>'
        : '<span class="photo-event-card-thumb photo-event-card-thumb-placeholder"><i data-lucide="image" aria-hidden="true"></i></span>';
      card.innerHTML =
        '<span class="photo-event-card-inner">' +
        thumbHtml +
        '<span class="photo-event-card-body">' +
        '<span class="photo-event-card-title">' + escapeHtml(name) + '</span>' +
        '<span class="photo-event-card-count">' + count + ' фото</span>' +
        '</span>' +
        '<i data-lucide="chevron-right" class="photo-event-card-arrow" aria-hidden="true"></i>' +
        '</span>';
      listWrap.appendChild(card);
    });
    container.appendChild(listWrap);
    if (typeof lucide !== 'undefined' && lucide.createIcons) lucide.createIcons();
  }

  /** Страница галереи: фото одного события + кнопка «К списку событий». */
  function renderGalleryEventDetail(container, eventIndex) {
    var data = getPhotosByEvents();
    var keys = data.keys;
    var groups = data.groups;
    if (eventIndex < 0 || eventIndex >= keys.length) {
      renderGalleryByCompetitions(container);
      return;
    }
    var name = keys[eventIndex];
    var items = groups[name];
    container.innerHTML = '';
    var backLink = document.createElement('p');
    backLink.className = 'photo-event-back';
    backLink.innerHTML = '<a href="gallery.html" class="btn btn-outline-primary">← Вся галерея</a>';
    container.appendChild(backLink);
    var titleEl = document.createElement('h2');
    titleEl.className = 'photo-competition-title photo-event-detail-title';
    titleEl.textContent = name;
    container.appendChild(titleEl);
    window.__FDSO_CURRENT_PHOTO_LIST = items;
    var gallery = document.createElement('div');
    gallery.className = 'photo-gallery';
    items.forEach(function (item, i) {
      gallery.appendChild(renderPhotoItem(item, 'photo-gallery-item', i));
    });
    container.appendChild(gallery);
    var backLink2 = document.createElement('p');
    backLink2.className = 'photo-event-back mt-4';
    backLink2.innerHTML = '<a href="gallery.html" class="btn btn-outline-primary">← Вся галерея</a>';
    container.appendChild(backLink2);
  }

  /** Страница галереи: все фото, сгруппированные по соревнованиям (данные из админки). */
  function renderGalleryByCompetitions(container) {
    var data = getPhotosByEvents();
    var keys = data.keys;
    var groups = data.groups;
    if (!keys.length) {
      container.innerHTML = '<p class="text-muted">Пока нет фотографий. Добавьте их в разделе «Фотографии» панели администратора.</p>';
      return;
    }
    var flatList = [];
    keys.forEach(function (k) { flatList = flatList.concat(groups[k]); });
    window.__FDSO_CURRENT_PHOTO_LIST = flatList;
    container.innerHTML = '';
    var flatIndex = 0;
    keys.forEach(function (competitionName, index) {
      var items = groups[competitionName];
      var groupDiv = document.createElement('section');
      groupDiv.className = 'photo-competition-group';
      groupDiv.id = 'event-' + index;
      groupDiv.setAttribute('aria-labelledby', 'event-title-' + index);
      groupDiv.innerHTML = '<h2 id="event-title-' + index + '" class="photo-competition-title">' + escapeHtml(competitionName) + '</h2>';
      var gallery = document.createElement('div');
      gallery.className = 'photo-gallery';
      items.forEach(function (item) {
        gallery.appendChild(renderPhotoItem(item, 'photo-gallery-item', flatIndex++));
      });
      groupDiv.appendChild(gallery);
      container.appendChild(groupDiv);
    });
  }

  /** Лайтбокс фотографий: открытие в том же окне, prev/next по кругу. */
  var photoLightboxList = [];
  var photoLightboxIndex = 0;
  var photoLightboxEl = null;

  function openPhotoLightbox(list, index) {
    if (!list || !list.length) return;
    photoLightboxList = list;
    photoLightboxIndex = (index % list.length + list.length) % list.length;
    if (!photoLightboxEl) initPhotoLightbox();
    var imgEl = photoLightboxEl.querySelector('.photo-lightbox-img');
    var capEl = photoLightboxEl.querySelector('.photo-lightbox-caption');
    var item = photoLightboxList[photoLightboxIndex];
    imgEl.src = item.url || '';
    imgEl.onerror = function () { if (item.dataUrl) this.src = item.dataUrl; };
    if (capEl) capEl.textContent = item.caption || '';
    photoLightboxEl.classList.add('photo-lightbox-open');
    document.body.style.overflow = 'hidden';
  }

  function showPhotoAtIndex(i) {
    var len = photoLightboxList.length;
    if (!len) return;
    photoLightboxIndex = (i % len + len) % len;
    var item = photoLightboxList[photoLightboxIndex];
    var imgEl = photoLightboxEl && photoLightboxEl.querySelector('.photo-lightbox-img');
    var capEl = photoLightboxEl && photoLightboxEl.querySelector('.photo-lightbox-caption');
    if (imgEl) {
      imgEl.src = item.url || '';
      imgEl.onerror = function () { if (item.dataUrl) imgEl.src = item.dataUrl; };
    }
    if (capEl) capEl.textContent = item.caption || '';
  }

  function closePhotoLightbox() {
    if (photoLightboxEl) photoLightboxEl.classList.remove('photo-lightbox-open');
    document.body.style.overflow = '';
  }

  function initPhotoLightbox() {
    if (photoLightboxEl) return;
    photoLightboxEl = document.createElement('div');
    photoLightboxEl.className = 'photo-lightbox';
    photoLightboxEl.setAttribute('role', 'dialog');
    photoLightboxEl.setAttribute('aria-modal', 'true');
    photoLightboxEl.setAttribute('aria-label', 'Просмотр фотографии');
    photoLightboxEl.innerHTML =
      '<div class="photo-lightbox-backdrop"></div>' +
      '<button type="button" class="photo-lightbox-close" aria-label="Закрыть"></button>' +
      '<button type="button" class="photo-lightbox-prev" aria-label="Предыдущее фото"></button>' +
      '<button type="button" class="photo-lightbox-next" aria-label="Следующее фото"></button>' +
      '<div class="photo-lightbox-content">' +
      '<img src="" alt="" class="photo-lightbox-img" decoding="async">' +
      '<p class="photo-lightbox-caption"></p>' +
      '</div>';
    document.body.appendChild(photoLightboxEl);
    photoLightboxEl.querySelector('.photo-lightbox-backdrop').addEventListener('click', closePhotoLightbox);
    photoLightboxEl.querySelector('.photo-lightbox-close').addEventListener('click', closePhotoLightbox);
    photoLightboxEl.querySelector('.photo-lightbox-prev').addEventListener('click', function (e) {
      e.stopPropagation();
      showPhotoAtIndex(photoLightboxIndex - 1);
    });
    photoLightboxEl.querySelector('.photo-lightbox-next').addEventListener('click', function (e) {
      e.stopPropagation();
      showPhotoAtIndex(photoLightboxIndex + 1);
    });
    document.addEventListener('keydown', function (e) {
      if (!photoLightboxEl || !photoLightboxEl.classList.contains('photo-lightbox-open')) return;
      if (e.key === 'Escape') closePhotoLightbox();
      if (e.key === 'ArrowLeft') showPhotoAtIndex(photoLightboxIndex - 1);
      if (e.key === 'ArrowRight') showPhotoAtIndex(photoLightboxIndex + 1);
    });

    var touchStartX = 0;
    var SWIPE_MIN = 50;
    photoLightboxEl.addEventListener('touchstart', function (e) {
      if (e.changedTouches && e.changedTouches[0]) touchStartX = e.changedTouches[0].clientX;
    }, { passive: true });
    photoLightboxEl.addEventListener('touchend', function (e) {
      if (!photoLightboxEl.classList.contains('photo-lightbox-open')) return;
      if (!e.changedTouches || !e.changedTouches[0]) return;
      var touchEndX = e.changedTouches[0].clientX;
      var delta = touchEndX - touchStartX;
      if (delta > SWIPE_MIN) showPhotoAtIndex(photoLightboxIndex - 1);
      else if (delta < -SWIPE_MIN) showPhotoAtIndex(photoLightboxIndex + 1);
    }, { passive: true });
  }

  function bindPhotoLightboxClicks() {
    document.body.addEventListener('click', function (e) {
      var card = e.target.closest('.photo-card');
      if (!card) return;
      var wrap = card.closest('.photo-gallery-item');
      if (!wrap) return;
      var idx = wrap.getAttribute('data-photo-index');
      if (idx === null || idx === undefined) return;
      e.preventDefault();
      var list = window.__FDSO_CURRENT_PHOTO_LIST;
      if (!list || !list.length) return;
      openPhotoLightbox(list, parseInt(idx, 10));
    });
  }

  /** На странице фотогалереи: превью соревнований (первое фото) или по клику — все фото события по hash #event-N. */
  function renderFullGallery(container) {
    var photos = getPhotos();
    if (!photos.length) {
      container.innerHTML = '<p class="text-muted">Пока нет фотографий. Добавьте их в разделе «Фотографии» панели администратора.</p>';
      return;
    }
    var hash = typeof window.location !== 'undefined' ? (window.location.hash || '').slice(1) : '';
    var match = hash.match(/^event-(\d+)$/);
    if (match) {
      var eventIndex = parseInt(match[1], 10);
      renderGalleryEventDetail(container, eventIndex);
    } else {
      renderGalleryEventsList(container);
    }
  }

  function renderAdminPhotos() {
    var container = document.getElementById('photo-gallery-container');
    if (!container) return;
    var isGalleryPage = typeof window.location !== 'undefined' &&
      (window.location.pathname.indexOf('gallery') !== -1 || window.location.href.indexOf('gallery') !== -1);
    if (isGalleryPage) {
      renderFullGallery(container);
    } else {
      renderHomePhotos(container);
    }
  }

  function getDocumentDownloadFilename(item) {
    var title = (item.title || 'document').replace(/[^\w\u0400-\u04FF\s\-\.]/gi, '').replace(/\s+/g, ' ').trim() || 'document';
    var ext = (item.meta || 'pdf').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!ext) ext = 'pdf';
    return title.slice(0, 100) + '.' + ext;
  }

  function renderAdminDocuments() {
    var row = document.getElementById('documents-row');
    if (!row) return;
    row.innerHTML = '';
    var docs = getDocuments();
    if (!docs.length) {
      row.innerHTML = '<div class="col-12"><p class="text-muted">Пока нет документов. Добавьте их в панели администратора.</p></div>';
      return;
    }
    docs.forEach(function (item) {
      var col = document.createElement('div');
      col.className = 'col-md-6 col-lg-3';
      var downloadFilename = getDocumentDownloadFilename(item);
      col.innerHTML =
        '<a href="' + escapeAttr(item.url) + '" class="document-card document-card-plaque" download="' + escapeAttr(downloadFilename) + '" target="_blank" rel="noopener">' +
        '<span class="document-card-title">' + escapeHtml(item.title) + '</span>' +
        '</a>';
      row.appendChild(col);
    });
  }

  function renderFriendsCarousel() {
    var section = document.getElementById('friends');
    var container = document.getElementById('friends-carousel');
    if (!container) return;
    var friends = getFriends();
    container.innerHTML = '';
    if (!friends.length) {
      if (section) section.style.display = 'none';
      return;
    }
    if (section) section.style.display = '';
    friends.forEach(function (item) {
      var url = (item.url || '').trim() || '#';
      var title = (item.title || '').trim() || 'Ссылка';
      var iconUrl = (item.iconUrl || item.icon || '').trim();
      var a = document.createElement('a');
      a.className = 'friends-carousel-item';
      a.href = url;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.title = title;
      a.setAttribute('aria-label', title);
      if (iconUrl) {
        var img = document.createElement('img');
        img.src = iconUrl;
        img.alt = title;
        img.loading = 'lazy';
        a.appendChild(img);
      } else {
        var span = document.createElement('span');
        span.className = 'friends-carousel-placeholder';
        span.textContent = title.charAt(0).toUpperCase() || '?';
        a.appendChild(span);
      }
      container.appendChild(a);
    });
  }

  function refreshIcons() {
    if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') lucide.createIcons();
  }
  function init() {
    renderAdminNews();
    renderAdminPhotos();
    renderAdminDocuments();
    renderFriendsCarousel();
    renderCompetitions();
    refreshIcons();
    loadNewsFromFile().then(function () {
      renderAdminNews();
      refreshIcons();
    }).catch(function () { renderAdminNews(); refreshIcons(); });
    loadCompetitionsFromFile().then(function () {
      renderCompetitions();
      refreshIcons();
    }).catch(function () { renderCompetitions(); refreshIcons(); });
    loadDocumentsFromFile().then(function () {
      renderAdminDocuments();
    }).catch(function () { renderAdminDocuments(); });
    loadFriendsFromFile().then(function () {
      renderFriendsCarousel();
    }).catch(function () { renderFriendsCarousel(); });
    loadPhotosFromFile().then(function () {
      renderAdminPhotos();
      refreshIcons();
    }).catch(function () { renderAdminPhotos(); refreshIcons(); });
    var isGalleryPage = typeof window.location !== 'undefined' &&
      (window.location.pathname.indexOf('gallery') !== -1 || window.location.href.indexOf('gallery') !== -1);
    if (isGalleryPage) {
      window.addEventListener('hashchange', function () {
        var container = document.getElementById('photo-gallery-container');
        if (container) renderFullGallery(container);
      });
    }
    if (typeof lucide !== 'undefined' && typeof lucide.createIcons === 'function') {
      lucide.createIcons();
    }
    bindPhotoLightboxClicks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
