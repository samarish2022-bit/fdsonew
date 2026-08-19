#!/usr/bin/env bash
# Deploy to test stand https://fdso.rockchat1.ru
# Usage: SSHPASS='your-root-password' ./scripts/deploy-rockchat.sh

set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
HOST="${FDSO_DEPLOY_HOST:-root@94.232.46.243}"
REMOTE_DIR="${FDSO_REMOTE_DIR:-/var/www/fdso}"

if [[ -z "${SSHPASS:-}" ]]; then
  echo "Set SSHPASS to the server root password, e.g.: SSHPASS='...' $0" >&2
  exit 1
fi

command -v sshpass >/dev/null || { echo "Install sshpass first" >&2; exit 1; }

SSH=(sshpass -e ssh -o StrictHostKeyChecking=no)
RSYNC=(sshpass -e rsync -az --delete
  --exclude node_modules --exclude .git --exclude .cursor --exclude docs
  --exclude images/uploads --exclude data --exclude .env
  --exclude .netlify --exclude .vercel
  -e "ssh -o StrictHostKeyChecking=no")

echo "→ Sync to ${HOST}:${REMOTE_DIR}"
if ! "${RSYNC[@]}" "${ROOT}/" "${HOST}:${REMOTE_DIR}/"; then
  echo "→ rsync failed, fallback to tar"
  tar -C "${ROOT}" -cf - \
    --exclude=node_modules --exclude=.git --exclude=.cursor --exclude=docs \
    --exclude=images/uploads --exclude=data --exclude=.env \
    --exclude=.netlify --exclude=.vercel \
    . | sshpass -e ssh -o StrictHostKeyChecking=no "${HOST}" "cd ${REMOTE_DIR} && tar -xf -"
fi

echo "→ npm install + restart fdso"
"${SSH[@]}" "${HOST}" "cd ${REMOTE_DIR} && npm install --omit=dev && chown -R www-data:www-data ${REMOTE_DIR} && systemctl restart fdso && systemctl is-active fdso"

echo "Done: https://fdso.rockchat1.ru"
