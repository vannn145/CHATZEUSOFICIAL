#!/usr/bin/env bash
set -euo pipefail

# Setup inicial da VPS para rodar o disparador no domínio sistemazeus.com.br
# - Instala Node LTS, PM2, Nginx, Certbot
# - Clona o repositório e instala dependências
# - Cria .env se não existir
# - Sobe o app com PM2
# - Configura Nginx (sem SSL ainda)

APP_DIR="/opt/disparador"
REPO_URL="https://github.com/vannn145/CHATZEUSOFICIAL.git"
DOMAIN="sistemazeus.com.br"

if [[ $EUID -ne 0 ]]; then
  echo "Este script precisa ser executado como root" >&2
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt update -y
apt install -y git curl nginx

# Node LTS
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
  apt install -y nodejs
fi

# PM2
if ! command -v pm2 >/dev/null 2>&1; then
  npm i -g pm2
fi

# Certbot (SSL depois)
apt install -y certbot python3-certbot-nginx || true

# Código
mkdir -p "${APP_DIR}"
if [[ ! -d "${APP_DIR}/.git" ]]; then
  git clone "${REPO_URL}" "${APP_DIR}"
else
  echo "Repositório já existe em ${APP_DIR}"
fi
cd "${APP_DIR}"

# Dependências
if [[ -f package-lock.json ]]; then
  npm ci || npm install
else
  npm install
fi

# .env
if [[ ! -f .env ]]; then
  cp .env.example .env
  echo "ATENÇÃO: edite ${APP_DIR}/.env com DB_PASSWORD, WHATSAPP_* e ajuste WHATSAPP_MODE=business" >&2
fi

# PM2
pm2 start ecosystem.config.js --env production || pm2 start index.js --name disparador
pm2 save

# Nginx (HTTP, proxy para 127.0.0.1:3000)
cp -f ${APP_DIR}/config/nginx/sistemazeus.com.br.conf /etc/nginx/sites-available/${DOMAIN}
ln -sf /etc/nginx/sites-available/${DOMAIN} /etc/nginx/sites-enabled/${DOMAIN}
nginx -t && systemctl reload nginx

echo "\nSetup concluído. Próximo: emitir SSL com certbot e preencher .env."