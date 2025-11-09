require('dotenv').config({ override: true });
const { Pool } = require('pg');

async function run(database, date) {
    const dbName = database || process.env.DB_NAME;
    const targetDate = date || new Date().toISOString().slice(0, 10);

    const pool = new Pool({
        host: process.env.DB_HOST,
        port: process.env.DB_PORT || 5432,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: dbName,
        ssl: false
    });

    const startBr = Math.floor(new Date(`${targetDate}T00:00:00-03:00`).getTime() / 1000);
    const endBr = Math.floor(new Date(new Date(`${targetDate}T00:00:00-03:00`).getTime() + 24 * 60 * 60 * 1000).getTime() / 1000);

    const queries = {
        window: `SELECT
                    COUNT(*) FILTER (WHERE confirmed = TRUE) AS confirmed,
                    COUNT(*) FILTER (WHERE confirmed IS NOT TRUE) AS pending,
                    COUNT(*) AS total
                 FROM public.schedule
                 WHERE "when" >= $1 AND "when" < $2`,
        byDate: `SELECT
                    COUNT(*) FILTER (WHERE confirmed = TRUE) AS confirmed,
                    COUNT(*) FILTER (WHERE confirmed IS NOT TRUE) AS pending,
                    COUNT(*) AS total
                 FROM public.schedule
                 WHERE to_timestamp("when")::date = $1`
    };

    try {
        const [window, byDate] = await Promise.all([
            pool.query(queries.window, [startBr, endBr]),
            pool.query(queries.byDate, [targetDate])
        ]);

        console.log(JSON.stringify({
            database: dbName,
            date: targetDate,
            results: {
                by_epoch_window: window.rows[0],
                by_cast_date: byDate.rows[0]
            }
        }, null, 2));
    } catch (error) {
        console.error('Erro na consulta:', error.message);
    } finally {
        await pool.end();
    }
}

const [dbArg, dateArg] = process.argv.slice(2);
run(dbArg, dateArg);
