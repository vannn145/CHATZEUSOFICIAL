#!/usr/bin/env node
// Verifica se houve agendamentos "recentes" (por created_at) para uma data alvo.
// Uso: node scripts/check-recent-by-date.js 2025-11-06 [lookbackMinutes=90] [nameFilter]

require('dotenv').config({ override: true });
const { Pool } = require('pg');

function getEpochWindowForBrDate(dateStr) {
  // Constrói janela do dia na timezone São Paulo (fixo -03:00; ajuste se DST necessário)
  const start = new Date(`${dateStr}T00:00:00-03:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return {
    startEpoch: Math.floor(start.getTime() / 1000),
    endEpoch: Math.floor(end.getTime() / 1000),
  };
}

async function main() {
  const args = process.argv.slice(2);
  if (!args[0]) {
    console.error('Informe a data alvo. Ex.: node scripts/check-recent-by-date.js 2025-11-06 [lookbackMinutes] [nameFilter]');
    process.exit(1);
  }
  const targetDate = args[0];
  const lookbackMinutes = Number(args[1] || 90);
  const nameFilter = args[2] ? String(args.slice(2).join(' ')) : null;

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

  // Descobrir colunas de sadt para decidir estratégia (schedule_id / created_at)
  const clientInfo = await pool.connect();
  let sadtCols = [];
  let sadtTypes = {};
  try {
    try { await clientInfo.query(`SET search_path TO ${schema}, public;`); } catch {}
    const qcols = `SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'sadt'`;
    const rows = (await clientInfo.query(qcols, [schema])).rows;
    sadtCols = rows.map(r => String(r.column_name).toLowerCase());
    for (const r of rows) {
      sadtTypes[String(r.column_name).toLowerCase()] = String(r.data_type).toLowerCase();
    }
  } catch (_) {}
  finally { clientInfo.release(); }

  const hasSadt = sadtCols.length > 0;
  const hasScheduleId = sadtCols.includes('schedule_id');
  const hasCreatedAt = sadtCols.includes('created_at');

  // Debug mínimo
  console.error(JSON.stringify({ debug: { schema, hasSadt, hasScheduleId, hasCreatedAt, sadtCols, sadtTypes } }, null, 2));

  // Escolher melhor coluna de data do atendimento no sadt
  const dateCol = sadtCols.includes('tratamento_date') ? 'tratamento_date'
                 : (sadtCols.includes('treatment_date') ? 'treatment_date'
                 : (sadtCols.includes('date') ? 'date'
                 : null));

  if (!dateCol) {
    console.error(JSON.stringify({ error: 'Nenhuma coluna de data conhecida encontrada em sadt (tratamento_date/treatment_date/date).' }, null, 2));
    try { await pool.end(); } catch {}
    process.exit(2);
  }

  // Consulta preferencial: usar somente sadt (evita problemas de view)
  async function runSadtOnly() {
    const client = await pool.connect();
    try {
      try { await client.query(`SET search_path TO ${schema}, public;`); } catch {}
      const dateType = sadtTypes[dateCol] || 'unknown';
      const isEpochNumeric = ['integer', 'bigint', 'numeric', 'double precision', 'real'].includes(dateType);
      const epochPredicate = isEpochNumeric
        ? `s.${dateCol} >= $1 AND s.${dateCol} < $2`
        : `EXTRACT(EPOCH FROM s.${dateCol}::timestamp) >= $1 AND EXTRACT(EPOCH FROM s.${dateCol}::timestamp) < $2`;
      const dateSelect = isEpochNumeric ? `to_timestamp(s.${dateCol})` : `s.${dateCol}`;
      const createdType = (sadtTypes['created_at'] || '').toLowerCase();
      const createdIsEpoch = ['integer','bigint','numeric','double precision','real'].includes(createdType);
      const createdPredicate = hasCreatedAt
        ? (createdIsEpoch
            ? `s.created_at >= EXTRACT(EPOCH FROM NOW() - ($3 || ' minutes')::interval)`
            : `s.created_at >= NOW() - ($3 || ' minutes')::interval`)
        : '';

      const text = `
        SELECT 
          s.patient_name,
          ${dateSelect} AS tratamento_date,
          ${hasCreatedAt ? 's.created_at' : 'NULL::timestamp AS created_at'}
        FROM sadt s
        WHERE ${epochPredicate}
          ${hasCreatedAt ? `AND ${createdPredicate}` : ''}
          ${nameFilter ? (hasCreatedAt ? 'AND UPPER(s.patient_name) LIKE UPPER($4)' : 'AND UPPER(s.patient_name) LIKE UPPER($3)') : ''}
        ORDER BY ${hasCreatedAt ? 's.created_at DESC NULLS LAST,' : ''} ${dateSelect} ASC
        LIMIT 100
      `;
      const base = [startEpoch, endEpoch];
      let vals;
      if (hasCreatedAt) {
        vals = nameFilter ? [...base, lookbackMinutes, `%${nameFilter}%`] : [...base, lookbackMinutes];
      } else {
        vals = nameFilter ? [...base, `%${nameFilter}%`] : base;
      }
      const res = await client.query(text, vals);
      return res.rows.map(r => ({
        patient_name: r.patient_name,
        tratamento_date: r.tratamento_date,
        created_at: r.created_at,
        patient_contacts: null,
        main_procedure_term: null,
        confirmed: null,
      }));
    } finally {
      client.release();
    }
  }

  const baseBuild = (joinCond, pkExpr) => ({
    text: `
      SELECT 
        ${pkExpr} AS id,
        COALESCE(s.patient_name, sv.patient_name) AS patient_name,
        COALESCE(s.tratamento_date, to_timestamp(sv."when")) AS tratamento_date,
        ${hasCreatedAt ? 's.created_at' : 'NULL::timestamp AS created_at'},
        sv.patient_contacts,
        sv.main_procedure_term,
        sv.confirmed
      FROM sadt s
      LEFT JOIN schedule_v sv ON ${joinCond}
      WHERE COALESCE(EXTRACT(EPOCH FROM s.tratamento_date), sv."when") >= $1
        AND COALESCE(EXTRACT(EPOCH FROM s.tratamento_date), sv."when") < $2
        ${hasCreatedAt ? 'AND s.created_at >= NOW() - ($3 || \' minutes\')::interval' : ''}
        ${nameFilter ? (hasCreatedAt ? 'AND UPPER(COALESCE(s.patient_name, sv.patient_name)) LIKE UPPER($4)' : 'AND UPPER(COALESCE(s.patient_name, sv.patient_name)) LIKE UPPER($3)') : ''}
      ORDER BY ${hasCreatedAt ? 's.created_at DESC NULLS LAST,' : ''} COALESCE(s.tratamento_date, to_timestamp(sv."when")) ASC
      LIMIT 100
    `,
    values: (function(){
      if (hasCreatedAt) {
        return nameFilter ? [startEpoch, endEpoch, lookbackMinutes, `%${nameFilter}%`] : [startEpoch, endEpoch, lookbackMinutes];
      } else {
        return nameFilter ? [startEpoch, endEpoch, `%${nameFilter}%`] : [startEpoch, endEpoch];
      }
    })()
  });

  try {
  const rows = hasSadt ? await runSadtOnly() : [];
    const out = {
      date: targetDate,
      lookbackMinutes,
      nameFilter: nameFilter || null,
      total: rows.length,
      notes: !hasSadt ? 'Tabela sadt não encontrada; não é possível aferir created_at. Se necessário, ajuste a consulta.' : (hasCreatedAt ? null : 'Coluna created_at ausente em sadt; o critério de recência não foi aplicado.'),
      items: rows.map(r => ({
        id: r.id,
        patient_name: r.patient_name,
        tratamento_date: r.tratamento_date,
        created_at: r.created_at,
        patient_contacts: r.patient_contacts,
        main_procedure_term: r.main_procedure_term,
        confirmed: r.confirmed
      }))
    };
    console.log(JSON.stringify(out, null, 2));
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error(JSON.stringify({ error: error.message }, null, 2));
    try { await pool.end(); } catch {}
    process.exit(2);
  }
}

main();
