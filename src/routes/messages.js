const express = require('express');
const router = express.Router();
const dbService = require('../services/database');
const whatsappService = require('../services/whatsapp-hybrid');
const whatsappBusiness = require('../services/whatsapp-business');
const axios = require('axios');

// Utilitário: extrair o primeiro telefone válido (formato E.164 BR) de um campo livre
function pickFirstPhone(raw) {
    if (!raw) return null;
    const parts = String(raw).split(/[;|,\n\r\t]/g);
    for (const p of parts) {
        const digits = (p.match(/\d+/g) || []).join('');
        if (!digits) continue;
        let n = digits;
        // Se já vier com 55 e 12-13 dígitos, mantém; se 10-11 dígitos, prefixa 55
        if (n.startsWith('55')) {
            // ok
        } else if (n.length >= 10 && n.length <= 11) {
            n = '55' + n;
        }
        if (n.length >= 12 && n.length <= 13) return `+${n}`;
    }
    return null;
}

// Conectar WhatsApp (Web ou Business)
router.post('/whatsapp/connect', async (req, res) => {
    try {
        const result = await whatsappService.initialize();
        res.json(result);
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Listar usuários atribuídos à WABA (verifica se o System User tem o ativo e tarefas)
router.get('/whatsapp/waba/assigned-users', async (req, res) => {
    try {
        const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
        const apiVersion = process.env.WHATSAPP_API_VERSION || 'v18.0';
        const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
        if (!accessToken || !wabaId) return res.status(400).json({ success: false, message: 'Configuração incompleta' });

        const response = await axios.get(`https://graph.facebook.com/${apiVersion}/${wabaId}/assigned_users`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            params: { fields: 'id,name,business_role,tasks' }
        });
        res.json({ success: true, data: response.data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message, details: error.response?.data });
    }
});

// Alternar modo WhatsApp
router.post('/whatsapp/mode', async (req, res) => {
    try {
        const { mode } = req.body;
        const success = await whatsappService.switchMode(mode);
        
        if (success) {
            res.json({ 
                success: true, 
                message: `Modo alterado para ${mode}`,
                newMode: mode
            });
        } else {
            res.status(400).json({
                success: false,
                message: 'Modo inválido. Use "web" ou "business"'
            });
        }
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Status do WhatsApp
router.get('/whatsapp/status', (req, res) => {
    const status = whatsappService.getStatus();
    const qrCode = whatsappService.getQRCode();
    
    res.json({
        ...status,
        qrCode
    });
});

// Registrar número no WhatsApp Business – DESCONTINUADO pela Meta (Cloud/On-Prem)
router.post('/whatsapp/register-phone', async (req, res) => {
    return res.status(410).json({
        success: false,
        message: 'Registro de número via API foi descontinuado pela Meta. Adicione/registre o número no WhatsApp Manager (API Setup) e conecte o App na WABA.'
    });
});

// Listar números disponíveis
router.get('/whatsapp/phone-numbers', async (req, res) => {
    try {
        const axios = require('axios');
        const businessAccountId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
        const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
        
        const response = await axios.get(
            `https://graph.facebook.com/v18.0/${businessAccountId}/phone_numbers`,
            {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            }
        );
        
        res.json({ 
            success: true, 
            data: response.data 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message,
            details: error.response?.data
        });
    }
});

// Webhook para WhatsApp Business API
router.get('/whatsapp/webhook', (req, res) => {
    const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === verifyToken) {
        console.log('✅ Webhook verificado com sucesso');
        res.status(200).send(challenge);
    } else {
        console.log('❌ Verificação de webhook falhou');
        res.status(403).send('Forbidden');
    }
});

router.post('/whatsapp/webhook', (req, res) => {
    try {
        const signature = req.headers['x-hub-signature-256'];
        const result = whatsappService.handleWebhook(req.body, signature);
        res.json(result);
    } catch (error) {
        console.error('Erro no webhook:', error);
        res.status(400).json({ error: error.message });
    }
});

// Desconectar WhatsApp
router.post('/whatsapp/disconnect', async (req, res) => {
    try {
        await whatsappService.disconnect();
        res.json({ success: true, message: 'WhatsApp desconectado' });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// ================= On-Premises (Business API On-Prem) =================
// Solicitar código de registro
router.post('/waba-onprem/request-code', async (req, res) => {
    try {
        const onprem = require('../services/whatsapp-onprem');
        const { cc, phone_number, method, cert } = req.body || {};
        const result = await onprem.requestRegistrationCode({ cc, phone_number, method, cert });
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message
        });
    }
});

// Verificar código de registro
router.post('/waba-onprem/verify', async (req, res) => {
    try {
        const onprem = require('../services/whatsapp-onprem');
        const { code, cert, pin, vname } = req.body || {};
        if (!code) {
            return res.status(400).json({ success: false, message: 'Campo "code" é obrigatório' });
        }
        const result = await onprem.verifyRegistrationCode({ code, cert, pin, vname });
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message
        });
    }
});

// Listar agendamentos não confirmados
router.get('/appointments/pending', async (req, res) => {
    try {
        const appointments = await dbService.getUnconfirmedAppointments();
        res.json({ success: true, data: appointments });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Estatísticas de agendamentos
router.get('/appointments/stats', async (req, res) => {
    try {
        const stats = await dbService.getAppointmentStats();
        res.json({ success: true, data: stats });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Confirmar agendamento manualmente
router.post('/appointments/:id/confirm', async (req, res) => {
    try {
        const { id } = req.params;
        const result = await dbService.confirmAppointment(id);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Enviar mensagem para um agendamento específico
router.post('/send/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { customMessage } = req.body;

        // Buscar dados do agendamento
        const appointment = await dbService.getAppointmentById(id);
        if (!appointment) {
            return res.status(404).json({ 
                success: false, 
                message: 'Agendamento não encontrado' 
            });
        }

        // Gerar mensagem
        const message = customMessage || whatsappService.generateMessage(appointment);
        const phone = pickFirstPhone(appointment.patient_contacts) || appointment.patient_contacts;
        
        // Enviar mensagem
        const result = await whatsappService.sendMessage(phone, message);

        res.json({ 
            success: true, 
            data: { 
                appointment, 
                result 
            } 
        });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message,
            details: error.response?.data
        });
    }
});

// Disparo em massa
router.post('/send/bulk', async (req, res) => {
    try {
        const { appointmentIds, customMessage } = req.body;

        if (!appointmentIds || !Array.isArray(appointmentIds)) {
            return res.status(400).json({
                success: false,
                message: 'IDs de agendamentos são obrigatórios'
            });
        }

        // Buscar agendamentos
        const recipients = [];
        for (const id of appointmentIds) {
            const appointment = await dbService.getAppointmentById(id);
            if (appointment && appointment.patient_contacts) {
                const phone = pickFirstPhone(appointment.patient_contacts) || appointment.patient_contacts;
                recipients.push({
                    id: appointment.id,
                    phone,
                    message: customMessage || whatsappService.generateMessage(appointment),
                    patientName: appointment.patient_name
                });
            }
        }

        if (recipients.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Nenhum agendamento válido encontrado'
            });
        }

        // Enviar mensagens
        console.log(`🚀 Iniciando disparo em massa para ${recipients.length} destinatários...`);
        const results = await whatsappService.sendBulkMessages(recipients);

        // Contar sucessos e falhas
        const successful = results.filter(r => r.success).length;
        const failed = results.filter(r => !r.success).length;

        res.json({
            success: true,
            data: {
                total: recipients.length,
                successful,
                failed,
                results
            }
        });

    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message,
            details: error.response?.data
        });
    }
});

// Teste de mensagem
router.post('/test', async (req, res) => {
    try {
        const { phone, message } = req.body;

        if (!phone || !message) {
            return res.status(400).json({
                success: false,
                message: 'Telefone e mensagem são obrigatórios'
            });
        }

        const result = await whatsappService.sendMessage(phone, message);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message,
            details: error.response?.data
        });
    }
});

module.exports = router;

// ================= DEBUG (temporário) =================
// Inspeção rápida do schema para ajustar JOINs
router.get('/debug/db-columns', async (req, res) => {
    const { Pool } = require('pg');
    const pool = new Pool({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: false,
    });

    try {
        const client = await pool.connect();

        const queries = {
            sadt: `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'sadt' ORDER BY ordinal_position`,
            schedule_v: `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'schedule_v' ORDER BY ordinal_position`,
        };

        const [sadtCols, scheduleVCols] = await Promise.all([
            client.query(queries.sadt).then(r => r.rows),
            client.query(queries.schedule_v).then(r => r.rows).catch(err => ({ error: err.message })),
        ]);

        // Amostras de linhas para inferir chaves
        let sadtSample = [];
        let scheduleVSample = [];
        try {
            sadtSample = (await client.query('SELECT * FROM sadt LIMIT 3')).rows;
        } catch (e) { sadtSample = [{ error: e.message }]; }
        try {
            scheduleVSample = (await client.query('SELECT * FROM schedule_v LIMIT 3')).rows;
        } catch (e) { scheduleVSample = [{ error: e.message }]; }

        client.release();
        await pool.end();

        res.json({
            success: true,
            data: {
                sadt: { columns: sadtCols, sample: sadtSample },
                schedule_v: { columns: scheduleVCols, sample: scheduleVSample },
            }
        });
    } catch (error) {
        try { await pool.end(); } catch {}
        res.status(500).json({ success: false, message: error.message });
    }
});

// Enviar mensagem por template (Cloud API)
router.post('/test-template', async (req, res) => {
    try {
        const { phone, templateName, languageCode, components } = req.body || {};
        if (!phone) {
            return res.status(400).json({ success: false, message: 'Telefone é obrigatório' });
        }
        const name = templateName || 'hello_world';
        const lang = languageCode || 'en_US';
        const result = await whatsappBusiness.sendTemplateMessage(phone, name, lang, components || []);
        res.json({ success: true, data: result });
    } catch (error) {
        res.status(500).json({ 
            success: false, 
            message: error.message,
            details: error.response?.data
        });
    }
});

// ================= Cloud API - Diagnóstico WABA/App =================
router.get('/whatsapp/diagnostics', async (req, res) => {
    try {
        const axios = require('axios');
        const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
        const apiVersion = process.env.WHATSAPP_API_VERSION || 'v18.0';
        const baseURL = `https://graph.facebook.com/${apiVersion}`;

        // Trazer visão geral: usuário, businesses, WABAs, números e apps inscritos
        const fields = [
            'id',
            'name',
            'businesses{id,name,owned_whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,verified_name,code_verification_status,platform_type,throughput},subscribed_apps{id,name}}}'
        ].join(',');

        const meResp = await axios.get(`${baseURL}/me`, {
            params: { fields },
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        res.json({ success: true, data: meResp.data });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message,
            details: error.response?.data
        });
    }
});

// ================= Diagnostics WhatsApp Cloud API =================
// Verificar informações do token (app_id, scopes, expiração)
router.get('/whatsapp/debug-token', async (req, res) => {
    try {
        const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
        const apiVersion = process.env.WHATSAPP_API_VERSION || 'v18.0';
        if (!accessToken) return res.status(400).json({ success: false, message: 'Token não configurado' });

        const response = await axios.get(`https://graph.facebook.com/${apiVersion}/debug_token`, {
            params: { input_token: accessToken, access_token: accessToken }
        });
        res.json({ success: true, data: response.data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message, details: error.response?.data });
    }
});

// Listar apps inscritos (se suportado) na WABA
router.get('/whatsapp/waba/subscribed-apps', async (req, res) => {
    try {
        const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
        const apiVersion = process.env.WHATSAPP_API_VERSION || 'v18.0';
        const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
        if (!accessToken || !wabaId) return res.status(400).json({ success: false, message: 'Configuração incompleta' });

        const response = await axios.get(`https://graph.facebook.com/${apiVersion}/${wabaId}/subscribed_apps`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        res.json({ success: true, data: response.data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message, details: error.response?.data });
    }
});

// Listar templates da WABA (valida permissão de messaging/management)
router.get('/whatsapp/waba/templates', async (req, res) => {
    try {
        const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
        const apiVersion = process.env.WHATSAPP_API_VERSION || 'v18.0';
        const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
        if (!accessToken || !wabaId) return res.status(400).json({ success: false, message: 'Configuração incompleta' });

        const response = await axios.get(`https://graph.facebook.com/${apiVersion}/${wabaId}/message_templates`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        res.json({ success: true, data: response.data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message, details: error.response?.data });
    }
});

// Pré-checagem consolidada (Cloud API): valida token, app conectado, número e plataforma
router.get('/whatsapp/preflight', async (req, res) => {
    try {
        const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
        const apiVersion = process.env.WHATSAPP_API_VERSION || 'v18.0';
        const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
        const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
        const baseURL = `https://graph.facebook.com/${apiVersion}`;
        if (!accessToken || !wabaId || !phoneId) {
            return res.status(400).json({ success: false, message: 'Defina WHATSAPP_ACCESS_TOKEN, WHATSAPP_BUSINESS_ACCOUNT_ID e WHATSAPP_PHONE_NUMBER_ID no .env' });
        }

        // 1) Token → app_id e scopes
        const dbg = await axios.get(`${baseURL}/debug_token`, {
            params: { input_token: accessToken, access_token: accessToken }
        }).then(r => r.data?.data);
        const appId = dbg?.app_id;
        const scopes = dbg?.scopes || [];

        // 2) WABA → apps conectados
        const subs = await axios.get(`${baseURL}/${wabaId}/subscribed_apps`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        }).then(r => r.data?.data || []);
        const appConnected = !!subs.find(s => (s.whatsapp_business_api_data?.id || s.id) === appId);

        // 3) Phone info → plataforma
        const phone = await axios.get(`${baseURL}/${phoneId}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        }).then(r => r.data);
        const platformType = phone.platform_type || 'UNKNOWN';

        // 4) Templates (só para confirmar leitura)
        const templates = await axios.get(`${baseURL}/${wabaId}/message_templates`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        }).then(r => (r.data?.data || []).length).catch(() => null);

        const hasMessaging = scopes.includes('whatsapp_business_messaging');
        const hasManagement = scopes.includes('whatsapp_business_management');

        const checks = {
            appId,
            appConnected,
            platformType,
            hasMessaging,
            hasManagement,
            phoneId,
            wabaId,
            templatesCount: templates
        };

        const problems = [];
        if (!hasMessaging) problems.push('Token sem escopo whatsapp_business_messaging');
        if (!hasManagement) problems.push('Token sem escopo whatsapp_business_management');
        if (!appConnected) problems.push('App não está conectado à WABA (Connected apps)');
        if (platformType !== 'CLOUD') problems.push('Número não está na plataforma CLOUD (migre para Cloud API no WhatsApp Manager)');

        res.json({ success: problems.length === 0, data: { checks, problems, phone } });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message, details: error.response?.data });
    }
});

// Assinar o app na WABA para webhooks/mensagens (pode ser necessário em alguns tenants)
router.post('/whatsapp/waba/subscribe', async (req, res) => {
    try {
        const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
        const apiVersion = process.env.WHATSAPP_API_VERSION || 'v18.0';
        const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
        if (!accessToken || !wabaId) return res.status(400).json({ success: false, message: 'Configuração incompleta' });

        const payload = { subscribed_fields: ['messages'] };
        const response = await axios.post(`https://graph.facebook.com/${apiVersion}/${wabaId}/subscribed_apps`, payload, {
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }
        });
        res.json({ success: true, data: response.data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message, details: error.response?.data });
    }
});

// Info do número (phone_number_id)
router.get('/whatsapp/phone-info', async (req, res) => {
    try {
        const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
        const apiVersion = process.env.WHATSAPP_API_VERSION || 'v18.0';
        const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
        if (!accessToken || !phoneId) return res.status(400).json({ success: false, message: 'Configuração incompleta' });

        const response = await axios.get(`https://graph.facebook.com/${apiVersion}/${phoneId}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        res.json({ success: true, data: response.data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message, details: error.response?.data });
    }
});

// Info do App (descoberto via debug_token)
router.get('/whatsapp/app', async (req, res) => {
    try {
        const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
        const apiVersion = process.env.WHATSAPP_API_VERSION || 'v18.0';
        if (!accessToken) return res.status(400).json({ success: false, message: 'Token não configurado' });

        const dbg = await axios.get(`https://graph.facebook.com/${apiVersion}/debug_token`, {
            params: { input_token: accessToken, access_token: accessToken }
        });
        const appId = dbg.data?.data?.app_id;
        if (!appId) return res.status(400).json({ success: false, message: 'app_id não encontrado no token' });

        const app = await axios.get(`https://graph.facebook.com/${apiVersion}/${appId}`, {
            params: { fields: 'id,name,link,app_type,business' },
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        res.json({ success: true, data: app.data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message, details: error.response?.data });
    }
});

// Info da WABA (owner_business)
router.get('/whatsapp/waba/info', async (req, res) => {
    try {
        const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
        const apiVersion = process.env.WHATSAPP_API_VERSION || 'v18.0';
        const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
        if (!accessToken || !wabaId) return res.status(400).json({ success: false, message: 'Configuração incompleta' });

        const info = await axios.get(`https://graph.facebook.com/${apiVersion}/${wabaId}`, {
            params: { fields: 'id,name,owner_business' },
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        res.json({ success: true, data: info.data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message, details: error.response?.data });
    }
});

// Usuários atribuídos à WABA (para checar System User e tarefas)
router.get('/whatsapp/waba/assigned-users', async (req, res) => {
    try {
        const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
        const apiVersion = process.env.WHATSAPP_API_VERSION || 'v18.0';
        const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
        if (!accessToken || !wabaId) return res.status(400).json({ success: false, message: 'Configuração incompleta' });

        const list = await axios.get(`https://graph.facebook.com/${apiVersion}/${wabaId}/assigned_users`, {
            params: { fields: 'id,user,role,tasks,business' },
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        res.json({ success: true, data: list.data });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message, details: error.response?.data });
    }
});