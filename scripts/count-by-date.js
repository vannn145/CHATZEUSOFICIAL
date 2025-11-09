require('dotenv').config();
const { Pool } = require('pg');

async function run(date) {
    const pool = new Pool({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: false
    });

    try {
        const target = date || new Date().toISOString().slice(0, 10);
        const start = Math.floor(new Date(`${target}T00:00:00-03:00`).getTime() / 1000);
        const end = Math.floor(new Date(new Date(`${target}T00:00:00-03:00`).getTime() + 24 * 60 * 60 * 1000).getTime() / 1000);

        const queries = [
            {
                label: 'public.schedule',
                sql: 'SELECT COUNT(*)::int AS count FROM public.schedule WHERE "when" >= $1 AND "when" < $2'
            },
            {
                label: 'public.schedule_mv',
                sql: 'SELECT COUNT(*)::int AS count FROM public.schedule_mv WHERE "when" >= $1 AND "when" < $2'
            },
            {
                label: 'public.schedule_mv (all)',
                sql: 'SELECT COUNT(*)::int AS count FROM public.schedule_mv'
            },
            {
                label: 'public.schedule (all)',
                sql: 'SELECT COUNT(*)::int AS count FROM public.schedule'
            }
        ];

        for (const { label, sql } of queries) {
            const params = sql.includes('$1') ? [start, end] : [];
            const result = await pool.query(sql, params);
            console.log(`${label}: ${result.rows[0].count}`);
        }
    } finally {
        await pool.end();
    }
}

const dateArg = process.argv[2];
run(dateArg).catch(err => {
    console.error('Erro ao consultar:', err.message);
    process.exitCode = 1;
});
