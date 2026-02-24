/**
 * Одноразовая миграция: переносит imageDataUrl из news.json и competitions.json в файлы.
 * Запуск: node migrate-images.js
 * После этого в JSON остаются только пути (imageUrl), картинки лежат в images/uploads/news/ и images/uploads/competitions/
 */
var path = require('path');
var fs = require('fs');

var NEWS_FILE = path.join(__dirname, 'data', 'news.json');
var COMPETITIONS_FILE = path.join(__dirname, 'data', 'competitions.json');
var UPLOADS_NEWS_BASE = path.join(__dirname, 'images', 'uploads', 'news');
var UPLOADS_COMPETITIONS_BASE = path.join(__dirname, 'images', 'uploads', 'competitions');

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

function run() {
  var done = 0;
  if (fs.existsSync(NEWS_FILE)) {
    var raw = fs.readFileSync(NEWS_FILE, 'utf8');
    var parsed = JSON.parse(raw);
    var newsData = Array.isArray(parsed) ? parsed : (parsed && parsed.news) ? parsed.news : [];
    var migrated = newsData.map(function (item, idx) {
      var m = migrateItemImage(item, UPLOADS_NEWS_BASE, 'images/uploads/news/', idx);
      return { id: m.id, title: m.title, text: m.text, date: m.date, imageUrl: m.imageUrl || undefined };
    });
    fs.writeFileSync(NEWS_FILE, JSON.stringify(migrated, null, 2), 'utf8');
    console.log('Новости: мигрировано записей', migrated.length);
    done++;
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
    console.log('Соревнования: мигрировано записей', migratedComp.length);
    done++;
  }
  if (done === 0) console.log('Файлы data/news.json и data/competitions.json не найдены.');
  else console.log('Готово. Изображения теперь в images/uploads/news/ и images/uploads/competitions/, в JSON только пути.');
}

run();
