#!/usr/bin/env node
require('dotenv').config();
const { Pool } = require('pg');

(async () => {
  const date = process.argv[2] || '2025-11-05';
  const host = process.env.DB_HOST;
  const port = process.env.DB_PORT || 5432;
  const user = process.env.DB_USER;
  const password = process.env.DB_PASSWORD;

  const candidates = Array.from(new Set([
    process.env.DB_NAME,
    'cdcenter',
    'cdcenter_prod',
    'zeus',
    'zeus_prod',
    'postgres',
    'production',
    'prod'
  ].filter(Boolean)));

  const results = [];
  for (const dbName of candidates) {
    const pool = new Pool({ host, port, user, password, database: dbName, ssl: false, connectionTimeoutMillis: 8000 });
    let client;
    try {
      client = await pool.connect();
      // Tenta contar por cast-to-date e por janela epoch (se coluna "when" existir)
      const counts = { dbName };
      // Testar existência de schedule_v
      const hasView = await client.query("SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='schedule_v'");
      if (hasView.rowCount === 0) {
        counts.error = 'schedule_v não existe';
      } else {
        // Contagem total por data usando cast
        const qCastAll = `SELECT COUNT(*)::int AS c FROM schedule_v sv WHERE to_timestamp(sv."when")::date = $1::date`;
        const qCastPending = `SELECT COUNT(*)::int AS c FROM schedule_v sv WHERE to_timestamp(sv."when")::date = $1::date AND COALESCE(LOWER(CAST(sv.confirmed AS TEXT)), '') IN ('', '0', 'false', 'f', 'n', 'nao', 'não', 'nao_confirmado', 'pending')`;
        let castAll = 0, castPending = 0, dist = [];
        try {
          castAll = (await client.query(qCastAll, [date])).rows[0].c;
          castPending = (await client.query(qCastPending, [date])).rows[0].c;
          dist = (await client.query(`SELECT LOWER(CAST(sv.confirmed AS TEXT)) AS confirmed_text, COUNT(*)::int c FROM schedule_v sv WHERE to_timestamp(sv."when")::date = $1::date GROUP BY 1 ORDER BY 2 DESC`, [date])).rows;
        } catch (e) {
          counts.warn = 'Falha nas consultas baseadas em "when" (coluna ausente?)';
        }
        counts.cast_all = castAll;
        counts.cast_pending = castPending;
        counts.confirmed_distribution = dist;
      }
      results.push(counts);
    } catch (err) {
      results.push({ dbName, error: err.message });
    } finally {
      try { if (client) client.release(); await pool.end(); } catch {}
    }
  }

  console.log(JSON.stringify({ host, date, candidates, results }, null, 2));
})();
