# Como Obter o Access Token do WhatsApp Business

## 📋 Dados Configurados

✅ **Número de Telefone:** +55 34 3199 3069  
✅ **Phone Number ID:** 771944609345651  
✅ **Business Account ID:** 1876870716520569  
⏳ **Access Token:** Pendente

## 🔑 Obter Access Token

### Passo 1: Acesse o Meta for Developers
1. Vá para: https://developers.facebook.com/
2. Faça login com sua conta Meta/Facebook

### Passo 2: Encontre sua App
1. Clique em **"Meus Apps"** (My Apps)
2. Selecione a aplicação do WhatsApp Business

### Passo 3: Gerar Access Token
1. No menu lateral, clique em **"WhatsApp"** > **"API Setup"**
2. Na seção **"Access Token"**, você verá:
   - **Temporary Access Token** (válido por 24h)
   - **Permanent Access Token** (recomendado)

### Passo 4: Token Temporário (Teste Rápido)
```
Copie o token temporário e cole no .env:
WHATSAPP_ACCESS_TOKEN=EAAG... (o token começará com EAA)
```

### Passo 5: Token Permanente (Produção)
1. Clique em **"Generate Token"**
2. Selecione as permissões:
   - `whatsapp_business_messaging`
   - `whatsapp_business_management`
3. Copie o token gerado

## 🚀 Teste Imediato

Após configurar o token, teste:

```bash
# Reiniciar sistema
npm start

# Verificar status
curl http://localhost:3000/api/messages/whatsapp/status
```

## 🔧 Configuração Completa do .env

```env
# WhatsApp Business API
WHATSAPP_MODE=business
WHATSAPP_ACCESS_TOKEN=EAAGxxxxxxxxxxxxxxxxxxxxx
WHATSAPP_PHONE_NUMBER_ID=771944609345651
WHATSAPP_BUSINESS_ACCOUNT_ID=1876870716520569
WHATSAPP_API_VERSION=v18.0
```

## ⚡ Teste de Envio

Depois de configurar, você pode testar enviando uma mensagem:

1. **Na interface web:** Altere para modo "Business API"
2. **Teste:** Use o botão "Teste de Mensagem"
3. **Envie para seu próprio número** primeiro

## 🎯 Próximos Passos

1. ✅ Obter Access Token
2. ✅ Atualizar .env
3. ✅ Reiniciar sistema
4. ✅ Testar envio individual
5. ✅ Fazer disparo em massa

---

**Estamos muito próximos de ter o sistema completo funcionando!** 🚀