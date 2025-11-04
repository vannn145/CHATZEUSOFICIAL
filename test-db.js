// Teste de conectividade PostgreSQL
require('dotenv').config();
const { Pool } = require('pg');

async function testDatabaseConnections() {
    console.log('🔍 Testando conectividade PostgreSQL...\n');

    // Configuração 1: Como está no .env
    console.log('📝 Configuração atual:');
    console.log(`Host: ${process.env.DB_HOST}`);
    console.log(`Port: ${process.env.DB_PORT}`);
    console.log(`User: ${process.env.DB_USER}`);
    console.log(`Database: ${process.env.DB_NAME}\n`);

    const configs = [
        {
            name: 'Configuração atual (sem SSL)',
            config: {
                host: process.env.DB_HOST,
                port: process.env.DB_PORT,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_NAME,
                ssl: false,
                connectionTimeoutMillis: 5000
            }
        },
        {
            name: 'Com SSL habilitado',
            config: {
                host: process.env.DB_HOST,
                port: process.env.DB_PORT,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_NAME,
                ssl: { rejectUnauthorized: false },
                connectionTimeoutMillis: 5000
            }
        },
        {
            name: 'Porta alternativa (5433)',
            config: {
                host: process.env.DB_HOST,
                port: 5433,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_NAME,
                ssl: false,
                connectionTimeoutMillis: 5000
            }
        }
    ];

    for (let i = 0; i < configs.length; i++) {
        const { name, config } = configs[i];
        console.log(`🔄 Testando: ${name}`);
        
        const pool = new Pool(config);
        
        try {
            const client = await pool.connect();
            const result = await client.query('SELECT NOW(), version()');
            client.release();
            await pool.end();
            
            console.log('✅ Conexão bem-sucedida!');
            console.log('📅 Data/hora do servidor:', result.rows[0].now);
            console.log('🗄️  Versão PostgreSQL:', result.rows[0].version.split(' ')[0]);
            console.log('🎉 Use esta configuração!\n');
            break;
            
        } catch (error) {
            await pool.end();
            console.log('❌ Falhou:', error.message);
            console.log('');
        }
    }
}

// Também testar ping básico
async function testNetworkConnectivity() {
    console.log('🌐 Testando conectividade de rede...\n');
    
    const { spawn } = require('child_process');
    
    return new Promise((resolve) => {
        const ping = spawn('ping', ['-n', '4', process.env.DB_HOST]);
        
        ping.stdout.on('data', (data) => {
            console.log(data.toString());
        });
        
        ping.on('close', (code) => {
            if (code === 0) {
                console.log('✅ Conectividade de rede OK\n');
            } else {
                console.log('❌ Problema de conectividade de rede\n');
            }
            resolve();
        });
    });
}

async function main() {
    try {
        await testNetworkConnectivity();
        await testDatabaseConnections();
    } catch (error) {
        console.error('Erro no teste:', error);
    }
}

main();