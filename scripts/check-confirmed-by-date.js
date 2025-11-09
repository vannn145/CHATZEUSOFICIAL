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

        const q = `
            SELECT
                COUNT(*) FILTER (WHERE confirmed = TRUE) AS confirmed,
                COUNT(*) FILTER (WHERE confirmed IS NOT TRUE) AS pending,
                COUNT(*) AS total,
                MIN(schedule_id) AS first_id,
                MAX(schedule_id) AS last_id
            FROM public.schedule
            WHERE "when" >= $1 AND "when" < $2
        `;
        const qmv = `
            SELECT
                COUNT(*) FILTER (WHERE confirmed = TRUE) AS confirmed,
                COUNT(*) FILTER (WHERE confirmed IS NOT TRUE) AS pending,
                COUNT(*) AS total,
                MIN(schedule_id) AS first_id,
                MAX(schedule_id) AS last_id
            FROM public.schedule_mv
            WHERE "when" >= $1 AND "when" < $2
        `;

        const [schedule, scheduleMv, scheduleUtc, scheduleMvUtc] = await Promise.all([
            pool.query(q, [start, end]),
            pool.query(qmv, [start, end]),
            pool.query(
                `SELECT
                    COUNT(*) FILTER (WHERE confirmed = TRUE) AS confirmed,
                    COUNT(*) FILTER (WHERE confirmed IS NOT TRUE) AS pending,
                    COUNT(*) AS total
                 FROM public.schedule
                 WHERE to_timestamp("when")::date = $1`,
                [target]
            ),
            pool.query(
                `SELECT
                    COUNT(*) FILTER (WHERE confirmed = TRUE) AS confirmed,
                    COUNT(*) FILTER (WHERE confirmed IS NOT TRUE) AS pending,
                    COUNT(*) AS total
                 FROM public.schedule_mv
                 WHERE to_timestamp("when")::date = $1`,
                [target]
            )
        ]);

        console.log({
            date: target,
            schedule: schedule.rows[0],
            schedule_mv: scheduleMv.rows[0],
            schedule_by_utc: scheduleUtc.rows[0],
            schedule_mv_by_utc: scheduleMvUtc.rows[0]
        });
    } finally {
        await pool.end();
    }
}

const dateArg = process.argv[2];
run(dateArg).catch(err => {
    console.error('Erro:', err.message);
    process.exitCode = 1;
});
