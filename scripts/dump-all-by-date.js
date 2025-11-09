#!/usr/bin/env node
require('dotenv').config({ override: true });
const db = require('../src/services/database');

(async () => {
  try {
    const date = process.argv[2];
    if (!date) {
      console.error('Uso: node scripts/dump-all-by-date.js YYYY-MM-DD');
      process.exit(1);
    }
    await db.testConnection();
    const rows = await db.getAllAppointments(date);
    console.log(JSON.stringify(rows, null, 2));
  } catch (e) {
    console.error(JSON.stringify({ error: e.message }, null, 2));
    process.exit(1);
  }
})();
