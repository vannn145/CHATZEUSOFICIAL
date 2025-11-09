    // ...existing code...
const { Pool } = require('pg');

const DEMO_APPOINTMENTS = [
    {
        id: 1,
        patient_name: 'Joao Silva',
        tratamento_date: new Date('2024-12-15T10:00:00-03:00'),
        patient_contacts: '5511999999999',
        main_procedure_term: 'Exame de Sangue',
        confirmed: false
    },
    {
        id: 2,
        patient_name: 'Maria Santos',
        tratamento_date: new Date('2024-12-15T14:30:00-03:00'),
        patient_contacts: '5511888888888',
        main_procedure_term: 'Ultrassom',
        confirmed: true
    },
    {
        id: 3,
        patient_name: 'Pedro Costa',
        tratamento_date: new Date('2024-12-16T09:15:00-03:00'),
        patient_contacts: '5511777777777',
        main_procedure_term: 'Consulta Cardiologia',
        confirmed: false
    }
];

class DatabaseService {
    constructor() {
        this.pool = new Pool({
            host: process.env.DB_HOST,
            port: process.env.DB_PORT || 5432,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME,
            ssl: false,
            connectionTimeoutMillis: 10000,
            idleTimeoutMillis: 30000,
            max: Number(process.env.DB_MAX_POOL || 10)
        });
        this.schema = process.env.DB_SCHEMA || 'public';
        this.demoMode = false;
        this.isConnected = false;
        this.initPromise = null;
        console.log('[DB] Instanciado DatabaseService');
    }

    getDemoAppointments() {
        return DEMO_APPOINTMENTS.map(item => ({ ...item }));
    }

    scheduleEpochExpression() {
        return 'COALESCE(sm.when, s.when)';
    }

    buildScheduleSelect() {
        return `
            COALESCE(sm.schedule_id, s.schedule_id) AS id,
            COALESCE(sm.schedule_id, s.schedule_id) AS schedule_id,
            COALESCE(sm.when, s.when) AS schedule_date_epoch,
            COALESCE(sm.when_end, s.when_end) AS schedule_date_end_epoch,
            TO_TIMESTAMP(COALESCE(sm.when, s.when)) AS schedule_date,
            CASE WHEN COALESCE(sm.when_end, s.when_end) IS NOT NULL THEN TO_TIMESTAMP(COALESCE(sm.when_end, s.when_end)) END AS schedule_date_end,
            TO_TIMESTAMP(COALESCE(sm.when, s.when)) AS tratamento_date,
            COALESCE(sm.confirmed, s.confirmed) AS confirmed,
            COALESCE(p.full_name, sm.patient_name) AS patient_name,
            COALESCE(sm.patient_name, p.full_name) AS patient_name_raw,
            COALESCE(sm.patient_id, s.patient_id) AS patient_id,
            COALESCE(phone_pref.value, sm.patient_contacts, sm.patient_phones) AS patient_contacts,
            COALESCE(sm.patient_phones, sm.patient_contacts, phone_pref.value) AS patient_phones,
            phone_pref.value AS preferred_phone,
            p.pemail AS patient_email,
            p.pcpf AS patient_cpf,
            p.birthdate AS patient_birthdate,
            COALESCE(sm.main_procedure_term, sm.treatment_character_term, sm.treatment_model, sm.main_procedure_code::text, s.procedure_code::text) AS main_procedure_term,
            COALESCE(sm.main_procedure_code, s.procedure_code) AS main_procedure_code,
            COALESCE(sm.schedule_group_id, s.schedule_group_id) AS schedule_group_id,
            COALESCE(sm.schedule_group_name, sg.schedule_group_name) AS schedule_group_name,
            COALESCE(sm.schedule_group_color, sg.schedule_group_color) AS schedule_group_color,
            COALESCE(sm.treatment_id, t.treatment_id) AS treatment_id,
            COALESCE(sm.treatment_status_id, t.treatment_status_id) AS treatment_status_id,
            sm.observation,
            COALESCE(sm.hf_id, s.health_facility_id) AS health_facility_id,
            COALESCE(hf.name, sm.hf_name) AS health_facility_name,
            COALESCE(sm.rhp_id, s.health_professional_id) AS health_professional_id,
            COALESCE(hp_person.full_name, sm.rhp_name) AS health_professional_name,
            COALESCE(sm.hic_id, s.health_insurance_company_id) AS insurance_id,
            COALESCE(hic.name, sm.hic_name) AS insurance_name,
            COALESCE(sm.hicp_id, s.health_insurance_company_plan_id) AS insurance_plan_id,
            COALESCE(hicp.plan_name, sm.hicp_name) AS insurance_plan_name,
            COALESCE(sm.created_at, s.created_at) AS created_at,
            s.updated_at
        `;
    }

    buildScheduleBaseJoins() {
        const schema = this.schema;
        return `
            FROM ${schema}.schedule s
            FULL OUTER JOIN ${schema}.schedule_mv sm ON sm.schedule_id = s.schedule_id
            LEFT JOIN ${schema}.treatment t ON t.schedule_id = COALESCE(sm.schedule_id, s.schedule_id)
            LEFT JOIN ${schema}.schedule_group sg ON sg.schedule_group_id = COALESCE(sm.schedule_group_id, s.schedule_group_id)
            LEFT JOIN ${schema}.patient pt ON pt.patient_id = COALESCE(sm.patient_id, s.patient_id)
            LEFT JOIN ${schema}.person p ON p.person_id = pt.person_id
                        LEFT JOIN LATERAL (
                                SELECT c.value
                                FROM ${schema}.contact c
                                WHERE c.person_id = p.person_id
                                    AND (c.is_whatsapp IS NULL OR c.is_whatsapp = TRUE)
                                ORDER BY c.contact_id DESC
                                LIMIT 1
                        ) AS phone_pref ON TRUE
            LEFT JOIN ${schema}.health_facility hf ON hf.health_facility_id = COALESCE(sm.hf_id, s.health_facility_id)
            LEFT JOIN ${schema}.health_insurance_company hic ON hic.health_insurance_company_id = COALESCE(sm.hic_id, s.health_insurance_company_id)
            LEFT JOIN ${schema}.health_insurance_company_plan hicp ON hicp.health_insurance_company_plan_id = COALESCE(sm.hicp_id, s.health_insurance_company_plan_id)
            LEFT JOIN ${schema}.health_professional hp ON hp.health_professional_id = COALESCE(sm.rhp_id, s.health_professional_id)
            LEFT JOIN ${schema}.person hp_person ON hp_person.person_id = hp.person_id
        `;
    }

    buildScheduleQuery({ additionalWhere = [], extraJoins = '', orderBy = 'schedule_date ASC, schedule_id ASC', limit } = {}) {
        const whereClauses = [];
        if (additionalWhere.length > 0) {
            whereClauses.push(...additionalWhere);
        }
        const where = whereClauses.length ? `WHERE ${whereClauses.join(' AND ')}` : '';
        const order = orderBy ? `ORDER BY ${orderBy}` : '';
        const limitClause = limit ? `LIMIT ${Number(limit)}` : '';
        return `
            SELECT
                ${this.buildScheduleSelect()}
            ${this.buildScheduleBaseJoins()}
            ${extraJoins}
            ${where}
            ${order}
            ${limitClause}
        `;
    }

    async ensureInitialized() {
        if (this.demoMode) {
            throw new Error('[DB] Banco em modo demonstração');
        }
        if (this.isConnected) {
            return;
        }
        if (this.initPromise) {
            return this.initPromise;
        }
        this.initPromise = (async () => {
            try {
                const client = await this.pool.connect();
                try {
                    await client.query(`SET search_path TO ${this.schema}, public`);
                } finally {
                    client.release();
                }
                await this.initMessageLogs();
                this.isConnected = true;
                console.log('[DB] Conexão com bancos estabelecida com sucesso!');
            } catch (error) {
                this.isConnected = false;
                this.demoMode = true;
                console.log('[DB] Falha ao conectar no banco:', error.message);
                console.log('[DB] Verifique rede, firewall, credenciais, IP e porta.');
                throw new Error(`[DB] Erro na conexão com banco: ${error.message}`);
            } finally {
                this.initPromise = null;
            }
        })();
        return this.initPromise;
    }

    async initMessageLogs() {
        const table = `${this.schema}.message_logs`;
        const query = `
            CREATE TABLE IF NOT EXISTS ${table} (
                id SERIAL PRIMARY KEY,
                appointment_id BIGINT,
                phone TEXT,
                message_id TEXT,
                type TEXT,
                template_name TEXT,
                status TEXT,
                error_details TEXT,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                updated_at TIMESTAMPTZ DEFAULT NOW()
            );
            CREATE INDEX IF NOT EXISTS idx_message_logs_appointment ON ${table} (appointment_id);
            CREATE UNIQUE INDEX IF NOT EXISTS idx_message_logs_message_id_unique ON ${table} (message_id);
            CREATE INDEX IF NOT EXISTS idx_message_logs_created_at ON ${table} (created_at DESC);
        `;
        await this.pool.query(query);
    }

    async testConnection() {
        await this.ensureInitialized();
        return true;
    }

    filterDemoByDate(data, filterDate) {
        if (!filterDate) {
            return data;
        }
        const start = new Date(`${filterDate}T00:00:00-03:00`);
        const end = new Date(start.getTime());
        end.setDate(end.getDate() + 1);
        return data.filter(item => item.tratamento_date >= start && item.tratamento_date < end);
    }

    async getUnconfirmedAppointments(filterDate) {
        if (this.demoMode) {
            const data = this.getDemoAppointments().filter(item => !item.confirmed);
            return this.filterDemoByDate(data, filterDate);
        }
        await this.ensureInitialized();
        const params = [];
        const where = ['COALESCE(sm.confirmed, s.confirmed) IS NOT TRUE', 'COALESCE(s.active, TRUE) = TRUE'];
        const dateExpr = this.scheduleEpochExpression();
        if (filterDate) {
            const start = new Date(`${filterDate}T00:00:00-03:00`);
            const end = new Date(start.getTime());
            end.setDate(end.getDate() + 1);
            const startEpoch = Math.floor(start.getTime() / 1000);
            const endEpoch = Math.floor(end.getTime() / 1000);
            const startIdx = params.length + 1;
            const endIdx = params.length + 2;
            params.push(startEpoch, endEpoch);
            where.push(`${dateExpr} >= $${startIdx}`);
            where.push(`${dateExpr} < $${endIdx}`);
        } else {
            where.push(`${dateExpr} >= EXTRACT(EPOCH FROM NOW())`);
        }
        const query = this.buildScheduleQuery({ additionalWhere: where, orderBy: 'schedule_date ASC, schedule_id ASC' });
        const result = await this.pool.query(query, params);
        return result.rows;
    }

    async getAllAppointments(filterDate) {
        if (this.demoMode) {
            const data = this.getDemoAppointments();
            return this.filterDemoByDate(data, filterDate);
        }
        await this.ensureInitialized();
        const params = [];
        const where = [];
        const dateExpr = this.scheduleEpochExpression();
        if (filterDate) {
            const start = new Date(`${filterDate}T00:00:00-03:00`);
            const end = new Date(start.getTime());
            end.setDate(end.getDate() + 1);
            const startEpoch = Math.floor(start.getTime() / 1000);
            const endEpoch = Math.floor(end.getTime() / 1000);
            const startIdx = params.length + 1;
            const endIdx = params.length + 2;
            params.push(startEpoch, endEpoch);
            where.push(`${dateExpr} >= $${startIdx}`);
            where.push(`${dateExpr} < $${endIdx}`);
        } else {
            where.push(`${dateExpr} >= EXTRACT(EPOCH FROM NOW())`);
        }
        const query = this.buildScheduleQuery({ additionalWhere: where });
        const result = await this.pool.query(query, params);
        return result.rows;
    }

    /**
     * Confirma o agendamento pelo ID. Atualiza status no banco e retorna o registro atualizado.
     */
    async confirmAppointment(appointmentId) {
        if (!appointmentId) {
            throw new Error('[DB] Parâmetro appointmentId obrigatório');
        }
        if (this.demoMode) {
            console.log(`[DEMO] Agendamento ${appointmentId} confirmado`);
            return { id: Number(appointmentId), confirmed: true };
        }
        await this.ensureInitialized();
        console.log(`[DB] confirmAppointment: tentando confirmar agendamento ID=${appointmentId}`);
        let updated = 0;
        const updateScheduleSql = `
            UPDATE ${this.schema}.schedule
            SET confirmed = TRUE,
                updated_at = EXTRACT(EPOCH FROM NOW())::bigint
            WHERE schedule_id = $1
            RETURNING schedule_id
        `;
        try {
            const scheduleResult = await this.pool.query(updateScheduleSql, [appointmentId]);
            updated = scheduleResult.rowCount;
            console.log(`[DB] confirmAppointment: atualizado na tabela schedule, linhas=${updated}`);
        } catch (error) {
            console.log('[DB] Falha ao atualizar schedule, tentando schedule_mv:', error.message);
        }
        if (!updated) {
            try {
                const updateViewSql = `
                    UPDATE ${this.schema}.schedule_mv
                    SET confirmed = TRUE
                    WHERE schedule_id = $1
                    RETURNING schedule_id
                `;
                const viewResult = await this.pool.query(updateViewSql, [appointmentId]);
                updated = viewResult.rowCount;
                console.log(`[DB] confirmAppointment: atualizado na tabela schedule_mv, linhas=${updated}`);
            } catch (error) {
                console.log('[DB] Falha ao atualizar schedule_mv:', error.message);
            }
        }
        if (!updated) {
            console.log(`[DB] confirmAppointment: nenhum agendamento encontrado para confirmar (ID=${appointmentId})`);
            throw new Error('[DB] Agendamento não encontrado para confirmar');
        }
        console.log(`[DB] confirmAppointment: agendamento confirmado (ID=${appointmentId})`);
        // Retorna o status atualizado do agendamento
        return await this.getAppointmentById(appointmentId);
    }

        /**
         * Busca agendamento pelo ID. Retorna null se não encontrado.
         */
        async getAppointmentById(appointmentId) {
            if (!appointmentId) return null;
            if (this.demoMode) {
                const demo = this.getDemoAppointments();
                return demo.find(item => String(item.id) === String(appointmentId)) || null;
            }
            await this.ensureInitialized();
            const query = this.buildScheduleQuery({
                additionalWhere: ['COALESCE(sm.schedule_id, s.schedule_id) = $1'],
                limit: 1
            });
            try {
                const result = await this.pool.query(query, [appointmentId]);
                return result.rows[0] || null;
            } catch (error) {
                console.log('[DB] Erro ao buscar agendamento por ID:', error.message);
                return null;
            }
        }

    async getAppointmentStats() {
        if (this.demoMode) {
            const data = this.getDemoAppointments();
            const total = data.length;
            const confirmed = data.filter(item => item.confirmed).length;
            const pending = total - confirmed;
            return { total, confirmed, pending };
        }
        await this.ensureInitialized();
        const dateExpr = this.scheduleEpochExpression();
        const query = `
            SELECT
                COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE COALESCE(sm.confirmed, s.confirmed) = TRUE)::int AS confirmed,
                COUNT(*) FILTER (WHERE COALESCE(sm.confirmed, s.confirmed) IS NOT TRUE)::int AS pending
            FROM ${this.schema}.schedule s
            LEFT JOIN ${this.schema}.schedule_mv sm ON sm.schedule_id = s.schedule_id
            WHERE COALESCE(s.active, TRUE) = TRUE
              AND ${dateExpr} >= EXTRACT(EPOCH FROM NOW())
        `;
        const result = await this.pool.query(query);
        return result.rows[0];
    }

    async getAppointmentByPatientName(patientName) {
        if (!patientName) {
            return null;
        }
        if (this.demoMode) {
            const name = String(patientName).toLowerCase();
            const demo = this.getDemoAppointments();
            const exact = demo.find(item => item.patient_name.toLowerCase() === name);
            if (exact) {
                return exact;
            }
            return demo.find(item => item.patient_name.toLowerCase().includes(name)) || null;
        }
        await this.ensureInitialized();
        const dateExpr = this.scheduleEpochExpression();
        const clauses = [
            {
                where: ['UPPER(COALESCE(p.full_name, sm.patient_name)) = UPPER($1)', 'COALESCE(s.active, TRUE) = TRUE', `${dateExpr} >= EXTRACT(EPOCH FROM NOW())`],
                order: 'schedule_date ASC, schedule_id ASC'
            },
            {
                where: ['UPPER(COALESCE(p.full_name, sm.patient_name)) = UPPER($1)'],
                order: 'schedule_date DESC, schedule_id DESC'
            },
            {
                where: [`COALESCE(p.full_name, sm.patient_name) ILIKE '%' || $1 || '%'`],
                order: 'schedule_date DESC, schedule_id DESC'
            }
        ];
        for (const clause of clauses) {
            const query = this.buildScheduleQuery({
                additionalWhere: clause.where,
                orderBy: clause.order,
                limit: 1
            });
            const result = await this.pool.query(query, [patientName]);
            if (result.rows[0]) {
                return result.rows[0];
            }
        }
        return null;
    }

    /**
     * Busca o último agendamento pendente pelo telefone.
     */
    async getLatestPendingAppointmentByPhone(phone) {
        if (!phone) {
            console.log('[DB] getLatestPendingAppointmentByPhone: telefone vazio');
            return null;
        }
        await this.ensureInitialized();
        const onlyDigits = String(phone || '').replace(/\D/g, '');
        console.log(`[DB] getLatestPendingAppointmentByPhone: telefone recebido='${phone}', apenas dígitos='${onlyDigits}'`);
        if (!onlyDigits) {
            console.log('[DB] getLatestPendingAppointmentByPhone: telefone sem dígitos válidos');
            return null;
        }
        const query = `
            SELECT sv.schedule_id AS id, sv.patient_name, to_timestamp(sv."when") AS tratamento_date,
                   sv.patient_contacts, sv.main_procedure_term, sv.confirmed
            FROM schedule_v sv
            WHERE sv.confirmed = false
              AND regexp_replace(sv.patient_contacts, '\\D', '', 'g') LIKE '%' || $1 || '%'
            ORDER BY sv."when" ASC
            LIMIT 1
        `;
        try {
            const result = await this.pool.query(query, [onlyDigits]);
            console.log(`[DB] getLatestPendingAppointmentByPhone: resultado da busca:`, result.rows[0]);
            return result.rows[0] || null;
        } catch (error) {
            console.log('[DB] Erro ao buscar agendamento por telefone:', error.message);
            return null;
        }
    }

    async getPendingInWindowNoTemplate(lookbackDays = 1, lookaheadDays = 14, limit = 50) {
        if (this.demoMode) {
            const demo = this.getDemoAppointments().filter(item => !item.confirmed);
            return demo.slice(0, Number(limit) || 1);
        }
        await this.ensureInitialized();
        const now = new Date();
        const start = new Date(now.getTime() - Number(lookbackDays) * 24 * 60 * 60 * 1000);
        const end = new Date(now.getTime() + Number(lookaheadDays) * 24 * 60 * 60 * 1000);
        const startEpoch = Math.floor(start.getTime() / 1000);
        const endEpoch = Math.floor(end.getTime() / 1000);
        const dateExpr = this.scheduleEpochExpression();
        const extraJoins = `
            LEFT JOIN ${this.schema}.message_logs ml ON ml.appointment_id = COALESCE(sm.schedule_id, s.schedule_id)
                                                   AND ml.type = 'template'
                                                   AND COALESCE(ml.status, '') NOT IN ('failed')
        `;
        const where = [
            'COALESCE(sm.confirmed, s.confirmed) IS NOT TRUE',
            'COALESCE(s.active, TRUE) = TRUE',
            `${dateExpr} >= $1`,
            `${dateExpr} < $2`,
            'ml.id IS NULL'
        ];
        const query = this.buildScheduleQuery({
            additionalWhere: where,
            extraJoins,
            orderBy: 'schedule_date ASC, schedule_id ASC',
            limit: Math.max(1, Number(limit))
        });
        const result = await this.pool.query(query, [startEpoch, endEpoch]);
        return result.rows;
    }

    async logOutboundMessage({ appointmentId, phone, messageId, type, templateName, status, errorDetails }) {
        if (this.demoMode) {
            console.log('[DEMO] logOutboundMessage', { appointmentId, phone, messageId, type, templateName, status });
            return { id: Date.now(), appointment_id: appointmentId, message_id: messageId, status: status || 'sent' };
        }
        await this.ensureInitialized();
        const query = `
            INSERT INTO ${this.schema}.message_logs (appointment_id, phone, message_id, type, template_name, status, error_details)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (message_id) DO UPDATE SET
                appointment_id = COALESCE(EXCLUDED.appointment_id, ${this.schema}.message_logs.appointment_id),
                phone = COALESCE(EXCLUDED.phone, ${this.schema}.message_logs.phone),
                type = COALESCE(EXCLUDED.type, ${this.schema}.message_logs.type),
                template_name = COALESCE(EXCLUDED.template_name, ${this.schema}.message_logs.template_name),
                status = COALESCE(EXCLUDED.status, ${this.schema}.message_logs.status),
                error_details = COALESCE(EXCLUDED.error_details, ${this.schema}.message_logs.error_details),
                updated_at = NOW()
            RETURNING *
        `;
        const values = [
            appointmentId ?? null,
            phone ?? null,
            messageId ?? null,
            type ?? null,
            templateName ?? null,
            status ?? null,
            errorDetails ?? null
        ];
        const result = await this.pool.query(query, values);
        return result.rows[0];
    }

    async updateMessageStatus(messageId, status, errorDetails = null) {
        if (!messageId || this.demoMode) {
            return;
        }
        await this.ensureInitialized();
        const query = `
            UPDATE ${this.schema}.message_logs
            SET status = $2,
                error_details = $3,
                updated_at = NOW()
            WHERE message_id = $1
        `;
        await this.pool.query(query, [messageId, status, errorDetails]);
    }

    async getLatestStatusesForAppointments(appointmentIds) {
        if (!Array.isArray(appointmentIds) || appointmentIds.length === 0) {
            return {};
        }
        if (this.demoMode) {
            return {};
        }
        await this.ensureInitialized();
        const params = appointmentIds.map(id => Number(id));
        const placeholders = params.map((_, idx) => `$${idx + 1}`).join(', ');
        const query = `
            SELECT DISTINCT ON (appointment_id)
                appointment_id,
                status,
                message_id,
                template_name,
                phone,
                type,
                created_at,
                updated_at
            FROM ${this.schema}.message_logs
            WHERE appointment_id IN (${placeholders})
            ORDER BY appointment_id, created_at DESC, id DESC
        `;
        const result = await this.pool.query(query, params);
        const map = {};
        for (const row of result.rows) {
            map[row.appointment_id] = row;
        }
        return map;
    }

    /**
     * Remove caracteres não numéricos do telefone.
     */
    sanitizePhone(phone) {
        if (!phone) {
            return null;
        }
        const digits = String(phone).replace(/\D/g, '');
        return digits || null;
    }
}

module.exports = new DatabaseService();
