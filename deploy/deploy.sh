#!/bin/bash
# Deploy do Manfac Portal na VPS
# Rodar como root na VPS: bash deploy.sh
# Ou remotamente: ssh root@IP "cd /var/www/manfac-portal && bash deploy/deploy.sh"

set -e

APP_DIR="/var/www/manfac-portal"

echo "=== Entrando no diretório da aplicação ==="
cd "$APP_DIR"

echo "=== Puxando últimas alterações ==="
git pull origin main

echo "=== Instalando dependências ==="
npm ci --production=false

echo "=== Fazendo build ==="
npm run build

echo "=== Reiniciando aplicação com PM2 ==="
pm2 describe manfac-portal > /dev/null 2>&1 \
  && pm2 reload ecosystem.config.js \
  || pm2 start deploy/ecosystem.config.js

echo "=== Salvando configuração PM2 (auto-start no boot) ==="
pm2 save

echo ""
echo "Deploy concluído! Aplicação rodando em http://$(curl -s ifconfig.me)"
