const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const dbService = require('./src/services/database');
const whatsappService = require('./src/services/whatsapp-hybrid');
const messageRoutes = require('./src/routes/messages');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Routes
app.use('/api/messages', messageRoutes);

// Rota principal
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Página pública: Política de Privacidade (requerido pela Meta)
app.get(['/privacy', '/politica-de-privacidade', '/privacy-policy'], (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'privacy.html'));
});

// Healthcheck simples para load balancer / monitoramento
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime() });
});

// Inicialização do servidor
async function startServer() {
    try {
        console.log('🚀 Iniciando Sistema de Disparo WhatsApp...');
        
        // Testar conexão com banco (opcional)
        try {
            await dbService.testConnection();
            console.log('✅ Conexão com banco PostgreSQL estabelecida');
        } catch (dbError) {
            console.log('⚠️  Banco PostgreSQL não conectado - funcionará em modo demo');
            console.log('💡 Configure o .env para conectar ao banco real');
        }
        
        // Inicializar WhatsApp (sem conectar automaticamente)
        console.log('📱 Serviço WhatsApp inicializado');
        
        app.listen(PORT, () => {
            console.log(`🌐 Servidor rodando em http://localhost:${PORT}`);
            console.log('📋 Interface de controle disponível na página inicial');
            console.log(`🔗 Acesse: http://localhost:${PORT}`);
        });
        
    } catch (error) {
        console.error('❌ Erro ao iniciar servidor:', error);
        process.exit(1);
    }
}

startServer();