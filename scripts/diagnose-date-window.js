#!/usr/bin/env node
// Diagnostica discrepâncias de contagem por data (timezone/confirmado)
require('dotenv').config({ override: true });
const { Pool } = require('pg');

(async () => {
  const date = process.argv[2];
  if (!date) {
    console.error('Uso: node scripts/diagnose-date-window.js YYYY-MM-DD');
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

  const pendingCond = `COALESCE(LOWER(CAST(sv.confirmed AS TEXT)), '') IN ('', '0', 'false', 'f', 'n', 'nao', 'não', 'nao_confirmado', 'pending')`;

  const startUtc = new Date(`${date}T00:00:00Z`);
  const endUtc = new Date(startUtc.getTime()); endUtc.setUTCDate(endUtc.getUTCDate() + 1);
  const startBr = new Date(`${date}T00:00:00-03:00`);
  const endBr = new Date(startBr.getTime()); endBr.setDate(endBr.getDate() + 1);
  const startUtcEpoch = Math.floor(startUtc.getTime() / 1000);
  const endUtcEpoch = Math.floor(endUtc.getTime() / 1000);
  const startBrEpoch = Math.floor(startBr.getTime() / 1000);
  const endBrEpoch = Math.floor(endBr.getTime() / 1000);

  try {
    const client = await pool.connect();
    const rows = {};
  const q1 = `SELECT COUNT(*)::int AS c FROM schedule_v sv WHERE ${pendingCond} AND to_timestamp(sv."when")::date = $1::date`;
  const q1_all = `SELECT COUNT(*)::int AS c FROM schedule_v sv WHERE to_timestamp(sv."when")::date = $1::date`;
  const q2 = `SELECT COUNT(*)::int AS c FROM schedule_v sv WHERE ${pendingCond} AND sv."when" >= $1 AND sv."when" < $2`;
  const q2_all = `SELECT COUNT(*)::int AS c FROM schedule_v sv WHERE sv."when" >= $1 AND sv."when" < $2`;
    const q3 = `SELECT LOWER(CAST(sv.confirmed AS TEXT)) AS confirmed_text, COUNT(*)::int c FROM schedule_v sv WHERE to_timestamp(sv."when")::date = $1::date GROUP BY 1 ORDER BY 2 DESC`;
    const q4 = `SELECT MIN(to_timestamp(sv."when")) AS min_ts, MAX(to_timestamp(sv."when")) AS max_ts FROM schedule_v sv WHERE to_timestamp(sv."when")::date = $1::date`;

    const [r1, r1_all, r2_br, r2_utc, r2_br_all, r2_utc_all, r3, r4] = await Promise.all([
      client.query(q1, [date]),
      client.query(q1_all, [date]),
      client.query(q2, [startBrEpoch, endBrEpoch]),
      client.query(q2, [startUtcEpoch, endUtcEpoch]),
      client.query(q2_all, [startBrEpoch, endBrEpoch]),
      client.query(q2_all, [startUtcEpoch, endUtcEpoch]),
      client.query(q3, [date]).catch(() => ({ rows: [] })),
      client.query(q4, [date]).catch(() => ({ rows: [] })),
    ]);

    rows.cast_date_count = r1.rows[0]?.c || 0;
  rows.cast_date_total = r1_all.rows[0]?.c || 0;
  rows.epoch_brt_count = r2_br.rows[0]?.c || 0;
  rows.epoch_utc_count = r2_utc.rows[0]?.c || 0;
  rows.epoch_brt_total = r2_br_all.rows[0]?.c || 0;
  rows.epoch_utc_total = r2_utc_all.rows[0]?.c || 0;
    rows.confirmed_distribution_on_cast_date = r3.rows || [];
    rows.min_max_on_cast_date = r4.rows?.[0] || null;

    console.log(JSON.stringify({ date, windows: { startBrEpoch, endBrEpoch, startUtcEpoch, endUtcEpoch }, ...rows }, null, 2));
    client.release();
    await pool.end();
    process.exit(0);
  } catch (e) {
    console.error('Erro no diagnóstico:', e.message);
    process.exit(1);
  }
})();
