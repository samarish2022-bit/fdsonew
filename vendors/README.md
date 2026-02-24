# Локальные библиотеки (vendors)

Для работы офлайн или без CDN скачайте файлы в эту папку и в `index.html` замените CDN-ссылки на локальные:

- **Bootstrap 5**  
  - CSS: https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css → `vendors/bootstrap.min.css`  
  - JS: https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js → `vendors/bootstrap.bundle.min.js`

- **GSAP**  
  - https://cdn.jsdelivr.net/npm/gsap@3.12.2/dist/gsap.min.js → `vendors/gsap.min.js`  
  - https://cdn.jsdelivr.net/npm/gsap@3.12.2/dist/ScrollTrigger.min.js → `vendors/ScrollTrigger.min.js`

- **Lucide Icons**  
  - https://unpkg.com/lucide@latest/dist/umd/lucide.min.js → `vendors/lucide.min.js`

В `index.html` замените соответствующие теги `<script>` и `<link>` на пути вида `vendors/имя_файла`.
