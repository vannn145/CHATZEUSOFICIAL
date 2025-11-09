require('dotenv').config({ override: true });
const { Pool } = require('pg');

async function run(treatmentId) {
    if (!treatmentId) {
        console.error('Uso: node scripts/check-whatsapp-status.js <treatment_id>');
        process.exit(1);
    }

    const pool = new Pool({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: false,
    });

    try {
        const res = await pool.query(
            `SELECT wm.whatsapp_message_id, wm.whatsapp_status_id, wm.whatsapp_message_time
             FROM ${process.env.DB_SCHEMA || 'public'}.whatsapp_message wm
             JOIN ${process.env.DB_SCHEMA || 'public'}.whatsapp_message_has_treatment wmht ON wmht.whatsapp_message_id = wm.whatsapp_message_id
             WHERE wmht.treatment_id = $1
             ORDER BY wm.whatsapp_message_id`,
            [Number(treatmentId)]
        );
        console.log(res.rows);
    } catch (error) {
        console.error('Erro:', error.message);
    } finally {
        await pool.end();
    }
}

run(process.argv[2]);
