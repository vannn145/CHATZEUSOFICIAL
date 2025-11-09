require('dotenv').config({ override: true });
const { Pool } = require('pg');

(async () => {
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
        const res = await client.query(`
            SELECT table_schema, table_name
            FROM information_schema.tables
            WHERE table_type = 'BASE TABLE'
              AND table_schema NOT IN ('pg_catalog', 'information_schema')
              AND table_name ILIKE '%whatsapp%'
            ORDER BY table_schema, table_name
        `);
        console.log(res.rows);
        client.release();
    } catch (error) {
        console.error('Erro:', error.message);
    } finally {
        await pool.end();
    }
})();
