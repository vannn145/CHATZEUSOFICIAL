#!/usr/bin/env node
require('dotenv').config();
const { Pool } = require('pg');

(async () => {
  const date = process.argv[2] || '2025-11-05';
  const pool = new Pool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: false,
  });
  let client;
  try {
    client = await pool.connect();
    const rels = await client.query(`
      SELECT table_schema, table_name, table_type
      FROM information_schema.tables
      WHERE table_name ILIKE 'schedule%'
      ORDER BY table_schema, table_name
    `);
    const out = [];
    for (const r of rels.rows) {
      const full = `${r.table_schema}.${r.table_name}`;
      // Busca colunas
      const cols = await client.query(
        `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 ORDER BY ordinal_position`,
        [r.table_schema, r.table_name]
      ).then(q => q.rows);
      const colNames = cols.map(c => c.column_name);
      let counts = null;
      // Se houver coluna "when", tentar count por data
      if (colNames.includes('when')) {
        try {
          const cAll = await client.query(
            `SELECT COUNT(*)::int AS c FROM ${r.table_schema}."${r.table_name}" sv WHERE to_timestamp(sv."when")::date = $1::date`,
            [date]
          );
          const cDist = await client.query(
            `SELECT LOWER(CAST(confirmed AS TEXT)) AS confirmed_text, COUNT(*)::int c FROM ${r.table_schema}."${r.table_name}" WHERE to_timestamp("when")::date = $1::date GROUP BY 1 ORDER BY 2 DESC`,
            [date]
          ).then(x => x.rows).catch(() => []);
          counts = { total: cAll.rows[0].c, confirmed_distribution: cDist };
        } catch (e) {
          counts = { error: e.message };
        }
      }
      out.push({ relation: full, type: r.table_type, columns: cols, counts });
    }
    console.log(JSON.stringify({ date, relations: out }, null, 2));
  } catch (err) {
    console.error('Erro:', err.message);
    process.exit(1);
  } finally {
    try { if (client) client.release(); await pool.end(); } catch {}
  }
})();
