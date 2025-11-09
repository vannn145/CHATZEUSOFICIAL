#!/usr/bin/env node
require('dotenv').config({ override: true });
const { Pool } = require('pg');

function getEpochWindow(dateStr) {
  const start = new Date(`${dateStr}T00:00:00-03:00`);
  const end = new Date(start.getTime() + 24*60*60*1000);
  return { startEpoch: Math.floor(start.getTime()/1000), endEpoch: Math.floor(end.getTime()/1000) };
}

(async () => {
  try {
    const date = process.argv[2];
    if (!date) {
      console.error('Uso: node scripts/list-sadt-by-date.js YYYY-MM-DD');
      process.exit(1);
    }
    const pool = new Pool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 5432,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: false,
      connectionTimeoutMillis: 10000,
    });
    const schema = process.env.DB_SCHEMA || 'public';
    const { startEpoch, endEpoch } = getEpochWindow(date);

    const client = await pool.connect();
    try {
      try { await client.query(`SET search_path TO ${schema}, public;`); } catch {}
      // Descobrir coluna de data
      const cols = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'sadt'`, [schema]);
      const types = Object.fromEntries(cols.rows.map(r => [r.column_name.toLowerCase(), r.data_type.toLowerCase()]));
      const dateCol = types['tratamento_date'] ? 'tratamento_date' : (types['treatment_date'] ? 'treatment_date' : null);
      if (!dateCol) throw new Error('Coluna de data não encontrada em sadt (tratamento_date/treatment_date)');
      const dateType = types[dateCol];
      const isEpoch = ['integer','bigint','numeric','double precision','real'].includes(dateType);
      const where = isEpoch ? `s.${dateCol} >= $1 AND s.${dateCol} < $2` : `EXTRACT(EPOCH FROM s.${dateCol}::timestamp) >= $1 AND EXTRACT(EPOCH FROM s.${dateCol}::timestamp) < $2`;
      const order = isEpoch ? `to_timestamp(s.${dateCol})` : `s.${dateCol}`;
      const q = `
        SELECT s.patient_name, ${isEpoch ? `to_timestamp(s.${dateCol})` : `s.${dateCol}`} AS tratamento_date
        FROM sadt s
        WHERE ${where}
        ORDER BY ${order} ASC
        LIMIT 200
      `;
      const r = await client.query(q, [startEpoch, endEpoch]);
      console.log(JSON.stringify({ date, source: 'sadt', total: r.rows.length, sample: r.rows.slice(0, 10) }, null, 2));
    } finally {
      client.release();
      await pool.end();
    }
  } catch (e) {
    console.error(JSON.stringify({ error: e.message }, null, 2));
    process.exit(1);
  }
})();
