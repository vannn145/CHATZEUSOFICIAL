# Deploy do Disparador WhatsApp (sistemazeus.com.br)

Este guia cobre a publicação do sistema em uma VPS (ex.: Ubuntu 22.04) usando:
- Node.js + PM2 para executar o app
- Nginx como reverse proxy (com SSL Let's Encrypt)
- Tailscale (ou VPN/rota) para conectar no PostgreSQL 100.99.99.36

Mantemos o sistema já existente acessível pelo IP e servimos este projeto exclusivamente pelo domínio sistemazeus.com.br.

## 1) Pré‑requisitos na VPS

- Acesso SSH com usuário sudo
- DNS do domínio apontando para a VPS (A/AAAA) – você já apontou para 72.61.217.71
- Firewall liberado para portas 80 e 443

Opcional, mas recomendado:
- Tailscale instalado para acesso ao banco em 100.99.99.36 (ou configure a rota/VPN equivalente)

## 2) Instalar dependências

```bash
# Ubuntu
sudo apt update -y
sudo apt install -y nginx git curl

# Node.js LTS (via NodeSource)
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs

# PM2 (gerenciador de processos)
sudo npm i -g pm2
pm2 startup systemd -u $USER --hp $HOME

# Certbot (Let's Encrypt)
sudo apt install -y certbot python3-certbot-nginx

# (Opcional) Tailscale para alcançar 100.99.99.36
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

## 3) Obter o código na VPS

```bash
cd /opt
sudo mkdir -p disparador && sudo chown "$USER":"$USER" disparador
cd disparador

# Se estiver usando git:
# git clone <repo-url> .
# ou envie os arquivos via SCP/rsync/ZIP e extraia aqui

npm ci || npm install
```

## 4) Configurar variáveis (.env)

Crie um arquivo `.env` baseado no `.env.example` deste repositório:

```bash
cp .env.example .env
nano .env
```

Campos importantes:
- PORT=3000 (padrão)
- DB_HOST=100.99.99.36 (via Tailscale)
- DB_PORT=5432
- DB_USER, DB_PASSWORD, DB_NAME
- WHATSAPP_MODE=business (produção)
- WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_BUSINESS_ACCOUNT_ID (se aplicável)
- WHATSAPP_WEBHOOK_VERIFY_TOKEN e WHATSAPP_WEBHOOK_SECRET (se usar webhooks)

> Segurança: não commitar o `.env` no git.

## 5) Rodar com PM2

```bash
pm2 start ecosystem.config.js --env production
pm2 save
```

- Para logs: `pm2 logs disparador`
- Para restart: `pm2 restart disparador`

## 6) Nginx como reverse proxy (mantendo o site atual por IP)

Crie um server block dedicado ao domínio, sem alterar o site já existente (default_server). Exemplo:

```nginx
# /etc/nginx/sites-available/sistemazeus.com.br
server {
    listen 80;
    listen [::]:80;
    server_name sistemazeus.com.br www.sistemazeus.com.br;

    # Proxy para o Node (HTTP)
    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Ativar site e testar config:

```bash
sudo ln -s /etc/nginx/sites-available/sistemazeus.com.br /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Gerar SSL com Let's Encrypt:

```bash
sudo certbot --nginx -d sistemazeus.com.br -d www.sistemazeus.com.br
```

Isso criará o server HTTPS e manterá o default atual respondendo ao IP. Ou seja:
- Acesso por IP (http://72.61.217.71) continua mostrando o site antigo (default_server)
- Acesso por domínio (https://sistemazeus.com.br) aponta para este app Node

## 7) Health checks pós‑deploy

- https://sistemazeus.com.br/ → deve carregar a interface
- https://sistemazeus.com.br/privacy → deve abrir a Política de Privacidade
- https://sistemazeus.com.br/api/messages/appointments/stats → deve retornar JSON com totais

Envio de template (pode falhar com 133010 se a conta/número ainda não estiverem no Cloud):

```bash
curl -sS -X POST https://sistemazeus.com.br/api/messages/test-template \
  -H 'Content-Type: application/json' \
  -d '{"phone":"+5511999999999","templateName":"hello_world","languageCode":"en_US"}' | jq
```

## 8) Observações sobre WhatsApp Cloud (erro 133010)

Se ainda aparecer `(#133010) Account not registered` ao enviar:
- Garanta que o número está na plataforma CLOUD e vinculado à mesma WABA do App
- Conecte o App em WhatsApp Manager > Accounts > WhatsApp Accounts > Connected apps
- Gere o token de um System User com permissões WhatsApp Business Messaging/Management
- Teste o envio na tela “API Setup”; depois repita o teste via nossa rota

## 9) Atualizações

```bash
cd /opt/disparador
git pull # (se estiver usando git)
npm ci || npm install
pm2 restart disparador
```

## 10) Backup/sessão Web (se usar modo web)

No modo `web`, a pasta `whatsapp-session/` guarda o estado de login. Garanta backup/permissões se usar Puppeteer. Em produção, preferir `WHATSAPP_MODE=business`.

---
Se preferir, posso executar esses passos via SSH e deixar tudo pronto pra você.
