#!/usr/bin/env node
// Verifica agendamentos "recentemente cadastrados" na view schedule_v (ou schedule_mv)
// Uso: node scripts/check-recent-schedule-by-date.js YYYY-MM-DD [lookbackMinutes=120] [nameFilter]

require('dotenv').config({ override: true });
const { Pool } = require('pg');

function getEpochWindowForBrDate(dateStr) {
  const start = new Date(`${dateStr}T00:00:00-03:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return {
    startEpoch: Math.floor(start.getTime() / 1000),
    endEpoch: Math.floor(end.getTime() / 1000),
  };
}

(async () => {
  const args = process.argv.slice(2);
  const targetDate = args[0];
  const lookbackMinutes = Number(args[1] || 120);
  const nameFilter = args[2] ? String(args.slice(2).join(' ')) : null;
  if (!targetDate) {
    console.error('Uso: node scripts/check-recent-schedule-by-date.js YYYY-MM-DD [lookbackMinutes] [nameFilter]');
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
  const { startEpoch, endEpoch } = getEpochWindowForBrDate(targetDate);

  let client;
  try {
    client = await pool.connect();
    try { await client.query(`SET search_path TO ${schema}, public;`); } catch {}

    // Detectar colunas em schedule_v e schedule_mv
    const vcols = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'schedule_v'`, [schema]).then(r => r.rows).catch(() => []);
    const mvcols = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'schedule_mv'`, [schema]).then(r => r.rows).catch(() => []);

    const vset = new Set(vcols.map(c => c.column_name.toLowerCase()));
    const mvset = new Set(mvcols.map(c => c.column_name.toLowerCase()));

    const canUseV = vset.has('when');
    const canUseMv = mvset.has('when');

    // schedule_v: usar created_at se existir; caso contrário, scheduled_at de mv
    let rows = [];
    if (canUseV) {
      const hasVCreated = vset.has('created_at');
      const recentPredicate = hasVCreated
        ? `sv.created_at >= EXTRACT(EPOCH FROM NOW() - ($3 || ' minutes')::interval)`
        : `1=1`;

      const qv = `
        SELECT
          sv.schedule_id AS id,
          sv.patient_name,
          to_timestamp(sv."when") AS tratamento_date,
          ${hasVCreated ? 'sv.created_at' : 'NULL::int AS created_at'},
          sv.patient_contacts,
          sv.main_procedure_term,
          sv.confirmed
        FROM schedule_v sv
        WHERE sv."when" >= $1 AND sv."when" < $2
          AND ${recentPredicate}
          ${nameFilter ? 'AND UPPER(sv.patient_name) LIKE UPPER($4)' : ''}
        ORDER BY ${hasVCreated ? 'sv.created_at DESC NULLS LAST,' : ''} sv."when" ASC
        LIMIT 200
      `;
      const params = hasVCreated
        ? (nameFilter ? [startEpoch, endEpoch, lookbackMinutes, `%${nameFilter}%`] : [startEpoch, endEpoch, lookbackMinutes])
        : (nameFilter ? [startEpoch, endEpoch, `%${nameFilter}%`] : [startEpoch, endEpoch]);
      try {
        const r = await client.query(qv, params);
        rows = r.rows;
      } catch (e) {
        // Ignora erro e tenta mv abaixo
      }
    }

    if (rows.length === 0 && canUseMv) {
      const hasMvScheduled = mvset.has('scheduled_at');
      const recentPredicate = hasMvScheduled
        ? `mv.scheduled_at >= EXTRACT(EPOCH FROM NOW() - ($3 || ' minutes')::interval)`
        : `1=1`;
      const qmv = `
        SELECT
          mv.schedule_id AS id,
          mv.patient_name,
          to_timestamp(mv."when") AS tratamento_date,
          ${hasMvScheduled ? 'mv.scheduled_at' : 'NULL::int AS scheduled_at'},
          mv.patient_contacts,
          mv.main_procedure_term,
          mv.confirmed
        FROM schedule_mv mv
        WHERE mv."when" >= $1 AND mv."when" < $2
          AND ${recentPredicate}
          ${nameFilter ? 'AND UPPER(mv.patient_name) LIKE UPPER($4)' : ''}
        ORDER BY ${hasMvScheduled ? 'mv.scheduled_at DESC NULLS LAST,' : ''} mv."when" ASC
        LIMIT 200
      `;
      const params = hasMvScheduled
        ? (nameFilter ? [startEpoch, endEpoch, lookbackMinutes, `%${nameFilter}%`] : [startEpoch, endEpoch, lookbackMinutes])
        : (nameFilter ? [startEpoch, endEpoch, `%${nameFilter}%`] : [startEpoch, endEpoch]);
      const r2 = await client.query(qmv, params);
      rows = r2.rows;
    }

    console.log(JSON.stringify({ date: targetDate, lookbackMinutes, nameFilter: nameFilter || null, total: rows.length, items: rows }, null, 2));
  } catch (e) {
    console.error(JSON.stringify({ error: e.message }, null, 2));
    process.exit(2);
  } finally {
    try { if (client) client.release(); await pool.end(); } catch {}
  }
})();
