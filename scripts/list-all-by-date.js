#!/usr/bin/env node
require('dotenv').config();
const db = require('../src/services/database');

(async () => {
  try {
    const date = process.argv[2];
    if (!date) {
      console.error('Uso: node scripts/list-all-by-date.js YYYY-MM-DD');
      process.exit(1);
    }
    await db.testConnection();
    const rows = await db.getAllAppointments(date);
    const sampleCount = Math.min(10, rows.length);
    const confirmedTotal = rows.filter(row => row && row.confirmed === true).length;
    const pendingTotal = rows.length - confirmedTotal;
    console.log(JSON.stringify({
      date,
      total: rows.length,
      confirmed: confirmedTotal,
      pending: pendingTotal,
      sampleCount,
      sample: rows.slice(0, sampleCount)
    }, null, 2));
  } catch (err) {
    console.error('Erro ao listar (todos):', err.message);
    process.exit(1);
  }
})();
