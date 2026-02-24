/**
 * Локальный сервер: раздача сайта и сохранение новостей в data/news.json.
 * Запуск: npm start
 */
var path = require('path');
var fs = require('fs');
var express = require('express');
var sharp = require('sharp');

var app = express();
var PORT = process.env.PORT || 3000;
var NEWS_FILE = path.join(__dirname, 'data', 'news.json');
var COMPETITIONS_FILE = path.join(__dirname, 'data', 'competitions.json');
var DOCUMENTS_FILE = path.join(__dirname, 'data', 'documents.json');
var FRIENDS_FILE = path.join(__dirname, 'data', 'friends.json');
var PHOTOS_FILE = path.join(__dirname, 'data', 'photos.json');
var PEOPLE_FILE = path.join(__dirname, 'data', 'people.json');
var UPLOADS_PHOTOS_BASE = path.join(__dirname, 'images', 'uploads', 'photos');
var UPLOADS_NEWS_BASE = path.join(__dirname, 'images', 'uploads', 'news');
var UPLOADS_COMPETITIONS_BASE = path.join(__dirname, 'images', 'uploads', 'competitions');
var UPLOADS_FRIENDS_BASE = path.join(__dirname, 'images', 'uploads', 'friends');

function slugFromCompetition(name) {
  if (!name || typeof name !== 'string') return 'raznoe';
  var s = name.trim().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-zа-яё0-9\-]/gi, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'raznoe';
  return s.slice(0, 80);
}

/** Если в item есть imageDataUrl (base64), сохраняет картинку в папку и возвращает item с imageUrl, без imageDataUrl. suffix — для уникальности при массовой миграции */
function migrateItemImage(item, baseDir, urlPrefix, suffix) {
  var dataUrl = item && item.imageDataUrl;
  if (!dataUrl || typeof dataUrl !== 'string' || dataUrl.indexOf('data:image/') !== 0) {
    return item;
  }
  var m = dataUrl.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!m) return item;
  var ext = (m[1].toLowerCase() === 'jpeg' || m[1].toLowerCase() === 'jpg') ? 'jpg' : (m[1].toLowerCase() === 'png' ? 'png' : 'jpg');
  if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });
  var basename = 'img-' + Date.now() + '-' + (suffix != null ? suffix + '-' : '') + Math.random().toString(36).slice(2, 10) + '.' + ext;
  var filePath = path.join(baseDir, basename);
  try {
    fs.writeFileSync(filePath, Buffer.from(m[2], 'base64'));
  } catch (e) {
    console.error('Ошибка записи изображения:', e.message);
    return item;
  }
  var out = {};
  for (var k in item) if (item.hasOwnProperty(k) && k !== 'imageDataUrl') out[k] = item[k];
  out.imageUrl = urlPrefix + basename;
  return out;
}

// Лимит 50mb — документы с base64 (загруженные файлы) могут быть большими
app.use(express.json({ limit: '50mb' }));

// CORS для API: админка может открываться с file:// или другого порта
app.use('/api', function (req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

/** API — до раздачи статики */
app.get('/api/news', function (req, res) {
  try {
    var data = [];
    if (fs.existsSync(NEWS_FILE)) {
      var raw = fs.readFileSync(NEWS_FILE, 'utf8');
      var parsed = JSON.parse(raw);
      data = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.news) ? parsed.news : []);
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json(data);
  } catch (e) {
    res.json([]);
  }
});

app.post('/api/save-news', function (req, res) {
  var raw = Array.isArray(req.body) ? req.body : [];
  try {
    var data = raw.map(function (item, idx) {
      var migrated = migrateItemImage(item, UPLOADS_NEWS_BASE, 'images/uploads/news/', idx);
      return { id: migrated.id, title: migrated.title, text: migrated.text, date: migrated.date, imageUrl: migrated.imageUrl || undefined };
    });
    var dir = path.dirname(NEWS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(NEWS_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log('Записано новостей:', data.length);
    res.json({ ok: true });
  } catch (e) {
    console.error('Ошибка записи news.json:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/competitions', function (req, res) {
  try {
    var data = [];
    if (fs.existsSync(COMPETITIONS_FILE)) {
      var raw = fs.readFileSync(COMPETITIONS_FILE, 'utf8');
      var parsed = JSON.parse(raw);
      data = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.competitions) ? parsed.competitions : []);
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json(data);
  } catch (e) {
    res.json([]);
  }
});

app.post('/api/save-competitions', function (req, res) {
  var raw = Array.isArray(req.body) ? req.body : [];
  try {
    var data = raw.map(function (item, idx) {
      var migrated = migrateItemImage(item, UPLOADS_COMPETITIONS_BASE, 'images/uploads/competitions/', idx);
      return { id: migrated.id, title: migrated.title, text: migrated.text, date: migrated.date, status: migrated.status, imageUrl: migrated.imageUrl || undefined };
    });
    var dir = path.dirname(COMPETITIONS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(COMPETITIONS_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log('Записано соревнований:', data.length);
    res.json({ ok: true });
  } catch (e) {
    console.error('Ошибка записи competitions.json:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/documents', function (req, res) {
  try {
    var data = [];
    if (fs.existsSync(DOCUMENTS_FILE)) {
      var raw = fs.readFileSync(DOCUMENTS_FILE, 'utf8');
      var parsed = JSON.parse(raw);
      data = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.documents) ? parsed.documents : []);
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json(data);
  } catch (e) {
    res.json([]);
  }
});

app.post('/api/save-documents', function (req, res) {
  if (req.body === undefined || req.body === null) {
    return res.status(413).json({ error: 'Payload too large or invalid JSON' });
  }
  if (!Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Body must be a JSON array' });
  }
  var data = req.body;
  try {
    var dir = path.dirname(DOCUMENTS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(DOCUMENTS_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log('Записано документов:', data.length);
    res.json({ ok: true });
  } catch (e) {
    console.error('Ошибка записи documents.json:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/friends', function (req, res) {
  try {
    var data = [];
    if (fs.existsSync(FRIENDS_FILE)) {
      var raw = fs.readFileSync(FRIENDS_FILE, 'utf8');
      var parsed = JSON.parse(raw);
      data = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.friends) ? parsed.friends : []);
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json(data);
  } catch (e) {
    res.json([]);
  }
});

app.post('/api/save-friends', function (req, res) {
  if (req.body === undefined || req.body === null) {
    return res.status(413).json({ error: 'Payload too large or invalid JSON' });
  }
  if (!Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Body must be a JSON array' });
  }
  var data = req.body;
  try {
    var dir = path.dirname(FRIENDS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(FRIENDS_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log('Записано друзей:', data.length);
    res.json({ ok: true });
  } catch (e) {
    console.error('Ошибка записи friends.json:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/photos', function (req, res) {
  try {
    var data = [];
    if (fs.existsSync(PHOTOS_FILE)) {
      var raw = fs.readFileSync(PHOTOS_FILE, 'utf8');
      var parsed = JSON.parse(raw);
      data = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.photos) ? parsed.photos : []);
    }
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.json(data);
  } catch (e) {
    res.json([]);
  }
});

app.post('/api/save-photos', function (req, res) {
  if (req.body === undefined || req.body === null) {
    return res.status(413).json({ error: 'Payload too large or invalid JSON' });
  }
  if (!Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Body must be a JSON array' });
  }
  var data = req.body;
  try {
    var dir = path.dirname(PHOTOS_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(PHOTOS_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log('Записано фотографий:', data.length);
    res.json({ ok: true });
  } catch (e) {
    console.error('Ошибка записи photos.json:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/upload-photo', function (req, res) {
  if (req.body === undefined || req.body === null) {
    return res.status(413).json({ error: 'Payload too large or invalid JSON' });
  }
  var competition = (req.body.competition || '').trim() || 'Разное';
  var caption = (req.body.caption || '').trim() || '';
  var imageBase64 = req.body.imageBase64;
  var filename = (req.body.filename || 'image').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60);
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return res.status(400).json({ error: 'imageBase64 required' });
  }
  var m = imageBase64.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!m) {
    return res.status(400).json({ error: 'Invalid base64 image' });
  }
  var ext = m[1].toLowerCase() === 'jpeg' || m[1].toLowerCase() === 'jpg' ? 'jpg' : (m[1].toLowerCase() === 'png' ? 'png' : 'jpg');
  var slug = slugFromCompetition(competition);
  var photoDir = path.join(UPLOADS_PHOTOS_BASE, slug);
  if (!fs.existsSync(photoDir)) {
    fs.mkdirSync(photoDir, { recursive: true });
  }
  var id = Date.now() + '-' + Math.random().toString(36).slice(2, 10);
  var basename = id + '.' + ext;
  var filePath = path.join(photoDir, basename);
  var buffer = Buffer.from(m[2], 'base64');
  try {
    fs.writeFileSync(filePath, buffer);
  } catch (e) {
    console.error('Ошибка записи фото:', e.message);
    return res.status(500).json({ error: e.message });
  }
  var url = '/images/uploads/photos/' + slug + '/' + basename;
  var thumbBasename = id + '-thumb.jpg';
  var thumbPath = path.join(photoDir, thumbBasename);
  var thumbUrl = '/images/uploads/photos/' + slug + '/' + thumbBasename;
  sharp(filePath)
    .resize(400, null, { withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toFile(thumbPath)
    .then(function () {
      res.json({ url: url, thumbUrl: thumbUrl });
    })
    .catch(function (err) {
      console.warn('Превью не создано:', err.message);
      res.json({ url: url });
    });
});

/** Загрузка изображений для новостей и соревнований. Тело: { imageBase64, type: "news"|"competition" }. Ответ: { url } */
app.post('/api/upload-image', function (req, res) {
  if (req.body == null) return res.status(413).json({ error: 'Payload too large or invalid JSON' });
  var imageBase64 = req.body.imageBase64;
  var type = (req.body.type || '').toLowerCase();
  if (type !== 'news' && type !== 'competition' && type !== 'friend') return res.status(400).json({ error: 'type must be "news", "competition" or "friend"' });
  if (!imageBase64 || typeof imageBase64 !== 'string') return res.status(400).json({ error: 'imageBase64 required' });
  var m = imageBase64.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!m) return res.status(400).json({ error: 'Invalid base64 image' });
  var ext = (m[1].toLowerCase() === 'jpeg' || m[1].toLowerCase() === 'jpg') ? 'jpg' : (m[1].toLowerCase() === 'png' ? 'png' : 'jpg');
  var baseDir = type === 'news' ? UPLOADS_NEWS_BASE : (type === 'competition' ? UPLOADS_COMPETITIONS_BASE : UPLOADS_FRIENDS_BASE);
  if (!fs.existsSync(baseDir)) fs.mkdirSync(baseDir, { recursive: true });
  var basename = 'img-' + Date.now() + '-' + Math.random().toString(36).slice(2, 10) + '.' + ext;
  var filePath = path.join(baseDir, basename);
  try {
    fs.writeFileSync(filePath, Buffer.from(m[2], 'base64'));
  } catch (e) {
    console.error('Ошибка записи изображения:', e.message);
    return res.status(500).json({ error: e.message });
  }
  var urlPrefix = type === 'news' ? 'images/uploads/news/' : (type === 'competition' ? 'images/uploads/competitions/' : 'images/uploads/friends/');
  res.json({ url: urlPrefix + basename });
});

/** Одноразовая миграция: вынести imageDataUrl из news.json и competitions.json в файлы, перезаписать JSON без base64. Вызовите: POST /api/migrate-images */
app.post('/api/migrate-images', function (req, res) {
  var result = { news: 0, competitions: 0 };
  try {
    if (fs.existsSync(NEWS_FILE)) {
      var raw = fs.readFileSync(NEWS_FILE, 'utf8');
      var parsed = JSON.parse(raw);
      var newsData = Array.isArray(parsed) ? parsed : (parsed && parsed.news) ? parsed.news : [];
      var migratedNews = newsData.map(function (item, idx) {
        var m = migrateItemImage(item, UPLOADS_NEWS_BASE, 'images/uploads/news/', idx);
        return { id: m.id, title: m.title, text: m.text, date: m.date, imageUrl: m.imageUrl || undefined };
      });
      fs.writeFileSync(NEWS_FILE, JSON.stringify(migratedNews, null, 2), 'utf8');
      result.news = migratedNews.length;
      console.log('Миграция новостей: записей', result.news);
    }
    if (fs.existsSync(COMPETITIONS_FILE)) {
      var raw2 = fs.readFileSync(COMPETITIONS_FILE, 'utf8');
      var parsed2 = JSON.parse(raw2);
      var compData = Array.isArray(parsed2) ? parsed2 : (parsed2 && parsed2.competitions) ? parsed2.competitions : [];
      var migratedComp = compData.map(function (item, idx) {
        var m = migrateItemImage(item, UPLOADS_COMPETITIONS_BASE, 'images/uploads/competitions/', idx);
        return { id: m.id, title: m.title, text: m.text, date: m.date, status: m.status, imageUrl: m.imageUrl || undefined };
      });
      fs.writeFileSync(COMPETITIONS_FILE, JSON.stringify(migratedComp, null, 2), 'utf8');
      result.competitions = migratedComp.length;
      console.log('Миграция соревнований: записей', result.competitions);
    }
    res.json({ ok: true, news: result.news, competitions: result.competitions });
  } catch (e) {
    console.error('Ошибка миграции:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/people', function (req, res) {
  try {
    var data = [];
    if (fs.existsSync(PEOPLE_FILE)) {
      var raw = fs.readFileSync(PEOPLE_FILE, 'utf8');
      var parsed = JSON.parse(raw);
      data = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.list) ? parsed.list : []);
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json(data);
  } catch (e) {
    res.json([]);
  }
});

app.post('/api/save-people', function (req, res) {
  if (req.body === undefined || req.body === null) {
    return res.status(413).json({ error: 'Payload too large or invalid JSON' });
  }
  var data = Array.isArray(req.body) ? req.body : (req.body && Array.isArray(req.body.list) ? req.body.list : []);
  try {
    var dir = path.dirname(PEOPLE_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(PEOPLE_FILE, JSON.stringify(data, null, 2), 'utf8');
    console.log('Записано людей:', data.length);
    res.json({ ok: true });
  } catch (e) {
    console.error('Ошибка записи people.json:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// Кэширование изображений на 1 год (файлы с уникальными именами при загрузке)
app.use('/images', express.static(path.join(__dirname, 'images'), { maxAge: '1y' }));
app.use(express.static(__dirname));

app.listen(PORT, function () {
  console.log('Сайт: http://localhost:' + PORT);
  console.log('Новости сохраняются в data/news.json');
});
