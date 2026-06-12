#!/bin/bash
# Setup inicial da VPS para o Manfac Portal
# Rodar como root: bash setup-vps.sh

set -e

echo "=== Atualizando sistema ==="
apt update && apt upgrade -y

echo "=== Instalando Node.js 20 (LTS) ==="
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

echo "=== Instalando PM2 ==="
npm install -g pm2

echo "=== Instalando Nginx ==="
apt install -y nginx

echo "=== Criando diretório da aplicação ==="
mkdir -p /var/www/manfac-portal

echo "=== Node version: $(node -v) ==="
echo "=== NPM version: $(npm -v) ==="
echo "=== PM2 version: $(pm2 -v) ==="
echo ""
echo "Setup concluído. Próximo passo: rodar deploy.sh"
