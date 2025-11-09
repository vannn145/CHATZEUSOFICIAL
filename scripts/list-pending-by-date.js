#!/usr/bin/env node
require('dotenv').config({ override: true });
const db = require('../src/services/database');

(async () => {
  try {
    const date = process.argv[2];
    if (!date) {
      console.error('Uso: node scripts/list-pending-by-date.js YYYY-MM-DD [limit]');
      process.exit(1);
    }
    const limit = parseInt(process.argv[3] || '10', 10);
    await db.testConnection();
    const rows = await db.getUnconfirmedAppointments(date);
    const total = Array.isArray(rows) ? rows.length : 0;
    const sample = (rows || []).slice(0, limit).map(r => ({
      id: r.id,
      patient_name: r.patient_name,
      tratamento_date: r.tratamento_date,
      patient_contacts: r.patient_contacts,
      main_procedure_term: r.main_procedure_term,
      confirmed: r.confirmed
    }));
    console.log(JSON.stringify({ date, total, sampleCount: sample.length, sample }, null, 2));
    process.exit(0);
  } catch (e) {
    console.error('Erro ao listar pendentes:', e.message);
    process.exit(1);
  }
})();
