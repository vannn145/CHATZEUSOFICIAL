require('dotenv').config({ override: true });
const { Pool } = require('pg');

async function describe(tableName) {
    if (!tableName) {
        console.error('Uso: node scripts/describe-table.js <table_name>');
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
        const res = await pool.query(`
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = $1
            ORDER BY ordinal_position
        `, [tableName]);
        console.log(res.rows);
    } catch (err) {
        console.error('Erro:', err.message);
    } finally {
        await pool.end();
    }
}

describe(process.argv[2]);
