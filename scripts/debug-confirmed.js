#!/usr/bin/env node
require('dotenv').config();
const { Pool } = require('pg');

async function main() {
  const [firstArg, secondArg] = process.argv.slice(2);
  let dateArg = null;
  let idArg = null;

  if (firstArg) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(firstArg)) {
      dateArg = firstArg;
    } else {
      idArg = firstArg;
    }
  }

  if (secondArg) {
    idArg = secondArg;
  }

  if (!dateArg && !idArg) {
    console.error('Uso: node scripts/debug-confirmed.js YYYY-MM-DD [scheduleId]');
    process.exit(1);
  }

  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: false
  });

  const schema = process.env.DB_SCHEMA || 'public';
  const params = [];
  const whereClauses = ['COALESCE(s.active, TRUE) = TRUE'];
  let orderClause = 'ORDER BY when_ts';

  if (idArg) {
    whereClauses.push('sm.schedule_id = $1');
    params.push(Number(idArg));
    orderClause = '';
  } else {
    const start = Math.floor(new Date(`${dateArg}T00:00:00-03:00`).getTime() / 1000);
    const end = start + 86400;
    params.push(start, end);
    whereClauses.push('COALESCE(sm.when, s.when) >= $1');
    whereClauses.push('COALESCE(sm.when, s.when) < $2');
  }

  const query = `
    SELECT
      sm.schedule_id,
      sm.confirmed AS confirmed_mv,
      s.confirmed AS confirmed_schedule,
      TO_TIMESTAMP(COALESCE(sm.when, s.when)) AS when_ts
    FROM ${schema}.schedule_mv sm
    LEFT JOIN ${schema}.schedule s ON s.schedule_id = sm.schedule_id
    WHERE ${whereClauses.join('\n      AND ')}
    ${orderClause}
    LIMIT 50
  `;

  try {
    const res = await pool.query(query, params);
    let detail = {
  date: dateArg,
  scheduleId: idArg ? Number(idArg) : null,
      count: res.rowCount,
      rows: res.rows
    };

    if (idArg && res.rowCount === 0) {
      const fallbackSql = `
        SELECT
          schedule_id,
          confirmed,
          TO_TIMESTAMP("when") AS when_ts,
          active
        FROM ${schema}.schedule
        WHERE schedule_id = $1
      `;
      const fallback = await pool.query(fallbackSql, [Number(idArg)]);
      detail = {
        ...detail,
        fallbackCount: fallback.rowCount,
        fallbackRows: fallback.rows
      };
    }

    console.log(JSON.stringify(detail, null, 2));
  } catch (err) {
    console.error('Erro na consulta:', err.message);
  } finally {
    await pool.end();
  }
}

main();
