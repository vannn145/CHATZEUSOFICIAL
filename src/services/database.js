const { Pool } = require('pg');

class DatabaseService {
    constructor() {
        this.pool = new Pool({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT || 5432,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            ssl: false, // Ajuste conforme necessário
            connectionTimeoutMillis: 10000, // 10 segundos
            idleTimeoutMillis: 30000, // 30 segundos
            max: 10 // máximo de conexões
        });
        this.isConnected = false;
        this.demoMode = false;
    }

    async testConnection() {
        try {
            console.log(`🔗 Tentando conectar ao banco: ${process.env.DB_HOST}:${process.env.DB_PORT}`);
            console.log(`👤 Usuário: ${process.env.DB_USER}`);
            console.log(`🗄️  Database: ${process.env.DB_NAME}`);
            
            const client = await this.pool.connect();
            const result = await client.query('SELECT NOW()');
            client.release();
            this.isConnected = true;
            this.demoMode = false;
            console.log('✅ Conexão com banco estabelecida com sucesso!');
            return result.rows[0];
        } catch (error) {
            this.isConnected = false;
            this.demoMode = true;
            console.log('❌ Detalhes do erro de conexão:', error.message);
            console.log('🔍 Verificar: rede, firewall, credenciais, IP/porta');
            throw new Error(`Erro na conexão com banco: ${error.message}`);
        }
    }

    async getUnconfirmedAppointments() {
        if (this.demoMode) {
            // Dados de demonstração
            return [
                {
                    id: 1,
                    patient_name: 'João Silva',
                    tratamento_date: new Date('2024-12-15T10:00:00'),
                    patient_contacts: '5511999999999',
                    main_procedure_term: 'Exame de Sangue',
                    confirmed: false
                },
                {
                    id: 2,
                    patient_name: 'Maria Santos', 
                    tratamento_date: new Date('2024-12-15T14:30:00'),
                    patient_contacts: '5511888888888',
                    main_procedure_term: 'Ultrassom',
                    confirmed: false
                },
                {
                    id: 3,
                    patient_name: 'Pedro Costa',
                    tratamento_date: new Date('2024-12-16T09:15:00'),
                    patient_contacts: '5511777777777',
                    main_procedure_term: 'Consulta Cardiologia',
                    confirmed: false
                }
            ];
        }

        try {
            // schedule_v contém as informações de agenda e contatos
            // Campos relevantes: schedule_id, patient_name, patient_contacts, main_procedure_term, confirmed, when (epoch seconds)
            const query = `
                SELECT 
                    sv.schedule_id AS id,
                    sv.patient_name,
                    to_timestamp(sv."when") AS tratamento_date,
                    sv.patient_contacts,
                    sv.main_procedure_term,
                    sv.confirmed
                FROM schedule_v sv
                WHERE sv.confirmed = false
                  AND sv."when" >= EXTRACT(EPOCH FROM NOW())
                ORDER BY sv."when" ASC
            `;
            const result = await this.pool.query(query);
            return result.rows;
        } catch (error) {
            throw new Error(`Erro ao buscar agendamentos: ${error.message}`);
        }
    }

    async confirmAppointment(appointmentId) {
        if (this.demoMode) {
            console.log(`[DEMO] Agendamento ${appointmentId} confirmado`);
            return { id: appointmentId, confirmed: true };
        }

        try {
            const query = `
                UPDATE schedule_v 
                SET confirmed = true 
                WHERE schedule_id = $1
                RETURNING *
            `;
            const result = await this.pool.query(query, [appointmentId]);
            return result.rows[0];
        } catch (error) {
            throw new Error(`Erro ao confirmar agendamento: ${error.message}`);
        }
    }

    async getAppointmentById(appointmentId) {
        if (this.demoMode) {
            const demoAppointments = await this.getUnconfirmedAppointments();
            return demoAppointments.find(apt => apt.id == appointmentId);
        }

        try {
            const query = `
                SELECT 
                    sv.schedule_id AS id,
                    sv.patient_name,
                    to_timestamp(sv."when") AS tratamento_date,
                    sv.patient_contacts,
                    sv.main_procedure_term,
                    sv.confirmed
                FROM schedule_v sv
                WHERE sv.schedule_id = $1
            `;
            const result = await this.pool.query(query, [appointmentId]);
            return result.rows[0];
        } catch (error) {
            throw new Error(`Erro ao buscar agendamento: ${error.message}`);
        }
    }

    async getAppointmentStats() {
        if (this.demoMode) {
            return {
                total: 3,
                confirmed: 0,
                pending: 3
            };
        }

        try {
            const query = `
                SELECT 
                    COUNT(*)::int as total,
                    COUNT(*) FILTER (WHERE sv.confirmed = true)::int as confirmed,
                    COUNT(*) FILTER (WHERE sv.confirmed = false)::int as pending
                FROM schedule_v sv
                WHERE sv."when" >= EXTRACT(EPOCH FROM NOW())
            `;
            const result = await this.pool.query(query);
            return result.rows[0];
        } catch (error) {
            throw new Error(`Erro ao buscar estatísticas: ${error.message}`);
        }
    }
}

module.exports = new DatabaseService();