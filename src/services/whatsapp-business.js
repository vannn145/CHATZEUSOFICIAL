const axios = require('axios');
const fs = require('fs');
const path = require('path');

class WhatsAppBusinessService {
    constructor() {
        this.accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
        this.phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
        this.businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
        this.apiVersion = process.env.WHATSAPP_API_VERSION || 'v18.0';
        this.baseURL = `https://graph.facebook.com/${this.apiVersion}`;
        this.webhookVerifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
        
        // Configurar axios com certificado se disponível
        this.setupHttpsAgent();
    }

    setupHttpsAgent() {
        const certPath = path.join(__dirname, '../../certificates');
        
        try {
            // Verificar se há certificados disponíveis
            const certFiles = fs.readdirSync(certPath);
            const certFile = certFiles.find(file => file.endsWith('.pem') || file.endsWith('.crt'));
            
            if (certFile) {
                const cert = fs.readFileSync(path.join(certPath, certFile));
                console.log('📜 Certificado WhatsApp Business carregado');
                
                // Configurar agent HTTPS com certificado
                const https = require('https');
                this.httpsAgent = new https.Agent({
                    cert: cert,
                    rejectUnauthorized: false // Ajustar conforme necessário
                });
            }
        } catch (error) {
            console.log('⚠️  Nenhum certificado encontrado, usando configuração padrão');
        }
    }

    async registerPhoneNumber() {
        // Cloud API não permite mais registrar números via endpoint programático.
        // O registro deve ser feito no WhatsApp Manager (API Setup) ou pelo Embedded Signup.
        // Mantemos este método apenas para não quebrar chamadas existentes e para
        // retornar uma mensagem clara.
        const err = new Error('Registro de número via API descontinuado. Use o WhatsApp Manager (API Setup) para adicionar/registrar o número e vincular o App à WABA.');
        err.code = 'REGISTRATION_UNSUPPORTED';
        throw err;
    }

    async verifyConfiguration() {
        if (!this.accessToken || !this.phoneNumberId) {
            throw new Error('Configuração incompleta: ACCESS_TOKEN e PHONE_NUMBER_ID são obrigatórios');
        }

        try {
            // Primeiro tentar verificar se o número existe
            const response = await axios.get(
                `${this.baseURL}/${this.phoneNumberId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`
                    },
                    httpsAgent: this.httpsAgent
                }
            );

            console.log('✅ WhatsApp Business API configurado corretamente');
            console.log(`📱 Número verificado: ${response.data.display_phone_number}`);
            return response.data;
            
        } catch (error) {
            // Devolver erro com orientação quando o número/app não for encontrado
            const details = error.response?.data?.error;
            const code = details?.code;
            const subcode = details?.error_subcode;
            const hint =
                code === 100 || error.response?.status === 404
                    ? 'Verifique se o PHONE_NUMBER_ID pertence à WABA configurada e se o App está conectado em WhatsApp Manager > Accounts > WhatsApp Accounts > Connected apps.'
                    : code === 133010
                        ? 'Account not registered: conecte o App à WABA e gere um token (System User) com WhatsApp Business Messaging/Management. Teste o envio na página API Setup.'
                        : undefined;

            const friendly = new Error(`Falha na verificação do WhatsApp Business API${hint ? ` – ${hint}` : ''}`);
            friendly.original = error.response?.data || error.message;
            throw friendly;
        }
    }

    async sendMessage(to, message, type = 'text') {
        try {
            // Limpar número (remover caracteres especiais)
            const cleanNumber = to.replace(/\D/g, '');
            
            const payload = {
                messaging_product: 'whatsapp',
                to: cleanNumber,
                type: type
            };

            if (type === 'text') {
                payload.text = { body: message };
            }

            const response = await axios.post(
                `${this.baseURL}/${this.phoneNumberId}/messages`,
                payload,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    httpsAgent: this.httpsAgent
                }
            );

            console.log(`✅ Mensagem enviada para ${cleanNumber} via Business API`);
            return {
                success: true,
                messageId: response.data.messages[0].id,
                phone: cleanNumber
            };

        } catch (error) {
            console.error(`❌ Erro ao enviar mensagem:`, error.response?.data || error.message);
            throw error;
        }
    }

    async sendTemplateMessage(to, templateName = 'hello_world', languageCode = 'en_US', components = []) {
        try {
            const cleanNumber = to.replace(/\D/g, '');
            const payload = {
                messaging_product: 'whatsapp',
                to: cleanNumber,
                type: 'template',
                template: {
                    name: templateName,
                    language: { code: languageCode },
                }
            };
            if (components && components.length) {
                payload.template.components = components;
            }

            const response = await axios.post(
                `${this.baseURL}/${this.phoneNumberId}/messages`,
                payload,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    },
                    httpsAgent: this.httpsAgent
                }
            );

            console.log(`✅ Template '${templateName}' enviado para ${cleanNumber}`);
            return {
                success: true,
                messageId: response.data.messages?.[0]?.id,
                phone: cleanNumber,
                response: response.data
            };
        } catch (error) {
            console.error('❌ Erro ao enviar template:', error.response?.data || error.message);
            throw error;
        }
    }

    async sendBulkMessages(recipients) {
        const results = [];
        
        for (let i = 0; i < recipients.length; i++) {
            const recipient = recipients[i];
            
            try {
                console.log(`📤 Enviando ${i + 1}/${recipients.length} para ${recipient.phone}`);
                
                const result = await this.sendMessage(recipient.phone, recipient.message);
                results.push({
                    ...recipient,
                    success: true,
                    messageId: result.messageId,
                    error: null
                });

                // Intervalo entre mensagens (evitar rate limiting)
                if (i < recipients.length - 1) {
                    console.log('⏱️ Aguardando intervalo...');
                    await new Promise(resolve => setTimeout(resolve, 1000)); // 1 segundo
                }

            } catch (error) {
                results.push({
                    ...recipient,
                    success: false,
                    messageId: null,
                    error: error.message
                });
            }
        }

        return results;
    }

    async getMessageStatus(messageId) {
        try {
            const response = await axios.get(
                `${this.baseURL}/${messageId}`,
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`
                    },
                    httpsAgent: this.httpsAgent
                }
            );

            return response.data;
        } catch (error) {
            console.error('Erro ao verificar status:', error.response?.data || error.message);
            throw error;
        }
    }

    // Webhook para receber respostas/confirmações
    handleWebhook(body, signature) {
        // Verificar assinatura do webhook
        const crypto = require('crypto');
        const expectedSignature = crypto
            .createHmac('sha256', process.env.WHATSAPP_WEBHOOK_SECRET)
            .update(JSON.stringify(body))
            .digest('hex');

        if (signature !== `sha256=${expectedSignature}`) {
            throw new Error('Assinatura inválida');
        }

        // Processar mensagens recebidas
        const changes = body.entry?.[0]?.changes?.[0];
        if (changes?.field === 'messages') {
            const messages = changes.value?.messages || [];
            const statuses = changes.value?.statuses || [];

            // Processar mensagens recebidas (confirmações)
            messages.forEach(message => {
                if (message.type === 'text') {
                    const text = message.text.body.toLowerCase();
                    const from = message.from;

                    // Verificar se é uma confirmação
                    if (['sim', 's', 'confirmo', 'ok'].includes(text)) {
                        console.log(`✅ Confirmação recebida de ${from}: ${text}`);
                        // Aqui você pode atualizar o banco de dados
                        this.processConfirmation(from, message.id);
                    }
                }
            });

            // Processar status de entrega
            statuses.forEach(status => {
                console.log(`📊 Status da mensagem ${status.id}: ${status.status}`);
            });
        }

        return { success: true };
    }

    async processConfirmation(phoneNumber, messageId) {
        // Implementar lógica para confirmar agendamento no banco
        // Buscar agendamento pelo número de telefone e marcar como confirmado
        try {
            const dbService = require('./database');
            // Lógica para encontrar e confirmar agendamento
            console.log(`🔄 Processando confirmação de ${phoneNumber}`);
        } catch (error) {
            console.error('Erro ao processar confirmação:', error);
        }
    }

    generateMessage(appointment) {
        const date = new Date(appointment.tratamento_date);
        const formattedDate = date.toLocaleDateString('pt-BR');
        const formattedTime = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        return `🏥 *Confirmação de Agendamento*

Olá *${appointment.patient_name}*!

Você tem um agendamento marcado na CD CENTER UBERABA:
📅 *Data:* ${formattedDate}
🕐 *Horário:* ${formattedTime}
🔬 *Procedimento:* ${appointment.main_procedure_term}

Para confirmar seu agendamento, responda *SIM*.
Para reagendar, entre em contato: (34) 3199-3069

_Esta é uma mensagem automática do sistema de agendamentos._`;
    }

    getStatus() {
        return {
            isConfigured: !!(this.accessToken && this.phoneNumberId),
            hasApiAccess: true,
            phoneNumber: '+55 34 3199-3069'
        };
    }
}

module.exports = new WhatsAppBusinessService();