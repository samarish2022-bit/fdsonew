/**
 * Оптимизация hero-bg: уменьшение размера и экспорт в WebP.
 * Запуск: npm run optimize-hero
 * Требует: images/hero-bg.jpg и установленный sharp (npm install).
 */
var path = require('path');
var fs = require('fs');
var sharp = require('sharp');

var imagesDir = path.join(__dirname, '..', 'images');
var inputPath = path.join(imagesDir, 'hero-bg.jpg');
var webpPath = path.join(imagesDir, 'hero-bg.webp');
var maxWidth = 1920;
var jpegQuality = 85;
var webpQuality = 82;

if (!fs.existsSync(inputPath)) {
  console.warn('Файл images/hero-bg.jpg не найден. Создайте его и запустите снова.');
  process.exit(0);
}

var pipeline = sharp(inputPath).resize(maxWidth, null, { withoutEnlargement: true });
var tempJpg = path.join(imagesDir, 'hero-bg-tmp.jpg');

Promise.all([
  pipeline.clone().jpeg({ quality: jpegQuality }).toFile(tempJpg),
  pipeline.clone().webp({ quality: webpQuality }).toFile(webpPath)
])
  .then(function () {
    try {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      fs.renameSync(tempJpg, inputPath);
    } catch (e) {
      fs.copyFileSync(tempJpg, inputPath);
      fs.unlinkSync(tempJpg);
    }
    console.log('Готово: images/hero-bg.jpg обновлён, images/hero-bg.webp создан.');
  })
  .catch(function (err) {
    if (fs.existsSync(tempJpg)) try { fs.unlinkSync(tempJpg); } catch (_) {}
    console.error('Ошибка:', err.message);
    process.exit(1);
  });
