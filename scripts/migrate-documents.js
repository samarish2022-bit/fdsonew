/**
 * Выносит data:…;base64 из data/documents.json в files под images/uploads/documents/.
 * Запуск: node scripts/migrate-documents.js
 */
var path = require('path');
var fs = require('fs');
var crypto = require('crypto');

var ROOT = path.join(__dirname, '..');
var DOCUMENTS_FILE = path.join(ROOT, 'data', 'documents.json');
var UPLOADS_DIR = path.join(ROOT, 'images', 'uploads', 'documents');
var URL_PREFIX = 'images/uploads/documents/';

var MIME_EXT = {
  'application/pdf': 'pdf',
  'application/msword': 'doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'text/plain': 'txt'
};

function extFromMime(mime) {
  if (!mime) return 'bin';
  var base = mime.split(';')[0].trim().toLowerCase();
  if (MIME_EXT[base]) return MIME_EXT[base];
  if (base.indexOf('pdf') !== -1) return 'pdf';
  var slash = base.lastIndexOf('/');
  if (slash >= 0) {
    var sub = base.slice(slash + 1).replace(/[^a-z0-9]/gi, '');
    if (sub) return sub.slice(0, 8);
  }
  return 'bin';
}

function metaFromExt(ext) {
  return (ext || 'pdf').toUpperCase();
}

function slugTitle(title) {
  if (!title || typeof title !== 'string') return 'document';
  var s = title.trim().toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-zа-яё0-9\-]/gi, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'document';
  return s.slice(0, 60);
}

function migrateItem(item, idx, hashToUrl) {
  var url = item && item.url;
  if (!url || typeof url !== 'string' || url.indexOf('data:') !== 0) {
    return { item: item, migrated: false };
  }
  var m = url.match(/^data:([^;]+);base64,(.+)$/);
  if (!m) {
    console.warn('Пропуск записи id=' + (item && item.id) + ': не распознан data URL');
    return { item: item, migrated: false };
  }
  var mime = m[1];
  var buffer = Buffer.from(m[2], 'base64');
  var hash = crypto.createHash('sha256').update(buffer).digest('hex');
  if (hashToUrl[hash]) {
    var reused = {};
    for (var k in item) if (Object.prototype.hasOwnProperty.call(item, k)) reused[k] = item[k];
    reused.url = hashToUrl[hash];
    if (!reused.meta) reused.meta = metaFromExt(extFromMime(mime));
    console.log('  id=' + item.id + ' — дубликат, ссылка на ' + reused.url);
    return { item: reused, migrated: true };
  }

  if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  var ext = extFromMime(mime);
  var basename = 'doc-' + (item.id != null ? item.id : idx) + '-' + slugTitle(item.title) + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
  var filePath = path.join(UPLOADS_DIR, basename);
  fs.writeFileSync(filePath, buffer);
  var fileUrl = URL_PREFIX + basename;
  hashToUrl[hash] = fileUrl;

  var out = {};
  for (var key in item) if (Object.prototype.hasOwnProperty.call(item, key)) out[key] = item[key];
  out.url = fileUrl;
  if (!out.meta) out.meta = metaFromExt(ext);
  console.log('  id=' + item.id + ' → ' + fileUrl + ' (' + buffer.length + ' bytes)');
  return { item: out, migrated: true };
}

function main() {
  if (!fs.existsSync(DOCUMENTS_FILE)) {
    console.error('Не найден', DOCUMENTS_FILE);
    process.exit(1);
  }
  var raw = fs.readFileSync(DOCUMENTS_FILE, 'utf8');
  var parsed = JSON.parse(raw);
  var list = Array.isArray(parsed) ? parsed : (parsed && Array.isArray(parsed.documents) ? parsed.documents : []);
  var hashToUrl = {};
  var count = 0;
  var next = list.map(function (item, idx) {
    var result = migrateItem(item, idx, hashToUrl);
    if (result.migrated) count += 1;
    return {
      id: result.item.id,
      title: result.item.title,
      url: result.item.url,
      meta: result.item.meta || undefined
    };
  });
  fs.writeFileSync(DOCUMENTS_FILE, JSON.stringify(next, null, 2), 'utf8');
  console.log('Готово: мигрировано', count, 'из', next.length, 'документов.');
  console.log('Размер documents.json:', fs.statSync(DOCUMENTS_FILE).size, 'байт');
}

main();
