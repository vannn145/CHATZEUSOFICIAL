# Configuração WhatsApp Business API

## 📋 Dados da Verificação

**Número Verificado:** +55 34 3199-3069
**Status:** ✅ Verificado no Meta Business

## 🔧 Configuração Necessária

### 1. Obter Credenciais do Meta Business

Acesse: https://developers.facebook.com/apps/

#### Dados necessários:
- **Access Token** (Token de Acesso)
- **Phone Number ID** (ID do Número de Telefone)
- **Business Account ID** (ID da Conta Business)
- **Webhook Verify Token** (Token de Verificação do Webhook)
- **Webhook Secret** (Segredo do Webhook)

### 2. Atualizar arquivo .env

```env
# WhatsApp Business API
WHATSAPP_MODE=business
WHATSAPP_ACCESS_TOKEN=SEU_ACCESS_TOKEN_AQUI
WHATSAPP_PHONE_NUMBER_ID=SEU_PHONE_NUMBER_ID_AQUI
WHATSAPP_BUSINESS_ACCOUNT_ID=SEU_BUSINESS_ACCOUNT_ID_AQUI
WHATSAPP_WEBHOOK_VERIFY_TOKEN=seu_token_verificacao
WHATSAPP_WEBHOOK_SECRET=seu_webhook_secret
```

### 3. Adicionar Certificado (se necessário)

Coloque o arquivo do certificado na pasta `certificates/`:
- Formatos aceitos: .pem, .crt
- Nome sugerido: `whatsapp-cert.pem`

### 4. Configurar Webhook

**URL do Webhook:** `https://SEU_DOMINIO.com/api/messages/whatsapp/webhook`

**Eventos para inscrever:**
- messages
- message_deliveries
- message_reads

### 5. Testar Configuração

```bash
# Reiniciar servidor
npm start

# Testar endpoint
curl -X GET "http://localhost:3000/api/messages/whatsapp/status"
```

## 🚀 Vantagens do WhatsApp Business API

1. **Maior Confiabilidade**: Não depende de automação de browser
2. **Rate Limits Maiores**: Pode enviar mais mensagens por minuto
3. **Webhooks**: Recebe confirmações automaticamente
4. **Status de Entrega**: Sabe quando mensagem foi entregue/lida
5. **Templates Aprovados**: Pode usar templates pré-aprovados

## 🔄 Alternar Entre Modos

O sistema suporta ambos os modos:

**WhatsApp Web (Puppeteer):**
```bash
curl -X POST http://localhost:3000/api/messages/whatsapp/mode \
  -H "Content-Type: application/json" \
  -d '{"mode": "web"}'
```

**WhatsApp Business API:**
```bash
curl -X POST http://localhost:3000/api/messages/whatsapp/mode \
  -H "Content-Type: application/json" \
  -d '{"mode": "business"}'
```

## 📊 Status da Integração

- ✅ **Número Verificado:** +55 34 3199-3069
- ⏳ **Credenciais API:** Pendente configuração
- ⏳ **Webhook:** Pendente configuração
- ⏳ **Certificado:** Opcional

## 🛠️ Próximos Passos

1. **Obter credenciais** no Meta Business Manager
2. **Atualizar .env** com as credenciais
3. **Testar conexão** com a API
4. **Configurar webhook** (opcional)
5. **Fazer primeiro disparo** de teste