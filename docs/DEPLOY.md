# Деплой тестового сайта

## Текущий стенд

| Параметр | Значение |
|---|---|
| Домен | `https://fdso.rockchat1.ru` |
| IP | `94.232.46.243` |
| Каталог | `/var/www/fdso` |
| Node | `127.0.0.1:3000` (`systemd` unit `fdso`) |
| Nginx | reverse proxy, HTTP→HTTPS для домена |
| SSL | Let's Encrypt (`certbot`), автообновление через `certbot.timer` |

Доступ по IP по HTTP (`http://94.232.46.243/`) сохранён для удобства. Запросы к `http://fdso.rockchat1.ru/` редиректятся на HTTPS.

## Nginx

Конфиг-образец: [`deploy/nginx/fdso.conf`](../deploy/nginx/fdso.conf).

На сервере лежит в `/etc/nginx/sites-available/fdso` (symlink в `sites-enabled`).

```bash
nginx -t && systemctl reload nginx
```

## SSL (Let's Encrypt)

Первичная выдача (уже сделана на стенде):

```bash
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d fdso.rockchat1.ru --agree-tos -m YOUR_EMAIL --redirect
```

Проверка обновления:

```bash
certbot renew --dry-run
systemctl status certbot.timer
```

Сертификат: `/etc/letsencrypt/live/fdso.rockchat1.ru/`.

## Обновление кода с машины разработки

```bash
rsync -az --delete \
  --exclude node_modules --exclude .git --exclude .cursor --exclude docs \
  --exclude images/uploads --exclude data --exclude .env \
  ./ root@94.232.46.243:/var/www/fdso/

ssh root@94.232.46.243 'cd /var/www/fdso && npm install --omit=dev && chown -R www-data:www-data /var/www/fdso && systemctl restart fdso'
```

## Полезные команды на сервере

```bash
systemctl status fdso nginx
journalctl -u fdso -f
systemctl restart fdso
```
