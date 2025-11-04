# Registro do Número WhatsApp Business

## 🚨 Problema Identificado

**Erro:** `Object with ID '771944609345651' does not exist`

**Causa:** O número precisa ser registrado na API do WhatsApp Business antes de ser usado.

## 📞 Dados do Número

- **Número:** +55 34 3199-3069
- **Phone Number ID:** 771944609345651 (não registrado)
- **Business Account ID:** 1876870716520569

## 🛠️ Soluções Disponíveis

### Opção 1: Registro Manual via API

```bash
# 1. Primeiro, configure o Access Token no .env
WHATSAPP_ACCESS_TOKEN=seu_token_aqui

# 2. Use nosso endpoint para registrar:
curl -X POST http://localhost:3000/api/messages/whatsapp/register-phone
```

### Opção 2: Verificar Números Disponíveis

```bash
# Listar números já registrados na conta:
curl http://localhost:3000/api/messages/whatsapp/phone-numbers
```

### Opção 3: Registro via Meta Business Manager

1. Acesse: https://business.facebook.com/
2. Vá em **Configurações** > **WhatsApp Business**
3. Clique em **Adicionar número de telefone**
4. Siga o processo de verificação

## 🔑 O que Você Precisa

### 1. Access Token (Obrigatório)
- Vá para: https://developers.facebook.com/
- Entre na sua app do WhatsApp
- Copie o Access Token
- Cole no .env: `WHATSAPP_ACCESS_TOKEN=EAAGxxxxx...`

### 2. Certificado (Opcional)
Se você tem o certificado do número:
- Converta para Base64
- Adicione no .env: `WHATSAPP_CERTIFICATE_BASE64=...`

### 3. PIN de Verificação (Se necessário)
- PIN de 6 dígitos para verificação
- Adicione no .env: `WHATSAPP_PIN=123456`

## ⚡ Processo Completo

### Passo 1: Configure o Access Token
```env
WHATSAPP_ACCESS_TOKEN=EAAGxxxxxxxxxxxxxxxxx
```

### Passo 2: Reinicie o Sistema
```bash
npm start
```

### Passo 3: Teste o Registro
```bash
# Via nossa API:
curl -X POST http://localhost:3000/api/messages/whatsapp/register-phone

# Ou verificar números disponíveis:
curl http://localhost:3000/api/messages/whatsapp/phone-numbers
```

### Passo 4: Verificar Status
```bash
curl http://localhost:3000/api/messages/whatsapp/status
```

## 🎯 Resultado Esperado

Após o registro bem-sucedido:
- ✅ Número aparecerá na lista de números registrados
- ✅ Phone Number ID será válido
- ✅ Poderá enviar mensagens via API

## 🔄 Alternativa: Usar WhatsApp Web

Se o registro do Business API der problema, você pode:

1. **Alterar para modo Web:**
```env
WHATSAPP_MODE=web
```

2. **Reiniciar e usar QR Code:**
```bash
npm start
# Acesse http://localhost:3000 e escaneie o QR Code
```

---

**Próximo passo: Obter o Access Token e registrar o número!** 🚀