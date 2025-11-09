#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/opt/disparador"
if [[ $EUID -ne 0 ]]; then
  echo "Este script precisa ser executado como root" >&2
  exit 1
fi

cd "$APP_DIR"

echo "Atualizando código..."
if [[ -d .git ]]; then
  git pull --ff-only || true
fi

echo "Instalando dependências..."
if [[ -f package-lock.json ]]; then
  npm ci || npm install
else
  npm install
fi

echo "Reiniciando PM2..."
pm2 restart disparador || pm2 start ecosystem.config.js --env production
pm2 save

echo "Feito."