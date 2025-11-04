const puppeteer = require('puppeteer');
const qrcode = require('qrcode');
const fs = require('fs');
const path = require('path');

class WhatsAppService {
    constructor() {
        this.browser = null;
        this.page = null;
        this.isConnected = false;
        this.qrCode = null;
        this.sessionPath = process.env.WHATSAPP_SESSION_PATH || './whatsapp-session';
    }

    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    async initialize() {
        try {
            console.log('🔄 Inicializando WhatsApp Web...');
            
            this.browser = await puppeteer.launch({
                headless: false, // Deixar visível para debug
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ],
                userDataDir: this.sessionPath
            });

            this.page = await this.browser.newPage();
            await this.page.goto('https://web.whatsapp.com', {
                waitUntil: 'networkidle2',
                timeout: 60000
            });

            // Aguardar carregamento da página
            await this.sleep(3000);

            // Verificar se já está logado
            const isLoggedIn = await this.checkIfLoggedIn();
            
            if (isLoggedIn) {
                console.log('✅ WhatsApp já está conectado!');
                this.isConnected = true;
                return { success: true, message: 'WhatsApp conectado' };
            } else {
                console.log('📱 Aguardando QR Code...');
                return await this.waitForQRCode();
            }

        } catch (error) {
            console.error('❌ Erro ao inicializar WhatsApp:', error);
            throw error;
        }
    }

    async checkIfLoggedIn() {
        try {
            // Aguardar um dos elementos aparecer (QR code ou chat list)
            await this.page.waitForSelector('canvas[aria-label="Scan me!"], [data-testid="chat-list"]', {
                timeout: 10000
            });

            // Verificar se existe a lista de chats (indicando que está logado)
            const chatList = await this.page.$('[data-testid="chat-list"]');
            return !!chatList;
        } catch (error) {
            return false;
        }
    }

    async waitForQRCode() {
        try {
            // Aguardar QR code aparecer
            await this.page.waitForSelector('canvas[aria-label="Scan me!"]', { timeout: 30000 });
            
            // Capturar QR code
            const qrElement = await this.page.$('canvas[aria-label="Scan me!"]');
            const qrImage = await qrElement.screenshot();
            
            // Converter para base64
            this.qrCode = `data:image/png;base64,${qrImage.toString('base64')}`;
            
            console.log('📱 QR Code gerado. Escaneie com seu WhatsApp.');

            // Aguardar login (verificar se QR code desaparece)
            await this.page.waitForFunction(() => {
                const qr = document.querySelector('canvas[aria-label="Scan me!"]');
                return !qr;
            }, { timeout: 120000 }); // 2 minutos para escanear

            // Aguardar carregamento completo
            await this.page.waitForSelector('[data-testid="chat-list"]', { timeout: 30000 });
            
            this.isConnected = true;
            this.qrCode = null;
            console.log('✅ WhatsApp conectado com sucesso!');
            
            return { success: true, message: 'WhatsApp conectado' };

        } catch (error) {
            console.error('❌ Erro ao processar QR Code:', error);
            throw new Error('Timeout ou erro ao conectar WhatsApp');
        }
    }

    async sendMessage(phoneNumber, message) {
        if (!this.isConnected) {
            throw new Error('WhatsApp não está conectado');
        }

        try {
            // Limpar número (remover caracteres especiais)
            const cleanNumber = phoneNumber.replace(/\D/g, '');
            
            // Navegar para o chat
            const url = `https://web.whatsapp.com/send?phone=${cleanNumber}`;
            await this.page.goto(url, { waitUntil: 'networkidle2' });

            // Aguardar carregamento
            await this.sleep(3000);

            // Verificar se o número é válido
            const invalidNumber = await this.page.$('[data-testid="invalid-number"]');
            if (invalidNumber) {
                throw new Error(`Número inválido: ${phoneNumber}`);
            }

            // Aguardar caixa de mensagem
            await this.page.waitForSelector('[data-testid="conversation-compose-box-input"]', { timeout: 10000 });

            // Digitar mensagem
            await this.page.click('[data-testid="conversation-compose-box-input"]');
            await this.page.type('[data-testid="conversation-compose-box-input"]', message);

            // Enviar mensagem
            await this.page.click('[data-testid="send"]');
            
            // Aguardar envio
            await this.page.waitForTimeout(2000);

            console.log(`✅ Mensagem enviada para ${phoneNumber}`);
            return { success: true, phone: phoneNumber };

        } catch (error) {
            console.error(`❌ Erro ao enviar mensagem para ${phoneNumber}:`, error);
            throw error;
        }
    }

    async sendBulkMessages(recipients) {
        const results = [];
        
        for (let i = 0; i < recipients.length; i++) {
            const recipient = recipients[i];
            
            try {
                console.log(`📤 Enviando ${i + 1}/${recipients.length} para ${recipient.phone}`);
                
                await this.sendMessage(recipient.phone, recipient.message);
                results.push({
                    ...recipient,
                    success: true,
                    error: null
                });

                // Intervalo entre mensagens (evitar spam)
                if (i < recipients.length - 1) {
                    console.log('⏱️ Aguardando intervalo...');
                    await this.sleep(3000); // 3 segundos entre mensagens
                }

            } catch (error) {
                results.push({
                    ...recipient,
                    success: false,
                    error: error.message
                });
            }
        }

        return results;
    }

    getQRCode() {
        return this.qrCode;
    }

    getStatus() {
        return {
            isConnected: this.isConnected,
            hasQRCode: !!this.qrCode
        };
    }

    async disconnect() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
            this.isConnected = false;
            this.qrCode = null;
            console.log('🔌 WhatsApp desconectado');
        }
    }

    generateMessage(appointment) {
        const date = new Date(appointment.tratamento_date);
        const formattedDate = date.toLocaleDateString('pt-BR');
        const formattedTime = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

        return `🏥 *Confirmação de Agendamento*

Olá *${appointment.patient_name}*!

Você tem um agendamento marcado:
📅 *Data:* ${formattedDate}
🕐 *Horário:* ${formattedTime}
🔬 *Procedimento:* ${appointment.main_procedure_term}

Para confirmar seu agendamento, responda *SIM*.
Para reagendar, entre em contato conosco.

_Esta é uma mensagem automática do sistema de agendamentos._`;
    }
}

module.exports = new WhatsAppService();