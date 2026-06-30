#!/bin/bash
# Deploy do site de marketing Manfac
# Rodar na VPS: bash deploy/deploy-site.sh

set -e

REPO_DIR="/var/www/login-system"
SITE_DIR="$REPO_DIR/manfac-site"

echo "=== Puxando últimas alterações ==="
cd "$REPO_DIR"
git pull origin master

echo "=== Instalando dependências do site ==="
cd "$SITE_DIR"
npm ci --production=false

echo "=== Build do site ==="
npm run build

echo "=== Iniciando/reiniciando com PM2 ==="
cd "$REPO_DIR"
pm2 describe manfac-site > /dev/null 2>&1 \
  && pm2 reload deploy/ecosystem-site.config.js \
  || pm2 start deploy/ecosystem-site.config.js

pm2 save

echo ""
echo "Site rodando em http://$(curl -s ifconfig.me):3001"
echo "Deploy concluído!"
