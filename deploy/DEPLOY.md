# Deploy Manual — Manfac Portal

## Pré-requisitos

- VPS com Ubuntu 20.04+ na Hostinger
- Acesso SSH como root
- Projeto no GitHub (privado)

---

## Fase 1 — Deploy com IP (sem domínio)

### 1. Setup inicial da VPS (só na primeira vez)

```bash
ssh root@IP_DA_VPS
bash <(curl -s https://raw.githubusercontent.com/SEU_USER/manfac-portal/main/deploy/setup-vps.sh)
```

Ou copie e cole o conteúdo de `deploy/setup-vps.sh` direto no terminal.

### 2. Clonar o repositório na VPS

```bash
cd /var/www
git clone https://github.com/SEU_USER/manfac-portal.git
cd manfac-portal
```

### 3. Configurar variáveis de ambiente

```bash
cp .env.local.example .env.local
nano .env.local
```

Preencha com os valores reais:

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...
NEXT_PUBLIC_SITE_URL=http://IP_DA_VPS
```

### 4. Build e iniciar

```bash
npm ci
npm run build
pm2 start deploy/ecosystem.config.js
pm2 save
pm2 startup  # siga as instruções para auto-start no boot
```

### 5. Configurar Nginx

```bash
cp deploy/nginx-http.conf /etc/nginx/sites-available/manfac-portal
ln -s /etc/nginx/sites-available/manfac-portal /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl restart nginx
```

### 6. Atualizar Supabase para aceitar HTTP

No Supabase Dashboard → Authentication → URL Configuration:
- **Site URL:** `http://IP_DA_VPS`
- **Redirect URLs:** `http://IP_DA_VPS/**`

### 7. Verificar

Acesse `http://IP_DA_VPS` — deve redirecionar para a tela de login da Manfac.

---

## Fase 2 — Adicionar domínio + HTTPS (quando o domínio estiver disponível)

### 1. Apontar DNS do domínio para o IP da VPS

No painel do seu registrador:
- Registro **A** → `@` → `IP_DA_VPS`
- Registro **A** → `www` → `IP_DA_VPS`

Aguardar propagação (até 24h, geralmente menos de 1h na Hostinger).

### 2. Instalar Certbot

```bash
apt install -y certbot python3-certbot-nginx
```

### 3. Atualizar nginx.conf para HTTPS

```bash
# Substituir o nome do domínio no arquivo
sed -i 's/SEU_DOMINIO_AQUI/seudominio.com.br/g' deploy/nginx-https.conf

cp deploy/nginx-https.conf /etc/nginx/sites-available/manfac-portal
nginx -t && systemctl reload nginx
```

### 4. Obter certificado SSL

```bash
certbot --nginx -d seudominio.com.br -d www.seudominio.com.br
```

### 5. Atualizar .env.local na VPS

```bash
nano /var/www/manfac-portal/.env.local
# Alterar: NEXT_PUBLIC_SITE_URL=https://seudominio.com.br
```

### 6. Rebuild e restart

```bash
cd /var/www/manfac-portal
npm run build
pm2 reload manfac-portal
```

### 7. Atualizar Supabase

No Supabase Dashboard → Authentication → URL Configuration:
- **Site URL:** `https://seudominio.com.br`
- **Redirect URLs:** adicionar `https://seudominio.com.br/**`

---

## Deploy de atualizações

Após commitar e dar push no GitHub:

```bash
ssh root@IP_DA_VPS "cd /var/www/manfac-portal && bash deploy/deploy.sh"
```

---

## Comandos úteis

```bash
pm2 status              # ver se a app está rodando
pm2 logs manfac-portal  # ver logs em tempo real
pm2 restart manfac-portal  # reiniciar manualmente
systemctl status nginx  # status do Nginx
```
