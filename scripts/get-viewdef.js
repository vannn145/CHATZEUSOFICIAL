require('dotenv').config({ override: true });
const { Pool } = require('pg');

async function run(viewName) {
    if (!viewName) {
        console.error('Uso: node scripts/get-viewdef.js <view_name>');
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
        const res = await pool.query('SELECT pg_get_viewdef($1::regclass, true) AS def', [viewName]);
        console.log(res.rows[0]?.def || '');
    } catch (error) {
        console.error('Erro:', error.message);
    } finally {
        await pool.end();
    }
}

run(process.argv[2]);
